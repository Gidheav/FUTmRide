import hashlib
import hmac
import logging
import uuid
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction

from apps.accounts.models import StudentProfile, DriverProfile
from .models import GatewayTransaction, WalletTransaction

logger = logging.getLogger('apps.payments')


def generate_reference(prefix='TX'):
    return f'{prefix}-{uuid.uuid4().hex[:16].upper()}'


class WalletService:
    @staticmethod
    @transaction.atomic
    def credit(user, amount: Decimal, source: str, narration: str, ride=None, metadata: dict = None) -> WalletTransaction:
        if user.role == 'student':
            profile = StudentProfile.objects.select_for_update().get(user=user)
            balance_before = profile.wallet_balance
            profile.wallet_balance += amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance
        else:
            profile = DriverProfile.objects.select_for_update().get(user=user)
            balance_before = profile.wallet_balance
            profile.wallet_balance += amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance

        tx = WalletTransaction.objects.create(
            reference=generate_reference('CR'),
            user=user,
            ride=ride,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
            source=source,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            narration=narration,
            metadata=metadata or {},
        )

        try:
            from apps.notifications.services import NotificationService
            notif_data = {
                'transaction_id': str(tx.id),
                'reference': tx.reference,
                'wallet_balance': str(balance_after),
                'source': source,
                'narration': narration,
            }
            if metadata:
                for k, v in metadata.items():
                    notif_data[k] = str(v)

            NotificationService.notify(
                user=user,
                notification_type='payment_received',
                title='Wallet Credited',
                body=f'Your wallet has been credited with NGN {amount:,.2f}.',
                data=notif_data
            )
        except Exception as e:
            logger.error('failed_to_notify_wallet_credit user=%s error=%s', str(user.id), str(e))

        return tx

    @staticmethod
    @transaction.atomic
    def credit_gateway_topup(gateway_tx: GatewayTransaction) -> WalletTransaction | None:
        """Idempotent wallet credit for a successful gateway top-up."""
        locked = GatewayTransaction.objects.select_for_update().get(pk=gateway_tx.pk)
        if locked.wallet_credited:
            return WalletTransaction.objects.filter(
                metadata__gateway_internal_reference=locked.internal_reference,
            ).first()

        if locked.gateway_status != GatewayTransaction.GatewayStatus.SUCCESS:
            return None

        source_map = {
            GatewayTransaction.Gateway.PAYSTACK: WalletTransaction.Source.TOPUP_PAYSTACK,
            GatewayTransaction.Gateway.FLUTTERWAVE: WalletTransaction.Source.TOPUP_FLUTTERWAVE,
        }
        source = source_map.get(locked.gateway)
        if not source:
            return None

        meta = {
            'gateway_internal_reference': locked.internal_reference,
            'gateway_reference': locked.gateway_reference,
        }
        wallet_tx = WalletService.credit(
            user=locked.user,
            amount=locked.amount,
            source=source,
            narration=f'Wallet top-up via {locked.gateway} — {locked.internal_reference}',
            metadata=meta,
        )
        locked.wallet_credited = True
        locked.save(update_fields=['wallet_credited', 'updated_at'])
        try:
            from apps.accounts.audit import log_audit
            log_audit(
                None,
                'wallet_credit',
                actor=locked.user,
                target_type='gateway_transaction',
                target_id=str(locked.id),
                metadata={'internal_reference': locked.internal_reference, 'amount': str(locked.amount)},
            )
        except Exception:
            pass
        return wallet_tx

    @staticmethod
    @transaction.atomic
    def debit(user, amount: Decimal, source: str, narration: str, ride=None, metadata: dict = None) -> WalletTransaction:
        if user.role == 'student':
            try:
                profile = StudentProfile.objects.select_for_update().get(user=user)
            except StudentProfile.DoesNotExist:
                raise ValueError('Wallet profile not found.')
            if profile.wallet_balance < amount:
                raise ValueError('Insufficient wallet balance.')
            balance_before = profile.wallet_balance
            profile.wallet_balance -= amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance
        else:
            try:
                profile = DriverProfile.objects.select_for_update().get(user=user)
            except DriverProfile.DoesNotExist:
                raise ValueError('Wallet profile not found.')
            if profile.wallet_balance < amount:
                raise ValueError('Insufficient wallet balance.')
            balance_before = profile.wallet_balance
            profile.wallet_balance -= amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance

        tx = WalletTransaction.objects.create(
            reference=generate_reference('DR'),
            user=user,
            ride=ride,
            transaction_type=WalletTransaction.TransactionType.DEBIT,
            source=source,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            narration=narration,
            metadata=metadata or {},
        )

        try:
            from apps.notifications.services import NotificationService
            notif_data = {
                'transaction_id': str(tx.id),
                'reference': tx.reference,
                'wallet_balance': str(balance_after),
                'source': source,
                'narration': narration,
            }
            if metadata:
                for k, v in metadata.items():
                    notif_data[k] = str(v)

            NotificationService.notify(
                user=user,
                notification_type='payment_debited',
                title='Wallet Debited',
                body=f'Your wallet has been debited for NGN {amount:,.2f}.',
                data=notif_data
            )
        except Exception as e:
            logger.error('failed_to_notify_wallet_debit user=%s error=%s', str(user.id), str(e))

        return tx


