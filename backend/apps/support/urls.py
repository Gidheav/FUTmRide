from django.urls import path
from .views import SupportTicketCreateView, MyTicketsView, AdminTicketListView, AdminTicketDetailView

urlpatterns = [
    path('tickets/', SupportTicketCreateView.as_view(), name='support-ticket-create'),
    path('tickets/mine/', MyTicketsView.as_view(), name='support-ticket-mine'),
    path('admin/tickets/', AdminTicketListView.as_view(), name='admin-ticket-list'),
    path('admin/tickets/<uuid:pk>/', AdminTicketDetailView.as_view(), name='admin-ticket-detail'),
]