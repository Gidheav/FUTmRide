from rest_framework import permissions, status
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from apps.accounts.permissions import IsAdminOrCampusAdmin
from .models import InAppAnnouncement, Notification
from .serializers import AdminInAppAnnouncementSerializer
from .services import PushNotificationService

User = get_user_model()


def _campus_admin_campus_id(user):
    if getattr(user, 'role', None) != 'campus_admin':
        return None
    try:
        return user.campus_admin_profile.campus_id
    except Exception:
        return None


def _send_announcement_push(announcement, request_user):
    if announcement.send_push_notification and announcement.is_active and not announcement.push_sent:
        qs = User.objects.filter(is_active=True, role='student')
        notifications = [
            Notification(
                user=user,
                notification_type=Notification.NotificationType.BROADCAST,
                title=announcement.title,
                body=announcement.body,
                data={'campaign_id': announcement.campaign_id, 'in_app_announcement': True},
            )
            for user in qs
        ]
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)
        
        for user in qs:
            if user.fcm_token:
                PushNotificationService.send(user.fcm_token, announcement.title, announcement.body, {'campaign_id': announcement.campaign_id})
        
        announcement.push_sent = True
        announcement.save(update_fields=['push_sent'])


class AdminInAppAnnouncementListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminInAppAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        queryset = InAppAnnouncement.objects.select_related('campus').order_by('-created_at')
        campus_id = _campus_admin_campus_id(self.request.user)
        if getattr(self.request.user, 'role', None) == 'campus_admin':
            if not campus_id:
                return queryset.none()
            queryset = queryset.filter(campus_id=campus_id)
        return queryset

    def perform_create(self, serializer):
        campus_id = _campus_admin_campus_id(self.request.user)
        if campus_id:
            announcement = serializer.save(campus_id=campus_id)
        else:
            announcement = serializer.save()
        _send_announcement_push(announcement, self.request.user)


class AdminInAppAnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminInAppAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        queryset = InAppAnnouncement.objects.select_related('campus')
        campus_id = _campus_admin_campus_id(self.request.user)
        if getattr(self.request.user, 'role', None) == 'campus_admin':
            if not campus_id:
                return queryset.none()
            queryset = queryset.filter(campus_id=campus_id)
        return queryset

    def perform_update(self, serializer):
        campus_id = _campus_admin_campus_id(self.request.user)
        if campus_id:
            announcement = serializer.save(campus_id=campus_id)
        else:
            announcement = serializer.save()
        _send_announcement_push(announcement, self.request.user)


class AdminBroadcastView(APIView):
    """
    Admin-only endpoint to broadcast a notification to a group of users.
    Audience options: 'students', 'drivers', 'all'
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request):
        title = request.data.get('title', '').strip()
        body = request.data.get('body', '').strip()
        audience = request.data.get('audience', 'all')  # 'students' | 'drivers' | 'all'
        notification_type = request.data.get('notification_type', Notification.NotificationType.BROADCAST)

        if not title or not body:
            return Response(
                {'error': 'title and body are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_audiences = ('students', 'drivers', 'all')
        if audience not in valid_audiences:
            return Response(
                {'error': f'audience must be one of: {", ".join(valid_audiences)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build queryset
        role_map = {'students': 'student', 'drivers': 'driver'}
        qs = User.objects.filter(is_active=True)
        if audience in role_map:
            qs = qs.filter(role=role_map[audience])

        # Bulk create notifications
        notifications = [
            Notification(
                user=user,
                notification_type=notification_type,
                title=title,
                body=body,
                data={'broadcast': True, 'sent_by': str(request.user.id)},
            )
            for user in qs
        ]
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)

        # Send push notifications to users who have FCM tokens
        sent_push = 0
        for user in qs:
            if user.fcm_token:
                ok = PushNotificationService.send(user.fcm_token, title, body, {'broadcast': True})
                if ok:
                    sent_push += 1

        return Response({
            'sent_count': len(notifications),
            'push_sent': sent_push,
        }, status=status.HTTP_200_OK)
