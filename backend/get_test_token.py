import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.development")
django.setup()

from apps.accounts.models import User
from rest_framework_simplejwt.tokens import RefreshToken
import time

email = f"test.upload{int(time.time())}@st.futminna.edu.ng"
password = "Password123!"

user = User.objects.create_user(
    email=email,
    phone_number=f"+23481{int(time.time()) % 100000000:08d}",
    password=password,
    first_name="Upload",
    last_name="Test",
    role="student",
    is_active=True,
    is_verified=True,
    is_email_verified=True
)

refresh = RefreshToken.for_user(user)
print(f"TOKEN={refresh.access_token}")
