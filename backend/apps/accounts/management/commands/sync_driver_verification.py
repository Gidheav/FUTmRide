"""
Management command to sync DriverProfile.verification_status with AccountVerification.status.

Run once to fix existing drivers who were approved via AccountVerification
but whose DriverProfile.verification_status was never updated.

Usage:
    python manage.py sync_driver_verification
    python manage.py sync_driver_verification --dry-run
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Sync DriverProfile.verification_status from AccountVerification approval state.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be changed without applying any changes.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        from apps.verification.models import AccountVerification
        from apps.accounts.models import DriverProfile

        approved_avs = AccountVerification.objects.filter(
            status=AccountVerification.Status.APPROVED
        ).select_related('driver', 'driver__driver_profile')

        fixed = 0
        skipped = 0
        errors = 0

        for av in approved_avs:
            try:
                dp = av.driver.driver_profile
            except DriverProfile.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f'  SKIP — driver {av.driver.id} has no DriverProfile'
                    )
                )
                skipped += 1
                continue

            if dp.verification_status == DriverProfile.VerificationStatus.APPROVED:
                skipped += 1
                continue

            self.stdout.write(
                f'  {"[DRY RUN] " if dry_run else ""}FIX — driver {av.driver.full_name} '
                f'({av.driver.id}): {dp.verification_status!r} → approved'
            )

            if not dry_run:
                try:
                    dp.verification_status = DriverProfile.VerificationStatus.APPROVED
                    dp.verified_at = dp.verified_at or timezone.now()
                    dp.save(update_fields=['verification_status', 'verified_at'])
                    fixed += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'    ERROR: {e}'))
                    errors += 1
            else:
                fixed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. Fixed={fixed}, Skipped={skipped}, Errors={errors}'
                + (' (dry-run, no changes saved)' if dry_run else '')
            )
        )
