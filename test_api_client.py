import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.test import Client
from apps.accounts.models import User

def run_test():
    client = Client()
    
    # Get a campus admin user
    admin_user = User.objects.filter(role='campus_admin').first()
    if not admin_user:
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            print("No admin user found.")
            return
            
    print(f"Testing with user: {admin_user.email} (role: {admin_user.role}, is_staff: {admin_user.is_staff}, is_superuser: {admin_user.is_superuser})")
    
    client.force_login(admin_user)
    
    url = '/api/v1/rides/operations/passengers/live/'
    print(f"Requesting GET {url}...")
    response = client.get(url)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Response: {response.content.decode('utf-8')}")
    else:
        import json
        print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

if __name__ == "__main__":
    run_test()
