from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_integration_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='integrationsettings',
            name='payments_primary_gateway',
            field=models.CharField(choices=[('paystack', 'Paystack'), ('flutterwave', 'Flutterwave')], default='paystack', max_length=20),
        ),
    ]
