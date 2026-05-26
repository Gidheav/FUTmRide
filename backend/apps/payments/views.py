import json
import logging
import re
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import StudentProfile, UserRole
from .models import GatewayTransaction, WalletTransaction, WebhookEvent
from .serializers import (
    InitiateTopUpSerializer,
    WalletTransactionSerializer,
    WalletTransferLookupSerializer,
    WalletTransferSerializer,
)
from .services import FlutterwaveService, PaystackService, WalletService, generate_reference

logger = logging.getLogger('apps.payments')
UUID_PATTERN = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.IGNORECASE)
TRANSFER_QR_PREFIX = 'lrride://wallet/student/'
QR_CODE_PAYLOAD_KEYS = ('recipient_id', 'user_id', 'matric_number', 'recipient_code')


def _get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def _is_timestamp_valid(timestamp_value, replay_window_minutes, max_skew_minutes):
    if not timestamp_value:
        return False
    if isinstance(timestamp_value, str):
        parsed = parse_datetime(timestamp_value)
    else:
        parsed = None
    if parsed is None:
        return False
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone=timezone.utc)
    now = timezone.now()
    if parsed > now + timedelta(minutes=max_skew_minutes):
        return False
    if parsed < now - timedelta(minutes=replay_window_minutes):
        return False
    return True


def _extract_recipient_identifier(raw_code: str):
    code = (raw_code or '').strip()
    if not code:
        raise ValueError('Recipient code is required.')

    if code.startswith('{'):
        try:
            payload = json.loads(code)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            for key in QR_CODE_PAYLOAD_KEYS:
                value = payload.get(key)
                if value:
                    code = str(value).strip()
                    break

    lowered = code.lower()
    if lowered.startswith(TRANSFER_QR_PREFIX):
        code = code[len(TRANSFER_QR_PREFIX):].strip()

    if '://' in code:
        uuid_match = UUID_PATTERN.search(code)
        if uuid_match:
            code = uuid_match.group(0)
        else:
            parts = [part for part in re.split(r'[/?&#]', code) if part]
            if parts:
                code = parts[-1]

    prefix_split = code.split(':', 1)
    if len(prefix_split) == 2 and prefix_split[0].strip().lower() in {'matric', 'student', 'student_id'}:
        code = prefix_split[1].strip()

    code = code.strip().strip('/')
    if not code:
        raise ValueError('Invalid recipient code.')

    try:
        return 'user_id', str(UUID(code))
    except (ValueError, TypeError):
        return 'matric_number', code


def _resolve_student_recipient(raw_code: str):
    identifier_type, value = _extract_recipient_identifier(raw_code)
    if identifier_type == 'user_id':
        profile = StudentProfile.objects.select_related('user', 'campus').filter(
            user_id=value,
            user__role=UserRole.STUDENT,
            user__is_active=True,
        ).first()
    else:
        profile = StudentProfile.objects.select_related('user', 'campus').filter(
            matric_number__iexact=value,
            user__role=UserRole.STUDENT,
            user__is_active=True,
        ).first()

    if not profile:
        raise ValueError('Recipient not found. Ask the student to show a valid barcode.')
    return profile


def _serialize_student_recipient(profile):
    campus = profile.campus
    return {
        'user_id': str(profile.user.id),
        'full_name': profile.user.full_name,
        'first_name': profile.user.first_name,
        'last_name': profile.user.last_name,
        'matric_number': profile.matric_number,
        'department': profile.department,
        'level': profile.level,
        'campus': {
            'id': str(campus.id),
            'name': campus.name,
        } if campus else None,
        'profile_photo': profile.user.profile_photo.url if profile.user.profile_photo else None,
    }


def _format_naira(amount: Decimal):
    return f'NGN {amount:,.2f}'


class WalletTransactionListView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WalletTransaction.objects.filter(user=self.request.user).order_by('-created_at')


class WalletTransferRecipientLookupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can use student transfer.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WalletTransferLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            recipient_profile = _resolve_student_recipient(serializer.validated_data['recipient_code'])
        except ValueError as exc:
            return Response(
                {'error': {'code': 'RECIPIENT_INVALID', 'message': str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if recipient_profile.user_id == request.user.id:
            return Response(
                {'error': {'code': 'SELF_TRANSFER', 'message': 'You cannot transfer to your own wallet.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'recipient': _serialize_student_recipient(recipient_profile)})


class WalletTransferView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can transfer to students.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WalletTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data['amount']
        narration = (serializer.validated_data.get('narration') or '').strip()

        try:
            recipient_profile = _resolve_student_recipient(serializer.validated_data['recipient_code'])
        except ValueError as exc:
            return Response(
                {'error': {'code': 'RECIPIENT_INVALID', 'message': str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if recipient_profile.user_id == request.user.id:
            return Response(
                {'error': {'code': 'SELF_TRANSFER', 'message': 'You cannot transfer to your own wallet.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            transfer_result = self._perform_transfer(
                sender_user=request.user,
                recipient_profile=recipient_profile,
                amount=amount,
                narration=narration,
            )
        except ValueError as exc:
            return Response(
                {'error': {'code': 'TRANSFER_FAILED', 'message': str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error('wallet_transfer_failed sender=%s recipient=%s error=%s', request.user.id, recipient_profile.user_id, exc)
            return Response(
                {'error': {'code': 'TRANSFER_FAILED', 'message': 'Transfer failed. Please try again.'}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        sender_tx = transfer_result['sender_tx']
        sender_balance = transfer_result['sender_balance']
        transfer_reference = transfer_result['transfer_reference']

        return Response(
            {
                'message': 'Transfer successful.',
                'transfer_reference': transfer_reference,
                'amount': str(amount),
                'sender_transaction_reference': sender_tx.reference,
                'sender_balance_after': str(sender_balance),
                'recipient': _serialize_student_recipient(recipient_profile),
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _perform_transfer(sender_user, recipient_profile, amount: Decimal, narration: str):
        transfer_reference = generate_reference('ST')
        recipient_user = recipient_profile.user

        with transaction.atomic():
            locked_profiles = list(
                StudentProfile.objects.select_for_update()
                .select_related('user')
                .filter(user_id__in=[sender_user.id, recipient_user.id])
                .order_by('user_id')
            )
            profiles_by_user = {profile.user_id: profile for profile in locked_profiles}
            sender_profile = profiles_by_user.get(sender_user.id)
            recipient_locked_profile = profiles_by_user.get(recipient_user.id)

            if not sender_profile or not recipient_locked_profile:
                raise ValueError('Student wallet profile not found.')
            if sender_profile.wallet_balance < amount:
                raise ValueError('Insufficient wallet balance.')

            sender_before = sender_profile.wallet_balance
            recipient_before = recipient_locked_profile.wallet_balance

            sender_profile.wallet_balance -= amount
            recipient_locked_profile.wallet_balance += amount

            sender_profile.save(update_fields=['wallet_balance'])
            recipient_locked_profile.save(update_fields=['wallet_balance'])

            sender_narration = f'Transfer to {recipient_user.full_name}'
            recipient_narration = f'Transfer from {sender_user.full_name}'
            if narration:
                sender_narration = f'{sender_narration} - {narration}'
                recipient_narration = f'{recipient_narration} - {narration}'

            sender_tx = WalletTransaction.objects.create(
                reference=generate_reference('DR'),
                user=sender_user,
                transaction_type=WalletTransaction.TransactionType.DEBIT,
                source=WalletTransaction.Source.STUDENT_TRANSFER_SENT,
                amount=amount,
                balance_before=sender_before,
                balance_after=sender_profile.wallet_balance,
                narration=sender_narration,
                metadata={
                    'transfer_reference': transfer_reference,
                    'counterparty_user_id': str(recipient_user.id),
                    'counterparty_matric_number': recipient_locked_profile.matric_number,
                },
            )

            recipient_tx = WalletTransaction.objects.create(
                reference=generate_reference('CR'),
                user=recipient_user,
                transaction_type=WalletTransaction.TransactionType.CREDIT,
                source=WalletTransaction.Source.STUDENT_TRANSFER_RECEIVED,
                amount=amount,
                balance_before=recipient_before,
                balance_after=recipient_locked_profile.wallet_balance,
                narration=recipient_narration,
                metadata={
                    'transfer_reference': transfer_reference,
                    'counterparty_user_id': str(sender_user.id),
                    'counterparty_matric_number': sender_profile.matric_number,
                },
            )

        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify(
                user=sender_user,
                notification_type='payment_received',
                title='Transfer Sent',
                body=f'You sent {_format_naira(amount)} to {recipient_user.full_name}.',
                data={
                    'transfer_reference': transfer_reference,
                    'transaction_reference': sender_tx.reference,
                    'recipient_user_id': str(recipient_user.id),
                    'wallet_balance': str(sender_profile.wallet_balance),
                },
            )
            NotificationService.notify(
                user=recipient_user,
                notification_type='payment_received',
                title='Transfer Received',
                body=f'You received {_format_naira(amount)} from {sender_user.full_name}.',
                data={
                    'transfer_reference': transfer_reference,
                    'transaction_reference': recipient_tx.reference,
                    'sender_user_id': str(sender_user.id),
                    'wallet_balance': str(recipient_locked_profile.wallet_balance),
                },
            )
        except Exception as exc:
            logger.error(
                'wallet_transfer_notification_failed sender=%s recipient=%s ref=%s error=%s',
                sender_user.id,
                recipient_user.id,
                transfer_reference,
                exc,
            )

        return {
            'transfer_reference': transfer_reference,
            'sender_tx': sender_tx,
            'recipient_tx': recipient_tx,
            'sender_balance': sender_profile.wallet_balance,
            'recipient_balance': recipient_locked_profile.wallet_balance,
        }


class InitiateTopUpView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitiateTopUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data['amount']
        gateway = serializer.validated_data['gateway']
        callback_url = serializer.validated_data['callback_url']
        idempotency_key = request.headers.get('Idempotency-Key') or serializer.validated_data.get('idempotency_key')
        if idempotency_key:
            existing = GatewayTransaction.objects.filter(
                user=request.user,
                gateway=gateway,
                idempotency_key=idempotency_key,
            ).order_by('-created_at').first()
            if existing:
                payment_url = None
                if gateway == 'paystack':
                    payment_url = existing.gateway_response.get('authorization_url')
                elif gateway == 'flutterwave':
                    payment_url = existing.gateway_response.get('link')
                return Response({
                    'gateway': gateway,
                    'payment_url': payment_url,
                    'reference': existing.internal_reference,
                    'status': existing.gateway_status,
                })
        try:
            ip_address = _get_client_ip(request)
            if gateway == 'paystack':
                amount_kobo = int(amount * 100)
                data = PaystackService.initialize_transaction(
                    user=request.user,
                    amount_kobo=amount_kobo,
                    callback_url=callback_url,
                    metadata={'purpose': 'wallet_topup', 'user_id': str(request.user.id)},
                    idempotency_key=idempotency_key,
                    ip_address=ip_address,
                )
                return Response({
                    'gateway': 'paystack',
                    'payment_url': data['data']['authorization_url'],
                    'reference': data['data']['reference'],
                })
            else:
                data = FlutterwaveService.initialize_transaction(
                    user=request.user,
                    amount_naira=amount,
                    redirect_url=callback_url,
                    metadata={'purpose': 'wallet_topup', 'user_id': str(request.user.id)},
                    idempotency_key=idempotency_key,
                    ip_address=ip_address,
                )
                return Response({
                    'gateway': 'flutterwave',
                    'payment_url': data['data']['link'],
                    'reference': data['data'].get('tx_ref'),
                })
        except Exception as e:
            logger.error('topup_init_failed user=%s error=%s', str(request.user.id), str(e))
            return Response(
                {'error': {'code': 'GATEWAY_ERROR', 'message': 'Payment gateway error. Please try again.'}},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class TopUpStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, reference):
        try:
            tx = GatewayTransaction.objects.get(user=request.user, internal_reference=reference)
        except GatewayTransaction.DoesNotExist:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Transaction not found.'}}, status=404)

        if tx.gateway_status == GatewayTransaction.GatewayStatus.PENDING:
            self._verify_pending_transaction(tx)

        payment_url = None
        if tx.gateway == GatewayTransaction.Gateway.PAYSTACK:
            payment_url = tx.gateway_response.get('authorization_url')
        elif tx.gateway == GatewayTransaction.Gateway.FLUTTERWAVE:
            payment_url = tx.gateway_response.get('link')

        return Response({
            'reference': tx.internal_reference,
            'gateway': tx.gateway,
            'status': tx.gateway_status,
            'amount': str(tx.amount),
            'currency': tx.currency,
            'payment_url': payment_url,
        })

    def _verify_pending_transaction(self, tx):
        try:
            if tx.gateway == GatewayTransaction.Gateway.PAYSTACK:
                data = PaystackService.verify_transaction(tx.internal_reference)
                res_data = data.get('data', {})
                status_str = res_data.get('status')
                if status_str == 'success':
                    with transaction.atomic():
                        t_tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                        if t_tx.gateway_status == GatewayTransaction.GatewayStatus.PENDING:
                            t_tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                            t_tx.gateway_reference = str(res_data.get('id', ''))
                            t_tx.gateway_response = res_data
                            t_tx.save()
                            WalletService.credit(
                                user=t_tx.user,
                                amount=t_tx.amount,
                                source=WalletTransaction.Source.TOPUP_PAYSTACK,
                                narration=f'Wallet top-up via Paystack — {t_tx.internal_reference}',
                                metadata={'gateway_reference': t_tx.gateway_reference, 'verified_via': 'api'},
                            )
                            tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                elif status_str == 'failed':
                    with transaction.atomic():
                        t_tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                        if t_tx.gateway_status == GatewayTransaction.GatewayStatus.PENDING:
                            t_tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED
                            t_tx.gateway_response = res_data
                            t_tx.save()
                            tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED

            elif tx.gateway == GatewayTransaction.Gateway.FLUTTERWAVE:
                data = FlutterwaveService.verify_transaction_by_reference(tx.internal_reference)
                res_data = data.get('data', {})
                status_str = res_data.get('status')
                if status_str == 'successful':
                    with transaction.atomic():
                        t_tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                        if t_tx.gateway_status == GatewayTransaction.GatewayStatus.PENDING:
                            t_tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                            t_tx.gateway_reference = str(res_data.get('id', ''))
                            t_tx.gateway_response = res_data
                            t_tx.save()
                            WalletService.credit(
                                user=t_tx.user,
                                amount=t_tx.amount,
                                source=WalletTransaction.Source.TOPUP_FLUTTERWAVE,
                                narration=f'Wallet top-up via Flutterwave — {t_tx.internal_reference}',
                                metadata={'gateway_reference': t_tx.gateway_reference, 'verified_via': 'api'},
                            )
                            tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                elif status_str == 'failed':
                    with transaction.atomic():
                        t_tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                        if t_tx.gateway_status == GatewayTransaction.GatewayStatus.PENDING:
                            t_tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED
                            t_tx.gateway_response = res_data
                            t_tx.save()
                            tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED
        except Exception as e:
            logger.error('active_verify_failed ref=%s error=%s', tx.internal_reference, str(e))


@method_decorator(csrf_exempt, name='dispatch')
class PaystackWebhookView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        signature = request.headers.get('X-Paystack-Signature', '')
        ip_address = _get_client_ip(request)
        if not PaystackService.is_allowed_webhook_ip(ip_address):
            logger.warning('paystack_webhook_ip_blocked ip=%s', ip_address)
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not PaystackService.verify_webhook_signature(request.body, signature):
            logger.warning('paystack_webhook_invalid_signature')
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        event = payload.get('event')
        data = payload.get('data', {})
        reference = data.get('reference')
        event_id = str(data.get('id') or f'{event}:{reference}')
        signature_hash = PaystackService.signature_hash(signature)
        payload_hash = PaystackService.payload_hash(request.body)
        replay_window = getattr(settings, 'PAYSTACK_WEBHOOK_REPLAY_WINDOW_MINUTES', 60)
        max_skew = getattr(settings, 'PAYSTACK_WEBHOOK_MAX_SKEW_MINUTES', 10)
        event_time = data.get('paid_at') or data.get('created_at')

        if not _is_timestamp_valid(event_time, replay_window, max_skew):
            logger.warning('paystack_webhook_invalid_timestamp ref=%s event_id=%s', reference, event_id)
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                WebhookEvent.objects.create(
                    gateway=GatewayTransaction.Gateway.PAYSTACK,
                    event_id=event_id,
                    reference=reference,
                    signature_hash=signature_hash,
                    payload_hash=payload_hash,
                    ip_address=ip_address,
                )
        except IntegrityError:
            return Response(status=status.HTTP_200_OK)

        if event == 'charge.success' and data.get('status') == 'success':
            try:
                with transaction.atomic():
                    tx = GatewayTransaction.objects.select_for_update().get(internal_reference=reference)
                    if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                        return Response(status=status.HTTP_200_OK)
                    amount_kobo = Decimal(str(data.get('amount', 0)))
                    expected_kobo = tx.amount * 100
                    if amount_kobo != expected_kobo:
                        logger.error('paystack_amount_mismatch ref=%s expected=%s got=%s', reference, expected_kobo, amount_kobo)
                        return Response(status=status.HTTP_200_OK)
                    if data.get('currency') and data.get('currency') != tx.currency:
                        logger.error('paystack_currency_mismatch ref=%s expected=%s got=%s', reference, tx.currency, data.get('currency'))
                        return Response(status=status.HTTP_200_OK)
                    tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                    tx.gateway_reference = str(data.get('id'))
                    tx.channel = data.get('channel', '')
                    tx.gateway_response = data
                    tx.webhook_received_at = timezone.now()
                    tx.ip_address = ip_address
                    tx.save()
                    WalletService.credit(
                        user=tx.user,
                        amount=tx.amount,
                        source=WalletTransaction.Source.TOPUP_PAYSTACK,
                        narration=f'Wallet top-up via Paystack — {reference}',
                        metadata={'gateway_reference': tx.gateway_reference, 'event_id': event_id},
                    )
                    logger.info('paystack_topup_success ref=%s user=%s amount=%s', reference, str(tx.user.id), tx.amount)
            except GatewayTransaction.DoesNotExist:
                logger.warning('paystack_webhook_unknown_ref ref=%s', reference)
            except Exception as e:
                logger.error('paystack_webhook_error ref=%s error=%s', reference, str(e))

        return Response(status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class FlutterwaveWebhookView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        signature = request.headers.get('verif-hash', '') or request.headers.get('x-flw-signature', '')
        ip_address = _get_client_ip(request)
        if not FlutterwaveService.is_allowed_webhook_ip(ip_address):
            logger.warning('flutterwave_webhook_ip_blocked ip=%s', ip_address)
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not FlutterwaveService.verify_webhook_signature(request.body, signature):
            logger.warning('flutterwave_webhook_invalid_signature')
            return Response(status=status.HTTP_400_BAD_REQUEST)

        payload_hash = FlutterwaveService.payload_hash(request.body)
        signature_hash = FlutterwaveService.signature_hash(signature)

        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if payload.get('event') == 'charge.completed' and payload.get('data', {}).get('status') == 'successful':
            data = payload['data']
            reference = data.get('tx_ref')
            event_id = str(data.get('id') or f'charge.completed:{reference}')
            replay_window = getattr(settings, 'FLUTTERWAVE_WEBHOOK_REPLAY_WINDOW_MINUTES', 60)
            max_skew = getattr(settings, 'FLUTTERWAVE_WEBHOOK_MAX_SKEW_MINUTES', 10)
            event_time = data.get('created_at') or data.get('created')

            if not _is_timestamp_valid(event_time, replay_window, max_skew):
                logger.warning('flutterwave_webhook_invalid_timestamp ref=%s event_id=%s', reference, event_id)
                return Response(status=status.HTTP_400_BAD_REQUEST)
            try:
                with transaction.atomic():
                    WebhookEvent.objects.create(
                        gateway=GatewayTransaction.Gateway.FLUTTERWAVE,
                        event_id=event_id,
                        reference=reference,
                        signature_hash=signature_hash,
                        payload_hash=payload_hash,
                        ip_address=ip_address,
                    )
            except IntegrityError:
                return Response(status=status.HTTP_200_OK)
            try:
                with transaction.atomic():
                    tx = GatewayTransaction.objects.select_for_update().get(internal_reference=reference)
                    if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                        return Response(status=status.HTTP_200_OK)
                    amount_naira = Decimal(str(data.get('amount', 0)))
                    if amount_naira != tx.amount:
                        logger.error('flutterwave_amount_mismatch ref=%s expected=%s got=%s', reference, tx.amount, amount_naira)
                        return Response(status=status.HTTP_200_OK)
                    tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                    tx.gateway_reference = str(data.get('id'))
                    tx.channel = data.get('payment_type', '')
                    tx.gateway_response = data
                    tx.webhook_received_at = timezone.now()
                    tx.ip_address = ip_address
                    tx.save()
                    WalletService.credit(
                        user=tx.user,
                        amount=tx.amount,
                        source=WalletTransaction.Source.TOPUP_FLUTTERWAVE,
                        narration=f'Wallet top-up via Flutterwave — {reference}',
                        metadata={'gateway_reference': tx.gateway_reference, 'event_id': event_id},
                    )
                    logger.info('flutterwave_topup_success ref=%s user=%s amount=%s', reference, str(tx.user.id), tx.amount)
            except GatewayTransaction.DoesNotExist:
                logger.warning('flutterwave_webhook_unknown_ref ref=%s', reference)
            except Exception as e:
                logger.error('flutterwave_webhook_error ref=%s error=%s', reference, str(e))

        return Response(status=status.HTTP_200_OK)
