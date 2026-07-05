import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.accounts.models import Campus
for c in Campus.objects.all():
    print(c.id, c.name)
