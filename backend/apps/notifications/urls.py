from django.urls import path
from .views import NotificationListView, MarkNotificationReadView, MarkAllReadView, UnreadCountView
from .admin_views import AdminBroadcastView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('mark-all-read/', MarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('<uuid:pk>/read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('broadcast/', AdminBroadcastView.as_view(), name='notification-broadcast'),
]