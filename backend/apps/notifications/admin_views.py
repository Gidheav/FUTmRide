from rest_framework import permissions, status
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
import logging
import time
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from apps.accounts.permissions import IsAdminOrCampusAdmin
from .models import InAppAnnouncement, Notification
from .serializers import AdminInAppAnnouncementSerializer
from .services import PushNotificationService

logger = logging.getLogger('apps.notifications')
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
        qs = User.objects.filter(is_active=True).select_related('settings')
        if announcement.audience == 'student':
            qs = qs.filter(role='student')
        elif announcement.audience == 'driver':
            qs = qs.filter(role='driver')
        else:
            qs = qs.filter(role__in=['student', 'driver'])

        # Materialise once so we can iterate multiple times
        users = list(qs)

        announcement_data = {
            'campaign_id': announcement.campaign_id,
            'in_app_announcement': True,
            'image_url': announcement.image_url or '',
            'icon_name': announcement.icon_name or 'campaign',
            'cta_label': announcement.cta_label or 'Got it',
            'cta_url': announcement.cta_url or '',
            'web_url': announcement.cta_url or '',
            'web_title': announcement.title,
        }

        notifications = [
            Notification(
                user=user,
                notification_type=Notification.NotificationType.BROADCAST,
                title=announcement.title,
                body=announcement.body,
                data=announcement_data,
            )
            for user in users
        ]
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)

        # Push notifications (deduplicated by FCM token)
        sent_tokens = set()
        for user in users:
            if user.fcm_token and user.fcm_token not in sent_tokens:
                PushNotificationService.send(
                    user.fcm_token,
                    announcement.title,
                    announcement.body,
                    announcement_data,
                )
                sent_tokens.add(user.fcm_token)

        # Email notifications
        email_context = {
            'title': announcement.title,
            'body': announcement.body,
            'image_url': announcement.image_url or '',
            'cta_label': announcement.cta_label or 'Open App',
            'cta_url': announcement.cta_url or '',
        }
        try:
            html_body = render_to_string('emails/announcement_email.html', email_context)
            text_body = render_to_string('emails/announcement_email.txt', email_context)
        except Exception as exc:
            logger.error('announcement_email_template_failed error=%s', str(exc))
            html_body = None
            text_body = None

        if html_body:
            for user in users:
                if not user.email:
                    continue
                # Respect user email_announcements preference
                try:
                    user_settings = getattr(user, 'settings', None)
                    if user_settings is not None and not user_settings.email_announcements:
                        continue
                except Exception:
                    pass
                try:
                    msg = EmailMultiAlternatives(
                        subject=f'LR-Ride: {announcement.title}',
                        body=text_body,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=[user.email],
                    )
                    msg.attach_alternative(html_body, 'text/html')
                    msg.send(fail_silently=True)
                except Exception as exc:
                    logger.warning('announcement_email_send_failed user_id=%s error=%s', str(user.id), str(exc))

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


class AdminInAppAnnouncementRetriggerView(APIView):
    """
    Retrigger an announcement: changes the campaign_id slightly so clients
    who already dismissed it will see it again, and resets push_sent to send pushes again.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, pk):
        try:
            announcement = InAppAnnouncement.objects.get(pk=pk)
        except InAppAnnouncement.DoesNotExist:
            return Response({'error': 'Announcement not found.'}, status=404)
            
        campus_id = _campus_admin_campus_id(request.user)
        if getattr(request.user, 'role', None) == 'campus_admin':
            if announcement.campus_id != campus_id:
                return Response({'error': 'You do not have permission to retrigger this announcement.'}, status=403)

        # Change campaign_id to force mobile apps to show it again
        base_id = announcement.campaign_id.split('_retrigger')[0]
        # Keep it under 80 chars (max_length)
        announcement.campaign_id = f"{base_id[:50]}_retrigger_{int(time.time())}"
        announcement.push_sent = False
        announcement.save(update_fields=['campaign_id', 'push_sent'])

        _send_announcement_push(announcement, request.user)

        return Response({
            'status': 'success',
            'message': 'Announcement retriggered successfully.',
            'new_campaign_id': announcement.campaign_id
        })


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
        sent_tokens = set()
        for user in qs:
            if user.fcm_token and user.fcm_token not in sent_tokens:
                ok = PushNotificationService.send(user.fcm_token, title, body, {'broadcast': True})
                if ok:
                    sent_push += 1
                sent_tokens.add(user.fcm_token)

        return Response({
            'sent_count': len(notifications),
            'push_sent': sent_push,
        }, status=status.HTTP_200_OK)
