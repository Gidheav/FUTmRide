from django.contrib import admin
from .models import DriverDocument


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = ['driver', 'document_type', 'status', 'uploaded_at', 'reviewed_at']
    list_filter = ['document_type', 'status']
    search_fields = ['driver__phone_number', 'driver__first_name']
    readonly_fields = ['id', 'uploaded_at']
    actions = ['approve_documents']

    def approve_documents(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='pending').update(
            status='approved', reviewed_by=request.user, reviewed_at=timezone.now()
        )
        self.message_user(request, f'{updated} document(s) approved.')
    approve_documents.short_description = 'Approve selected documents'