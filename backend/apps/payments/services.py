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

        return WalletTransaction.objects.create(
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

    @staticmethod
    @transaction.atomic
    def debit(user, amount: Decimal, source: str, narration: str, ride=None, metadata: dict = None) -> WalletTransaction:
        if user.role == 'student':
            profile = StudentProfile.objects.select_for_update().get(user=user)
            if profile.wallet_balance < amount:
                raise ValueError('Insufficient wallet balance.')
            balance_before = profile.wallet_balance
            profile.wallet_balance -= amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance
        else:
            profile = DriverProfile.objects.select_for_update().get(user=user)
            if profile.wallet_balance < amount:
                raise ValueError('Insufficient wallet balance.')
            balance_before = profile.wallet_balance
            profile.wallet_balance -= amount
            profile.save(update_fields=['wallet_balance'])
            balance_after = profile.wallet_balance

        return WalletTransaction.objects.create(
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


class PaystackService:
    BASE_URL = 'https://api.paystack.co'

    @classmethod
    def _headers(cls):
        return {
            'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
            'Content-Type': 'application/json',
        }

    @classmethod
    def initialize_transaction(cls, user, amount_kobo: int, callback_url: str, metadata: dict = None) -> dict:
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


class FlutterwaveService:
    BASE_URL = 'https://api.flutterwave.com/v3'

    @classmethod
    def _headers(cls):
        return {
            'Authorization': f'Bearer {settings.FLUTTERWAVE_SECRET_KEY}',
            'Content-Type': 'application/json',
        }

    @classmethod
    def initialize_transaction(cls, user, amount_naira: Decimal, redirect_url: str, metadata: dict = None) -> dict:
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
        )
        logger.info('flutterwave_init ref=%s user=%s', reference, str(user.id))
        return data

    @classmethod
    def verify_transaction(cls, transaction_id: str) -> dict:
        resp = requests.get(f'{cls.BASE_URL}/transactions/{transaction_id}/verify', headers=cls._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()