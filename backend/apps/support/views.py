import logging
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminUser
from apps.accounts.models import User, UserRole
from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from .models import SupportTicket
from .serializers import SupportTicketCreateSerializer, SupportTicketSerializer, AdminTicketUpdateSerializer

logger = logging.getLogger('apps.support')


class SupportTicketCreateView(generics.CreateAPIView):
    serializer_class = SupportTicketCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _notify_admins(self, ticket: SupportTicket):
        submitter = ticket.submitted_by.full_name or ticket.submitted_by.phone_number
        category = ticket.get_category_display()
        title = f'New {category.lower()} ticket'
        body = f'{submitter} submitted {ticket.reference}: {ticket.subject}'
        data = {
            'ticket_id': str(ticket.id),
            'reference': ticket.reference,
            'category': ticket.category,
            'priority': ticket.priority,
            'submitted_by_id': str(ticket.submitted_by_id),
        }
        admins = User.objects.filter(
            role__in=[UserRole.ADMIN, UserRole.CAMPUS_ADMIN],
            is_active=True,
        )
        for admin in admins:
            try:
                NotificationService.notify(
                    admin,
                    Notification.NotificationType.SUPPORT_TICKET,
                    title,
                    body,
                    data,
                )
            except Exception:
                logger.exception(
                    'support_ticket_admin_notification_failed ticket=%s admin=%s',
                    ticket.reference,
                    str(admin.id),
                )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        self._notify_admins(ticket)
        logger.info('support_ticket_created ref=%s user=%s', ticket.reference, str(request.user.id))
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class MyTicketsView(generics.ListAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SupportTicket.objects.filter(submitted_by=self.request.user)


class AdminTicketListView(generics.ListAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = SupportTicket.objects.select_related('submitted_by', 'assigned_to')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminTicketDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return AdminTicketUpdateSerializer
        return SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.all()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == SupportTicket.TicketStatus.RESOLVED and not instance.resolved_at:
            instance.resolved_at = timezone.now()
            instance.save(update_fields=['resolved_at'])
