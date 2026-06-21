import os
import sys
import time
import django

# Set up Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.development")
django.setup()

from apps.accounts.models import User
from apps.accounts.serializers import FutminnaTokenObtainPairSerializer

# 1. Setup a test user
test_email = "latency.m1234567@st.futminna.edu.ng"
password = "SuperSecretPassword123!"

try:
    user = User.objects.get(email=test_email)
    user.set_password(password)
    user.save()
except User.DoesNotExist:
    user = User.objects.create_user(
        email=test_email,
        phone_number="+2348000000999",
        password=password,
        first_name="Latency",
        last_name="Test",
        role="student",
        is_active=True
    )

print(f"User created/updated with password hasher: {user.password.split('$')[0]}")

# 2. Measure login time directly through the serializer (bypass network)
serializer = FutminnaTokenObtainPairSerializer(data={"email": test_email, "password": password})
serializer.is_valid(raise_exception=False)

start_time = time.monotonic()
serializer = FutminnaTokenObtainPairSerializer(data={"email": test_email, "password": password})
is_valid = serializer.is_valid(raise_exception=False)
elapsed = (time.monotonic() - start_time) * 1000

print(f"Login valid: {is_valid}")
if not is_valid:
    print(serializer.errors)
print(f"Elapsed time (Backend processing only): {elapsed:.2f} ms")

# Clean up
user.delete()
