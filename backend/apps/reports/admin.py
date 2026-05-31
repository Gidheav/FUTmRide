from django.contrib import admin

from apps.reports.models import ReportRun, ScheduledReport, StatementAccessRequest


@admin.register(ReportRun)
class ReportRunAdmin(admin.ModelAdmin):
    list_display = ('report_key', 'report_title', 'format', 'status', 'row_count', 'created_at')
    list_filter = ('status', 'category', 'format')
    search_fields = ('report_key', 'report_title')
    readonly_fields = ('id', 'created_at', 'started_at', 'completed_at')


@admin.register(ScheduledReport)
class ScheduledReportAdmin(admin.ModelAdmin):
    list_display = ('name', 'report_key', 'frequency', 'is_active', 'next_run_at')
    list_filter = ('frequency', 'is_active')


@admin.register(StatementAccessRequest)
class StatementAccessRequestAdmin(admin.ModelAdmin):
    list_display = ('subject', 'scope', 'status', 'created_at', 'expires_at')
    list_filter = ('status', 'scope')
