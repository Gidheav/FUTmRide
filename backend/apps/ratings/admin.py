from django.contrib import admin
from .models import Rating


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ['ride', 'rater', 'ratee', 'rating_type', 'score', 'created_at']
    list_filter = ['rating_type', 'score']
    search_fields = ['rater__phone_number', 'ratee__phone_number', 'ride__reference']
    readonly_fields = ['id', 'created_at']