import logging
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminUser
from .models import SupportTicket
from .serializers import SupportTicketCreateSerializer, SupportTicketSerializer, AdminTicketUpdateSerializer

logger = logging.getLogger('apps.support')


class SupportTicketCreateView(generics.CreateAPIView):
    serializer_class = SupportTicketCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
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