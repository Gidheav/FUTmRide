from django.contrib import admin

from .models import InAppAnnouncement, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__phone_number', 'title']
    readonly_fields = ['id', 'created_at']


@admin.register(InAppAnnouncement)
class InAppAnnouncementAdmin(admin.ModelAdmin):
    list_display = ['campaign_id', 'title', 'campus', 'audience', 'is_active', 'send_push_notification', 'priority', 'starts_at', 'ends_at', 'updated_at']
    list_filter = ['is_active', 'send_push_notification', 'audience', 'campus', 'starts_at', 'ends_at']
    search_fields = ['campaign_id', 'title', 'body', 'campus__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Campaign', {
            'fields': ('campaign_id', 'campus', 'audience', 'title', 'body', 'cta_label'),
        }),
        ('Visual', {
            'fields': ('image_url', 'icon_name'),
        }),
        ('Publishing', {
            'fields': ('is_active', 'send_push_notification', 'priority', 'starts_at', 'ends_at'),
        }),
        ('System', {
            'fields': ('id', 'created_at', 'updated_at'),
        }),
    )
