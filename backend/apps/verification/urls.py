from django.urls import path
from .views import (
    # Driver-facing
    AccountVerificationSubmitView,
    AccountVerificationResubmitView,
    DriverDocumentUploadView,
    DriverVerificationProgressView,
    # Admin-facing: Account Verification
    AdminAccountVerificationListView,
    AdminAccountVerificationDetailView,
    AdminAccountVerificationReviewView,
    # Admin-facing: Vehicle Verification
    AdminDocumentReviewView,
    AdminDriverDocumentListView,
    AdminVehicleVerificationDetailView,
    AdminDriverUnifiedVerificationView,
    AdminRevokeVerificationView,
    # Admin-facing: Unified
    AdminPendingSubmissionsView,
)

urlpatterns = [
    # ── Driver: Account Verification ────────────────────────────────────────
    path('account/', AccountVerificationSubmitView.as_view(), name='account-verification'),
    path('account/resubmit/', AccountVerificationResubmitView.as_view(), name='account-verification-resubmit'),
    path('progress/', DriverVerificationProgressView.as_view(), name='verification-progress'),

    # ── Driver: Vehicle Documents ───────────────────────────────────────────
    path('documents/', DriverDocumentUploadView.as_view(), name='driver-documents'),

    # ── Admin: Account Verification ─────────────────────────────────────────
    path('admin/account/', AdminAccountVerificationListView.as_view(), name='admin-account-list'),
    path('admin/account/<uuid:pk>/', AdminAccountVerificationDetailView.as_view(), name='admin-account-detail'),
    path('admin/account/<uuid:pk>/review/', AdminAccountVerificationReviewView.as_view(), name='admin-account-review'),

    # ── Admin: Vehicle Verification ──────────────────────────────────────────
    path('admin/documents/<uuid:pk>/review/', AdminDocumentReviewView.as_view(), name='admin-doc-review'),
    path('admin/documents/driver/<uuid:driver_id>/', AdminDriverDocumentListView.as_view(), name='admin-driver-docs'),
    path('admin/vehicle/<uuid:driver_id>/', AdminVehicleVerificationDetailView.as_view(), name='admin-vehicle-detail'),
    path('admin/unified/<uuid:driver_id>/', AdminDriverUnifiedVerificationView.as_view(), name='admin-unified-detail'),
    path('admin/revoke/<uuid:driver_id>/', AdminRevokeVerificationView.as_view(), name='admin-revoke-verification'),

    # ── Admin: Unified Pending Submissions (Right Sidebar) ───────────────────
    path('admin/pending/', AdminPendingSubmissionsView.as_view(), name='admin-pending-submissions'),
]