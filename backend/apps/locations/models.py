from django.conf import settings
from django.db import models


class LocationCategory(models.TextChoices):
    LECTURE = 'lecture', 'Lecture Theatre'
    HOSTEL = 'hostel', 'Hostel'
    GATE = 'gate', 'Gate'
    LIBRARY = 'library', 'Library'
    BLOCKS = 'blocks', 'Admin / General Block'
    MEDICAL = 'medical', 'Medical Centre'
    SPORTS = 'sports', 'Sports Facility'
    ICT = 'ict', 'ICT Centre'
    CANTEEN = 'canteen', 'Canteen / Cafeteria'
    MOSQUE = 'mosque', 'Mosque'
    LABORATORY = 'laboratory', 'Laboratory'


class Location(models.Model):
    """
    A named campus location with coordinates.
    Uses a short string primary key (e.g. "lt1", "h-male-a") that is stable
    across publishes so the mobile app can diff records if needed.
    Campus FK is optional — assign via admin after import.
    """
    id = models.CharField(primary_key=True, max_length=20)
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=300)
    latitude = models.DecimalField(max_digits=12, decimal_places=8)
    longitude = models.DecimalField(max_digits=12, decimal_places=8)
    category = models.CharField(
        max_length=30,
        choices=LocationCategory.choices,
        db_index=True,
    )
    campus = models.ForeignKey(
        'accounts.Campus',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locations',
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'locations'
        ordering = ['category', 'name']
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'

    def __str__(self):
        return f'{self.name} ({self.category})'


class LocationSnapshot(models.Model):
    """
    A versioned, gzip-compressed JSON snapshot of all active locations.
    Only one row is current at any time (is_current=True).
    Table is pruned to the last 3 rows on every publish.
    Data is stored as bytes directly in Postgres — no S3 or media files needed
    since the compressed payload is typically under 10KB.
    """
    version = models.PositiveIntegerField(unique=True)
    checksum = models.CharField(max_length=64)   # SHA-256 hex digest of gzipped bytes
    size_bytes = models.PositiveIntegerField()
    published_at = models.DateTimeField(auto_now_add=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='location_snapshots',
    )
    data = models.BinaryField()   # raw gzipped JSON bytes
    location_count = models.PositiveIntegerField(default=0)  # number of locations in this snapshot
    is_current = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'location_snapshots'
        ordering = ['-version']
        verbose_name = 'Location Snapshot'
        verbose_name_plural = 'Location Snapshots'

    def __str__(self):
        return f'Snapshot v{self.version} ({self.size_bytes} bytes, current={self.is_current})'

    @classmethod
    def get_current(cls):
        """Return the currently active snapshot, or None."""
        return cls.objects.filter(is_current=True).first()
