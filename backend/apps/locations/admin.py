import json

from django import forms
from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import path
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Location, LocationSnapshot
from .publish import publish_locations


# ── Bulk Import Form ───────────────────────────────────────────────────────────

class BulkImportForm(forms.Form):
    json_data = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 20, 'cols': 80, 'style': 'font-family:monospace;font-size:12px;'}),
        label='Paste JSON array of locations',
        help_text=(
            'Each object must have: id, name, description, latitude, longitude, category. '
            'Valid categories: lecture, hostel, gate, library, blocks, medical, sports, ict, canteen, mosque, laboratory'
        ),
    )


# ── Location Admin ─────────────────────────────────────────────────────────────

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'category', 'campus', 'is_active', 'latitude', 'longitude')
    list_filter = ('category', 'campus', 'is_active')
    search_fields = ('name', 'description', 'id')
    list_editable = ('is_active',)
    ordering = ('category', 'name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'description', 'category', 'campus', 'is_active'),
        }),
        ('Coordinates', {
            'fields': ('latitude', 'longitude'),
            'description': 'Decimal degrees (e.g. 9.525500, 6.449800)',
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    # Override changelist template to inject the "Publish" button
    change_list_template = 'admin/locations/location/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('publish/', self.admin_site.admin_view(self.publish_view), name='locations_publish'),
            path('bulk-import/', self.admin_site.admin_view(self.bulk_import_view), name='locations_bulk_import'),
        ]
        return custom + urls

    def publish_view(self, request):
        """Triggered by the 'Publish Locations' button."""
        if request.method != 'POST':
            return HttpResponseRedirect('../')

        result = publish_locations(published_by=request.user)

        if result['success']:
            short = result['checksum'][:12]
            size_kb = round(result['size_bytes'] / 1024, 1)
            self.message_user(
                request,
                format_html(
                    '✅ Published <strong>v{version}</strong> — '
                    '{count} locations, {size_kb} KB compressed, '
                    'checksum: <code>{checksum}…</code>',
                    version=result['version'],
                    count=result['count'],
                    size_kb=size_kb,
                    checksum=short,
                ),
                messages.SUCCESS,
            )
        else:
            self.message_user(request, f'❌ Publish failed: {result["error"]}', messages.ERROR)

        return HttpResponseRedirect('../')

    def bulk_import_view(self, request):
        """Admin page to paste a JSON array and import locations."""
        from django.shortcuts import render

        if request.method == 'POST':
            form = BulkImportForm(request.POST)
            if form.is_valid():
                raw = form.cleaned_data['json_data']
                try:
                    records = json.loads(raw)
                    if not isinstance(records, list):
                        raise ValueError('Root element must be a JSON array.')
                except (json.JSONDecodeError, ValueError) as exc:
                    messages.error(request, f'Invalid JSON: {exc}')
                    return render(request, 'admin/locations/bulk_import.html', {'form': form})

                created = 0
                updated = 0
                errors = []
                for i, rec in enumerate(records):
                    try:
                        loc, was_created = Location.objects.update_or_create(
                            id=rec['id'],
                            defaults={
                                'name': rec['name'],
                                'description': rec.get('description', ''),
                                'latitude': rec['latitude'],
                                'longitude': rec['longitude'],
                                'category': rec['category'],
                                'is_active': rec.get('is_active', True),
                            },
                        )
                        if was_created:
                            created += 1
                        else:
                            updated += 1
                    except Exception as exc:
                        errors.append(f'Row {i}: {exc}')

                if errors:
                    messages.warning(request, 'Some rows failed: ' + '; '.join(errors[:5]))
                messages.success(
                    request,
                    f'Import complete — {created} created, {updated} updated.',
                )
                return HttpResponseRedirect('../../')
        else:
            form = BulkImportForm()

        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': 'Bulk Import Locations from JSON',
            'opts': self.model._meta,
        }
        return render(request, 'admin/locations/bulk_import.html', context)

    # ── Dropdown action for bulk import redirect ───────────────────────────────
    actions = ['action_bulk_import_redirect']

    @admin.action(description='Bulk Import from JSON (paste)')
    def action_bulk_import_redirect(self, request, queryset):
        return HttpResponseRedirect('bulk-import/')


# ── Snapshot Admin ─────────────────────────────────────────────────────────────

@admin.register(LocationSnapshot)
class LocationSnapshotAdmin(admin.ModelAdmin):
    list_display = ('version', 'is_current', 'location_count', 'size_kb', 'checksum_short', 'published_by', 'published_at')
    list_display_links = ('version',)
    readonly_fields = (
        'version', 'checksum', 'size_bytes', 'location_count', 'published_at', 'published_by', 'is_current',
    )
    ordering = ('-version',)

    def size_kb(self, obj):
        return f'{round(obj.size_bytes / 1024, 1)} KB'
    size_kb.short_description = 'Size'

    def checksum_short(self, obj):
        return mark_safe(f'<code>{obj.checksum[:16]}…</code>')
    checksum_short.short_description = 'Checksum'

    def has_add_permission(self, request):
        return False  # Snapshots are only created via the Publish button

    def has_change_permission(self, request, obj=None):
        return False  # Immutable records
