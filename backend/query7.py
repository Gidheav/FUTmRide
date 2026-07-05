import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.accounts.models import Campus
print([f.name for f in Campus._meta.fields])
