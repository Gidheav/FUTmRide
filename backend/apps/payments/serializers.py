from rest_framework import serializers
from .models import WalletTransaction, GatewayTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'reference', 'transaction_type', 'source',
            'amount', 'balance_before', 'balance_after',
            'narration', 'created_at',
        ]
        read_only_fields = fields


class GatewayTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatewayTransaction
        fields = [
            'id', 'internal_reference', 'gateway', 'gateway_status',
            'amount', 'currency', 'channel', 'created_at',
        ]
        read_only_fields = fields


class InitiateTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    gateway = serializers.ChoiceField(choices=['paystack', 'flutterwave'])
    callback_url = serializers.URLField()
    idempotency_key = serializers.CharField(max_length=64, required=False, allow_blank=False)

    def validate_amount(self, value):
        if value < 100:
            raise serializers.ValidationError('Minimum top-up amount is NGN 100.')
        return value


class WalletTransferLookupSerializer(serializers.Serializer):
    recipient_code = serializers.CharField(max_length=255)

    def validate_recipient_code(self, value):
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Recipient code is required.')
        return cleaned


class WalletTransferSerializer(serializers.Serializer):
    recipient_code = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    narration = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_recipient_code(self, value):
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Recipient code is required.')
        return cleaned

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        if value < 50:
            raise serializers.ValidationError('Minimum transfer amount is NGN 50.')
        return value
