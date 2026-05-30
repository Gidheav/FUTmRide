from rest_framework import serializers
from .models import WalletTransaction, GatewayTransaction, DriverPayoutMethod, DriverWithdrawal


class WalletTransactionSerializer(serializers.ModelSerializer):
    ride_reference = serializers.SerializerMethodField()
    ride_distance_km = serializers.SerializerMethodField()
    ride_duration_minutes = serializers.SerializerMethodField()
    ride_pickup_address = serializers.SerializerMethodField()
    ride_dropoff_address = serializers.SerializerMethodField()

    ride_passenger_name = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'reference', 'transaction_type', 'source',
            'amount', 'balance_before', 'balance_after',
            'narration', 'created_at', 'status', 'metadata',
            'ride_reference', 'ride_distance_km', 'ride_duration_minutes',
            'ride_pickup_address', 'ride_dropoff_address',
            'ride_passenger_name',
        ]
        read_only_fields = fields

    def get_ride_reference(self, obj):
        return obj.ride.reference if obj.ride else None

    def get_ride_distance_km(self, obj):
        if not obj.ride:
            return None
        return str(obj.ride.actual_distance_km or obj.ride.estimated_distance_km or '') or None

    def get_ride_duration_minutes(self, obj):
        if not obj.ride:
            return None
        return obj.ride.actual_duration_minutes or obj.ride.estimated_duration_minutes

    def get_ride_pickup_address(self, obj):
        return obj.ride.pickup_address if obj.ride else None

    def get_ride_dropoff_address(self, obj):
        return obj.ride.dropoff_address if obj.ride else None

    def get_ride_passenger_name(self, obj):
        if not obj.ride or not obj.ride.student:
            return None
        return obj.ride.student.full_name


class GatewayTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatewayTransaction
        fields = [
            'id', 'internal_reference', 'gateway', 'gateway_status',
            'amount', 'currency', 'channel', 'created_at',
        ]
        read_only_fields = fields


class DriverPayoutMethodSerializer(serializers.ModelSerializer):
    account_number = serializers.CharField(write_only=True)
    account_last4 = serializers.SerializerMethodField()
    account_number_masked = serializers.SerializerMethodField()

    class Meta:
        model = DriverPayoutMethod
        fields = [
            'bank_name', 'bank_code', 'account_number', 'account_name',
            'account_last4', 'account_number_masked', 'is_verified',
        ]
        read_only_fields = ['account_last4', 'account_number_masked', 'is_verified']

    def get_account_last4(self, obj):
        return obj.account_number[-4:] if obj.account_number else ''

    def get_account_number_masked(self, obj):
        last4 = self.get_account_last4(obj)
        return f'**** {last4}' if last4 else ''


class DriverWithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverWithdrawal
        fields = [
            'id', 'reference', 'amount', 'fee', 'status',
            'bank_name', 'account_number_last4', 'requested_at',
            'processed_at', 'metadata',
        ]
        read_only_fields = fields


class DriverWithdrawalCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        if value < 100:
            raise serializers.ValidationError('Minimum withdrawal amount is NGN 100.')
        return value


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