class PaystackService:
    BASE_URL = 'https://api.paystack.co'

    @classmethod
    def _headers(cls):
        return {
            'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
            'Content-Type': 'application/json',
        }

    @classmethod
    def initialize_transaction(
        cls,
        user,
        amount_kobo: int,
        callback_url: str,
        metadata: dict = None,
        idempotency_key: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        reference = generate_reference('PS')
        payload = {
            'email': user.email or f'{str(user.phone_number).replace("+", "")}@lrride.ng',
            'amount': amount_kobo,
            'reference': reference,
            'callback_url': callback_url,
            'metadata': metadata or {},
        }
        resp = requests.post(f'{cls.BASE_URL}/transaction/initialize', json=payload, headers=cls._headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        GatewayTransaction.objects.create(
            internal_reference=reference,
            user=user,
            gateway=GatewayTransaction.Gateway.PAYSTACK,
            amount=Decimal(amount_kobo) / 100,
            gateway_status=GatewayTransaction.GatewayStatus.PENDING,
            gateway_response={
                'authorization_url': data.get('data', {}).get('authorization_url'),
                'access_code': data.get('data', {}).get('access_code'),
                'reference': data.get('data', {}).get('reference'),
            },
            idempotency_key=idempotency_key,
            ip_address=ip_address,
        )
        logger.info('paystack_init ref=%s user=%s', reference, str(user.id))
        return data

    @classmethod
    def verify_transaction(cls, reference: str) -> dict:
        resp = requests.get(f'{cls.BASE_URL}/transaction/verify/{reference}', headers=cls._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()

    @classmethod
    def verify_webhook_signature(cls, payload_bytes: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.PAYSTACK_SECRET_KEY.encode(),
            payload_bytes,
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    @classmethod
    def is_allowed_webhook_ip(cls, ip_address: str) -> bool:
        allowlist = getattr(settings, 'PAYSTACK_WEBHOOK_IP_ALLOWLIST', [])
        if not allowlist:
            return settings.DEBUG
        return ip_address in allowlist

    @classmethod
    def signature_hash(cls, signature: str) -> str:
        return hashlib.sha256(signature.encode()).hexdigest()

    @classmethod
    def payload_hash(cls, payload_bytes: bytes) -> str:
        return hashlib.sha256(payload_bytes).hexdigest()


class FlutterwaveService:
    BASE_URL = 'https://api.flutterwave.com/v3'

    @classmethod
    def _headers(cls):
        return {
            'Authorization': f'Bearer {settings.FLUTTERWAVE_SECRET_KEY}',
            'Content-Type': 'application/json',
        }

    @classmethod
    def initialize_transaction(
        cls,
        user,
        amount_naira: Decimal,
        redirect_url: str,
        metadata: dict = None,
        idempotency_key: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        reference = generate_reference('FW')
        payload = {
            'tx_ref': reference,
            'amount': str(amount_naira),
            'currency': 'NGN',
            'redirect_url': redirect_url,
            'customer': {
                'email': user.email or f'{str(user.phone_number).replace("+", "")}@lrride.ng',
                'phonenumber': str(user.phone_number),
                'name': user.full_name,
            },
            'meta': metadata or {},
        }
        resp = requests.post(f'{cls.BASE_URL}/payments', json=payload, headers=cls._headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        GatewayTransaction.objects.create(
            internal_reference=reference,
            user=user,
            gateway=GatewayTransaction.Gateway.FLUTTERWAVE,
            amount=amount_naira,
            gateway_status=GatewayTransaction.GatewayStatus.PENDING,
            gateway_response={
                'link': data.get('data', {}).get('link'),
                'tx_ref': data.get('data', {}).get('tx_ref'),
            },
            idempotency_key=idempotency_key,
            ip_address=ip_address,
        )
        logger.info('flutterwave_init ref=%s user=%s', reference, str(user.id))
        return data

    @classmethod
    def verify_transaction(cls, transaction_id: str) -> dict:
        resp = requests.get(f'{cls.BASE_URL}/transactions/{transaction_id}/verify', headers=cls._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()

    @classmethod
    def verify_transaction_by_reference(cls, reference: str) -> dict:
        resp = requests.get(
            f'{cls.BASE_URL}/transactions/verify_by_reference',
            params={'tx_ref': reference},
            headers=cls._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    @classmethod
    def verify_webhook_signature(cls, payload_bytes: bytes, signature: str) -> bool:
        signature = (signature or '').strip()
        if not signature:
            return False
        secret = getattr(settings, 'FLUTTERWAVE_WEBHOOK_SECRET', '')
        secret_hash = getattr(settings, 'FLUTTERWAVE_WEBHOOK_SECRET_HASH', '')
        if secret:
            expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, signature):
                return True
        if secret_hash:
            return hmac.compare_digest(secret_hash, signature)
        return False

    @classmethod
    def is_allowed_webhook_ip(cls, ip_address: str) -> bool:
        allowlist = getattr(settings, 'FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST', [])
        if not allowlist:
            return settings.DEBUG
        return ip_address in allowlist

    @classmethod
    def signature_hash(cls, signature: str) -> str:
        return hashlib.sha256(signature.encode()).hexdigest()

    @classmethod
    def payload_hash(cls, payload_bytes: bytes) -> str:
        return hashlib.sha256(payload_bytes).hexdigest()