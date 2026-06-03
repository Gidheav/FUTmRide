from django.urls import path
from .admin_dispute import AdminResolveDisputeView, AdminRideRefundView
from .admin_finance import FinanceOverviewView
from .admin_finance_payouts import FinancePayoutsExportView, FinancePayoutsView
from .admin_finance_ledger import (
    FinanceLedgerDetailView,
    FinanceLedgerExportView,
    FinanceLedgerListView,
)
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
    path('admin/finance/payouts/', FinancePayoutsView.as_view(), name='finance-payouts'),
    path('admin/finance/payouts/export/', FinancePayoutsExportView.as_view(), name='finance-payouts-export'),
    path('admin/finance/ledger/', FinanceLedgerListView.as_view(), name='finance-ledger-list'),
    path('admin/finance/ledger/export/', FinanceLedgerExportView.as_view(), name='finance-ledger-export'),
    path('admin/finance/ledger/<str:event_id>/', FinanceLedgerDetailView.as_view(), name='finance-ledger-detail'),
    path('admin/rides/<uuid:ride_id>/refund/', AdminRideRefundView.as_view(), name='admin-ride-refund'),
    path('admin/rides/<uuid:ride_id>/resolve-dispute/', AdminResolveDisputeView.as_view(), name='admin-resolve-dispute'),
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
