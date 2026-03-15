from django.contrib import admin
from .models import WalletTransaction, GatewayTransaction


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'transaction_type', 'source', 'amount', 'balance_after', 'created_at']
    list_filter = ['transaction_type', 'source']
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