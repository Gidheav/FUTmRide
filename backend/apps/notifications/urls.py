from django.urls import path
from .views import (
    ActiveInAppAnnouncementView,
    MarkAllReadView,
    MarkNotificationReadView,
    NotificationListView,
    UnreadCountView,
)
from .admin_views import (
    AdminBroadcastView,
    AdminInAppAnnouncementDetailView,
    AdminInAppAnnouncementListCreateView,
    AdminInAppAnnouncementRetriggerView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('announcements/active/', ActiveInAppAnnouncementView.as_view(), name='active-in-app-announcement'),
    path('announcements/admin/', AdminInAppAnnouncementListCreateView.as_view(), name='admin-in-app-announcement-list'),
    path('announcements/admin/<uuid:pk>/', AdminInAppAnnouncementDetailView.as_view(), name='admin-in-app-announcement-detail'),
    path('unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('mark-all-read/', MarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('<uuid:pk>/read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('broadcast/', AdminBroadcastView.as_view(), name='notification-broadcast'),
]
