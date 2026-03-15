import json
import logging
from decimal import Decimal

from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminUser
from .models import GatewayTransaction, WalletTransaction
from .serializers import (
    WalletTransactionSerializer,
    GatewayTransactionSerializer,
    InitiateTopUpSerializer,
)
from .services import PaystackService, FlutterwaveService, WalletService

logger = logging.getLogger('apps.payments')


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
        try:
            if gateway == 'paystack':
                amount_kobo = int(amount * 100)
                data = PaystackService.initialize_transaction(
                    user=request.user,
                    amount_kobo=amount_kobo,
                    callback_url=callback_url,
                    metadata={'purpose': 'wallet_topup', 'user_id': str(request.user.id)},
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
                )
                return Response({
                    'gateway': 'flutterwave',
                    'payment_url': data['data']['link'],
                })
        except Exception as e:
            logger.error('topup_init_failed user=%s error=%s', str(request.user.id), str(e))
            return Response(
                {'error': {'code': 'GATEWAY_ERROR', 'message': 'Payment gateway error. Please try again.'}},
                status=status.HTTP_502_BAD_GATEWAY,
            )


@method_decorator(csrf_exempt, name='dispatch')
class PaystackWebhookView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        signature = request.headers.get('X-Paystack-Signature', '')
        if not PaystackService.verify_webhook_signature(request.body, signature):
            logger.warning('paystack_webhook_invalid_signature')
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        event = payload.get('event')
        data = payload.get('data', {})

        if event == 'charge.success':
            reference = data.get('reference')
            try:
                tx = GatewayTransaction.objects.get(internal_reference=reference)
                if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                    return Response(status=status.HTTP_200_OK)
                tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                tx.gateway_reference = data.get('id')
                tx.channel = data.get('channel', '')
                tx.gateway_response = data
                tx.webhook_received_at = timezone.now()
                tx.save()
                WalletService.credit(
                    user=tx.user,
                    amount=tx.amount,
                    source=WalletTransaction.Source.TOPUP_PAYSTACK,
                    narration=f'Wallet top-up via Paystack — {reference}',
                    metadata={'gateway_reference': tx.gateway_reference},
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
        secret = request.headers.get('verif-hash', '')
        from django.conf import settings as django_settings
        if secret != django_settings.FLUTTERWAVE_SECRET_KEY:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if payload.get('event') == 'charge.completed' and payload.get('data', {}).get('status') == 'successful':
            data = payload['data']
            reference = data.get('tx_ref')
            try:
                tx = GatewayTransaction.objects.get(internal_reference=reference)
                if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                    return Response(status=status.HTTP_200_OK)
                tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                tx.gateway_reference = str(data.get('id'))
                tx.channel = data.get('payment_type', '')
                tx.gateway_response = data
                tx.webhook_received_at = timezone.now()
                tx.save()
                WalletService.credit(
                    user=tx.user,
                    amount=tx.amount,
                    source=WalletTransaction.Source.TOPUP_FLUTTERWAVE,
                    narration=f'Wallet top-up via Flutterwave — {reference}',
                    metadata={'gateway_reference': tx.gateway_reference},
                )
                logger.info('flutterwave_topup_success ref=%s user=%s amount=%s', reference, str(tx.user.id), tx.amount)
            except GatewayTransaction.DoesNotExist:
                logger.warning('flutterwave_webhook_unknown_ref ref=%s', reference)
            except Exception as e:
                logger.error('flutterwave_webhook_error ref=%s error=%s', reference, str(e))

        return Response(status=status.HTTP_200_OK)