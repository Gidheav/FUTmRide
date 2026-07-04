from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudentUser
from .models import InAppAnnouncement, Notification
from .serializers import InAppAnnouncementSerializer, NotificationSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'is_read': True})


class MarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'marked_read': updated})


class UnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'unread_count': count})


class ActiveInAppAnnouncementView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]

    def get(self, request):
        now = timezone.now()
        announcement = (
            InAppAnnouncement.objects
            .filter(is_active=True)
            .filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now))
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
            .order_by('-priority', '-created_at')
            .first()
        )
        if not announcement:
            return Response({'announcement': None})
        return Response({'announcement': InAppAnnouncementSerializer(announcement).data})
