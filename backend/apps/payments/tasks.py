import logging
from decimal import Decimal
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import GatewayTransaction, WalletTransaction
from .services import PaystackService, FlutterwaveService, WalletService

logger = logging.getLogger('apps.payments')


@shared_task
def reconcile_paystack_pending():
    cutoff = timezone.now() - timedelta(minutes=settings.PAYSTACK_RECONCILE_AFTER_MINUTES)
    pending = GatewayTransaction.objects.filter(
        gateway=GatewayTransaction.Gateway.PAYSTACK,
        gateway_status__in=[
            GatewayTransaction.GatewayStatus.INITIATED,
            GatewayTransaction.GatewayStatus.PENDING,
        ],
        created_at__lte=cutoff,
    )

    for tx in pending.iterator():
        try:
            resp = PaystackService.verify_transaction(tx.internal_reference)
            data = resp.get('data', {})
            status = data.get('status')
            if status == 'success':
                amount_kobo = Decimal(str(data.get('amount', 0)))
                expected_kobo = tx.amount * 100
                if amount_kobo != expected_kobo:
                    logger.error('paystack_reconcile_amount_mismatch ref=%s expected=%s got=%s', tx.internal_reference, expected_kobo, amount_kobo)
                    continue
                with transaction.atomic():
                    tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                    if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                        continue
                    tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                    tx.gateway_reference = str(data.get('id'))
                    tx.channel = data.get('channel', '')
                    tx.gateway_response = data
                    tx.webhook_received_at = tx.webhook_received_at or timezone.now()
                    tx.save(update_fields=[
                        'gateway_status',
                        'gateway_reference',
                        'channel',
                        'gateway_response',
                        'webhook_received_at',
                        'updated_at',
                    ])
                    WalletService.credit(
                        user=tx.user,
                        amount=tx.amount,
                        source=WalletTransaction.Source.TOPUP_PAYSTACK,
                        narration=f'Wallet top-up via Paystack — {tx.internal_reference}',
                        metadata={'gateway_reference': tx.gateway_reference, 'reconciled': True},
                    )
                    logger.info('paystack_reconcile_success ref=%s user=%s amount=%s', tx.internal_reference, str(tx.user.id), tx.amount)
            elif status in {'failed', 'abandoned'}:
                tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED if status == 'failed' else GatewayTransaction.GatewayStatus.ABANDONED
                tx.gateway_response = data
                tx.save(update_fields=['gateway_status', 'gateway_response', 'updated_at'])
        except Exception as exc:
            logger.error('paystack_reconcile_error ref=%s error=%s', tx.internal_reference, str(exc))


@shared_task
def reconcile_flutterwave_pending():
    cutoff = timezone.now() - timedelta(minutes=settings.FLUTTERWAVE_RECONCILE_AFTER_MINUTES)
    pending = GatewayTransaction.objects.filter(
        gateway=GatewayTransaction.Gateway.FLUTTERWAVE,
        gateway_status__in=[
            GatewayTransaction.GatewayStatus.INITIATED,
            GatewayTransaction.GatewayStatus.PENDING,
        ],
        created_at__lte=cutoff,
    )

    for tx in pending.iterator():
        try:
            resp = FlutterwaveService.verify_transaction_by_reference(tx.internal_reference)
            data = resp.get('data', {})
            status = data.get('status') or resp.get('status')
            if status == 'successful':
                amount_naira = Decimal(str(data.get('amount', 0)))
                if amount_naira != tx.amount:
                    logger.error('flutterwave_reconcile_amount_mismatch ref=%s expected=%s got=%s', tx.internal_reference, tx.amount, amount_naira)
                    continue
                if data.get('currency') and data.get('currency') != tx.currency:
                    logger.error('flutterwave_reconcile_currency_mismatch ref=%s expected=%s got=%s', tx.internal_reference, tx.currency, data.get('currency'))
                    continue
                with transaction.atomic():
                    tx = GatewayTransaction.objects.select_for_update().get(id=tx.id)
                    if tx.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
                        continue
                    tx.gateway_status = GatewayTransaction.GatewayStatus.SUCCESS
                    tx.gateway_reference = str(data.get('id'))
                    tx.channel = data.get('payment_type', '')
                    tx.gateway_response = data
                    tx.webhook_received_at = tx.webhook_received_at or timezone.now()
                    tx.save(update_fields=[
                        'gateway_status',
                        'gateway_reference',
                        'channel',
                        'gateway_response',
                        'webhook_received_at',
                        'updated_at',
                    ])
                    WalletService.credit(
                        user=tx.user,
                        amount=tx.amount,
                        source=WalletTransaction.Source.TOPUP_FLUTTERWAVE,
                        narration=f'Wallet top-up via Flutterwave — {tx.internal_reference}',
                        metadata={'gateway_reference': tx.gateway_reference, 'reconciled': True},
                    )
                    logger.info('flutterwave_reconcile_success ref=%s user=%s amount=%s', tx.internal_reference, str(tx.user.id), tx.amount)
            elif status in {'failed', 'cancelled'}:
                tx.gateway_status = GatewayTransaction.GatewayStatus.FAILED if status == 'failed' else GatewayTransaction.GatewayStatus.ABANDONED
                tx.gateway_response = data
                tx.save(update_fields=['gateway_status', 'gateway_response', 'updated_at'])
        except Exception as exc:
            logger.error('flutterwave_reconcile_error ref=%s error=%s', tx.internal_reference, str(exc))
