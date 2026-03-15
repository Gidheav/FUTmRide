from django.urls import path
from .views import DriverDocumentUploadView, AdminDocumentReviewView, AdminDocumentListView

urlpatterns = [
    path('documents/', DriverDocumentUploadView.as_view(), name='driver-documents'),
    path('documents/<uuid:pk>/review/', AdminDocumentReviewView.as_view(), name='admin-doc-review'),
    path('documents/driver/<uuid:driver_id>/', AdminDocumentListView.as_view(), name='admin-driver-docs'),
]