from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0005_driver_wallet_payouts'),
    ]

    operations = [
        migrations.AddField(
            model_name='gatewaytransaction',
            name='wallet_credited',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
