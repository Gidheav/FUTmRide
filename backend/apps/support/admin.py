from django.contrib import admin
from .models import SupportTicket


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ['reference', 'submitted_by', 'category', 'subject', 'status', 'priority', 'created_at']
    list_filter = ['status', 'priority', 'category']
    search_fields = ['reference', 'subject', 'submitted_by__phone_number']
    readonly_fields = ['id', 'reference', 'created_at', 'updated_at']
    ordering = ['-created_at']