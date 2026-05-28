from django.urls import path
from .views import (
    DriverPayoutMethodView,
    DriverWalletSummaryView,
    DriverWithdrawalCreateView,
    FlutterwaveWebhookView,
    InitiateTopUpView,
    PaystackWebhookView,
    TopUpStatusView,
    WalletTransactionListView,
    WalletTransferRecipientLookupView,
    WalletTransferView,
)

urlpatterns = [
    path('wallet/transactions/', WalletTransactionListView.as_view(), name='wallet-transactions'),
    path('wallet/driver/summary/', DriverWalletSummaryView.as_view(), name='wallet-driver-summary'),
    path('wallet/driver/payout-method/', DriverPayoutMethodView.as_view(), name='wallet-driver-payout-method'),
    path('wallet/driver/withdrawals/', DriverWithdrawalCreateView.as_view(), name='wallet-driver-withdrawal'),
    path('wallet/transfer/lookup/', WalletTransferRecipientLookupView.as_view(), name='wallet-transfer-lookup'),
    path('wallet/transfer/', WalletTransferView.as_view(), name='wallet-transfer'),
    path('wallet/topup/', InitiateTopUpView.as_view(), name='wallet-topup'),
    path('wallet/topup/status/<str:reference>/', TopUpStatusView.as_view(), name='wallet-topup-status'),
    path('webhooks/paystack/', PaystackWebhookView.as_view(), name='webhook-paystack'),
    path('webhooks/flutterwave/', FlutterwaveWebhookView.as_view(), name='webhook-flutterwave'),
]
