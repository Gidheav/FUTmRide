"""
One-time management command to seed the Location table from the bundled JSON file.

Usage:
    python manage.py import_locations
    python manage.py import_locations --file /path/to/custom.json
    python manage.py import_locations --update   # update existing records
    python manage.py import_locations --dry-run  # preview only, no DB writes

Campus is left NULL on all imported records.
Assign campus via Django admin after import if needed.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

# Default path relative to the manage.py directory (backend/)
DEFAULT_JSON_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / \
    'mobile' / 'src' / 'student' / 'Gk-location cordinate.json'

VALID_CATEGORIES = {
    'lecture', 'hostel', 'gate', 'library', 'blocks',
    'medical', 'sports', 'ict', 'canteen', 'mosque', 'laboratory',
}


class Command(BaseCommand):
    help = (
        'Import campus locations from the bundled JSON file into the Location database table. '
        'Campus FK is left NULL — assign via admin after import.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default=None,
            help='Path to the JSON file (defaults to the bundled mobile locations file)',
        )
        parser.add_argument(
            '--update',
            action='store_true',
            default=False,
            help='Update existing records if IDs already exist (default: skip duplicates)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Preview what would be imported without making any DB changes',
        )

    def handle(self, *args, **options):
        from apps.locations.models import Location

        # ── Resolve file path ──────────────────────────────────────────────────
        file_path = Path(options['file']) if options['file'] else DEFAULT_JSON_PATH

        if not file_path.exists():
            raise CommandError(
                f'JSON file not found at: {file_path}\n'
                'Pass --file /path/to/locations.json to specify a custom path.'
            )

        self.stdout.write(f'Reading from: {file_path}')

        # ── Load and parse ─────────────────────────────────────────────────────
        try:
            with open(file_path, encoding='utf-8') as fh:
                records = json.load(fh)
        except json.JSONDecodeError as exc:
            raise CommandError(f'Invalid JSON: {exc}')

        if not isinstance(records, list):
            raise CommandError('JSON root element must be an array.')

        self.stdout.write(f'Found {len(records)} records in file.')

        # ── Dry-run mode ───────────────────────────────────────────────────────
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('DRY RUN — no database changes will be made.\n'))
            for i, rec in enumerate(records):
                self.stdout.write(
                    f'  [{i+1:03}] id={rec.get("id","?")!r}  '
                    f'name={rec.get("name","?")!r}  '
                    f'category={rec.get("category","?")!r}'
                )
            self.stdout.write(self.style.SUCCESS('\nDry run complete.'))
            return

        # ── Import ─────────────────────────────────────────────────────────────
        created = 0
        updated = 0
        skipped = 0
        errors = []

        for i, rec in enumerate(records):
            row_num = i + 1
            loc_id = rec.get('id', '').strip()

            if not loc_id:
                errors.append(f'Row {row_num}: missing "id" field — skipped.')
                continue

            required = ('name', 'latitude', 'longitude', 'category')
            missing = [f for f in required if f not in rec]
            if missing:
                errors.append(f'Row {row_num} (id={loc_id!r}): missing fields {missing} — skipped.')
                continue

            category = str(rec['category']).strip().lower()
            if category not in VALID_CATEGORIES:
                errors.append(
                    f'Row {row_num} (id={loc_id!r}): unknown category {category!r} — skipped. '
                    f'Valid: {sorted(VALID_CATEGORIES)}'
                )
                continue

            defaults = {
                'name': str(rec['name']).strip(),
                'description': str(rec.get('description', '')).strip(),
                'latitude': rec['latitude'],
                'longitude': rec['longitude'],
                'category': category,
                'is_active': bool(rec.get('is_active', True)),
                # campus left NULL intentionally — assign via admin
            }

            try:
                if options['update']:
                    obj, was_created = Location.objects.update_or_create(
                        id=loc_id, defaults=defaults
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1
                else:
                    if Location.objects.filter(id=loc_id).exists():
                        skipped += 1
                        continue
                    Location.objects.create(id=loc_id, **defaults)
                    created += 1

            except Exception as exc:
                errors.append(f'Row {row_num} (id={loc_id!r}): DB error — {exc}')

        # ── Summary ────────────────────────────────────────────────────────────
        self.stdout.write('' + '-' * 50)
        self.stdout.write(self.style.SUCCESS(f'  Created : {created}'))
        if options['update']:
            self.stdout.write(self.style.SUCCESS(f'  Updated : {updated}'))
        if skipped:
            self.stdout.write(self.style.WARNING(f'  Skipped : {skipped} (already exist — use --update to overwrite)'))
        if errors:
            self.stdout.write(self.style.ERROR(f'  Errors  : {len(errors)}'))
            for err in errors:
                self.stdout.write(self.style.ERROR(f'     {err}'))
        self.stdout.write('-' * 50)
        self.stdout.write(
            '\nDone. Campus FK is NULL on all imported records. '
            'Assign campus via Django admin -> Locations if needed.\n'
            'When ready, click "Publish Locations" in admin to push to the mobile app.'
        )
