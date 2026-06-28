from django.urls import path
from .views import (
    LocationMetaView,
    LocationDownloadView,
    LocationAdminBulkImportView,
    LocationAdminPublishView,
    LocationAdminWipeView,
)

urlpatterns = [
    path('meta/', LocationMetaView.as_view(), name='locations-meta'),
    path('download/', LocationDownloadView.as_view(), name='locations-download'),
    path('admin/bulk-import/', LocationAdminBulkImportView.as_view(), name='locations-admin-import'),
    path('admin/publish/', LocationAdminPublishView.as_view(), name='locations-admin-publish'),
    path('admin/wipe/', LocationAdminWipeView.as_view(), name='locations-admin-wipe'),
]
