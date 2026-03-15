import uuid
from django.db import models
from apps.accounts.models import User
from apps.rides.models import Ride


class WalletTransaction(models.Model):
    class TransactionType(models.TextChoices):
        CREDIT = 'credit', 'Credit'
        DEBIT = 'debit', 'Debit'

    class Source(models.TextChoices):
        RIDE_PAYMENT = 'ride_payment', 'Ride Payment'
        RIDE_REFUND = 'ride_refund', 'Ride Refund'
        TOPUP_PAYSTACK = 'topup_paystack', 'Top-Up via Paystack'
        TOPUP_FLUTTERWAVE = 'topup_flutterwave', 'Top-Up via Flutterwave'
        DRIVER_EARNING = 'driver_earning', 'Driver Earning'
        DRIVER_WITHDRAWAL = 'driver_withdrawal', 'Driver Withdrawal'
        PLATFORM_COMMISSION = 'platform_commission', 'Platform Commission'
        PROMOTION = 'promotion', 'Promotional Credit'
        ADMIN_ADJUSTMENT = 'admin_adjustment', 'Admin Adjustment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=40, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='wallet_transactions')
    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TransactionType.choices, db_index=True)
    source = models.CharField(max_length=30, choices=Source.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    narration = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'wallet_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        return f'WalletTx({self.reference} {self.transaction_type} {self.amount})'


class GatewayTransaction(models.Model):
    class Gateway(models.TextChoices):
        PAYSTACK = 'paystack', 'Paystack'
        FLUTTERWAVE = 'flutterwave', 'Flutterwave'

    class GatewayStatus(models.TextChoices):
        INITIATED = 'initiated', 'Initiated'
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        ABANDONED = 'abandoned', 'Abandoned'
        REVERSED = 'reversed', 'Reversed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    internal_reference = models.CharField(max_length=40, unique=True)
    gateway_reference = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='gateway_transactions')
    gateway = models.CharField(max_length=20, choices=Gateway.choices)
    gateway_status = models.CharField(max_length=20, choices=GatewayStatus.choices, default=GatewayStatus.INITIATED, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    channel = models.CharField(max_length=40, blank=True)
    gateway_response = models.JSONField(default=dict, blank=True)
    webhook_received_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gateway_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'gateway_status']),
            models.Index(fields=['gateway', 'gateway_status']),
        ]

    def __str__(self):
        return f'GatewayTx({self.internal_reference} {self.gateway} {self.gateway_status})'