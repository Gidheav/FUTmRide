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