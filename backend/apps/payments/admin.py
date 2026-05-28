from django.contrib import admin
from .models import WalletTransaction, GatewayTransaction, DriverPayoutMethod, DriverWithdrawal


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'transaction_type', 'source', 'status', 'amount', 'balance_after', 'created_at']
    list_filter = ['transaction_type', 'source', 'status']
    search_fields = ['reference', 'user__phone_number', 'user__first_name']
    readonly_fields = ['id', 'reference', 'created_at']
    ordering = ['-created_at']


@admin.register(GatewayTransaction)
class GatewayTransactionAdmin(admin.ModelAdmin):
    list_display = ['internal_reference', 'user', 'gateway', 'gateway_status', 'amount', 'created_at']
    list_filter = ['gateway', 'gateway_status']
    search_fields = ['internal_reference', 'gateway_reference', 'user__phone_number']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(DriverPayoutMethod)
class DriverPayoutMethodAdmin(admin.ModelAdmin):
    list_display = ['user', 'bank_name', 'account_name', 'is_verified', 'updated_at']
    search_fields = ['user__phone_number', 'bank_name', 'account_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-updated_at']


@admin.register(DriverWithdrawal)
class DriverWithdrawalAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'amount', 'status', 'bank_name', 'requested_at']
    list_filter = ['status']
    search_fields = ['reference', 'user__phone_number', 'bank_name']
    readonly_fields = ['id', 'requested_at', 'updated_at']
    ordering = ['-requested_at']