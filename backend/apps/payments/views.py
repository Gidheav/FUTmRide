import json
import logging
from decimal import Decimal
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminUser
from .models import GatewayTransaction, WalletTransaction, WebhookEvent
from .serializers import (
    WalletTransactionSerializer,
    GatewayTransactionSerializer,
    InitiateTopUpSerializer,
)
from .services import PaystackService, FlutterwaveService, WalletService

logger = logging.getLogger('apps.payments')


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


class WalletTransactionListView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WalletTransaction.objects.filter(user=self.request.user).order_by('-created_at')


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