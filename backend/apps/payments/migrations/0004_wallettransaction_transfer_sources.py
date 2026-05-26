from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_rename_webhook_eve_gateway_1c2756_idx_webhook_eve_gateway_bf0918_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wallettransaction',
            name='source',
            field=models.CharField(
                choices=[
                    ('ride_payment', 'Ride Payment'),
                    ('ride_refund', 'Ride Refund'),
                    ('topup_paystack', 'Top-Up via Paystack'),
                    ('topup_flutterwave', 'Top-Up via Flutterwave'),
                    ('student_transfer_sent', 'Student Transfer Sent'),
                    ('student_transfer_received', 'Student Transfer Received'),
                    ('driver_earning', 'Driver Earning'),
                    ('driver_withdrawal', 'Driver Withdrawal'),
                    ('platform_commission', 'Platform Commission'),
                    ('promotion', 'Promotional Credit'),
                    ('admin_adjustment', 'Admin Adjustment'),
                ],
                max_length=30,
            ),
        ),
    ]
