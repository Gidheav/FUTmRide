from django.urls import path
from .views import (
    WalletTransactionListView,
    InitiateTopUpView,
    PaystackWebhookView,
    FlutterwaveWebhookView,
)

urlpatterns = [
    path('wallet/transactions/', WalletTransactionListView.as_view(), name='wallet-transactions'),
    path('wallet/topup/', InitiateTopUpView.as_view(), name='wallet-topup'),
    path('webhooks/paystack/', PaystackWebhookView.as_view(), name='webhook-paystack'),
    path('webhooks/flutterwave/', FlutterwaveWebhookView.as_view(), name='webhook-flutterwave'),
]