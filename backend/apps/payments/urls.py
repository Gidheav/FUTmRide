from django.urls import path
from .admin_finance import FinanceOverviewView
from .views import (
    DriverPayoutMethodView,
    DriverWalletSummaryView,
    DriverWithdrawalCreateView,
    FlutterwaveWebhookView,
    GatewaySummaryView,
    GatewayTestConnectionView,
    InitiateTopUpView,
    PaystackWebhookView,
    TopUpStatusView,
    WalletTransactionListView,
    WalletTransferRecipientLookupView,
    WalletTransferView,
)

urlpatterns = [
    path('admin/finance/overview/', FinanceOverviewView.as_view(), name='finance-overview'),
    path('wallet/transactions/', WalletTransactionListView.as_view(), name='wallet-transactions'),
    path('wallet/driver/summary/', DriverWalletSummaryView.as_view(), name='wallet-driver-summary'),
    path('wallet/driver/payout-method/', DriverPayoutMethodView.as_view(), name='wallet-driver-payout-method'),
    path('wallet/driver/withdrawals/', DriverWithdrawalCreateView.as_view(), name='wallet-driver-withdrawal'),
    path('wallet/transfer/lookup/', WalletTransferRecipientLookupView.as_view(), name='wallet-transfer-lookup'),
    path('wallet/transfer/', WalletTransferView.as_view(), name='wallet-transfer'),
    path('wallet/topup/', InitiateTopUpView.as_view(), name='wallet-topup'),
    path('wallet/topup/status/<str:reference>/', TopUpStatusView.as_view(), name='wallet-topup-status'),
    path('gateways/summary/', GatewaySummaryView.as_view(), name='gateway-summary'),
    path('gateways/test/', GatewayTestConnectionView.as_view(), name='gateway-test-connection'),
    path('webhooks/paystack/', PaystackWebhookView.as_view(), name='webhook-paystack'),
    path('webhooks/flutterwave/', FlutterwaveWebhookView.as_view(), name='webhook-flutterwave'),
]
