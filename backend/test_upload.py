import requests
import io

BASE_URL = "http://127.0.0.1:8000/api/v1"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgyMzY0NDY5LCJpYXQiOjE3ODIzNjA4NjksImp0aSI6ImI3NDhlNTQwMWMyZjQzYWY4N2M5NTY5NDkzYzIwYjdjIiwidXNlcl9pZCI6IjJmZGRjNDE3LWY4MzctNDBlOS1iZTA0LTdmNDFhZTFiZjk4NCJ9.m6vWKPYhpI1ga2y6lEn1DmynicoMhszTst74mUF8Q2M"

session = requests.Session()
session.headers.update({"Authorization": f"Bearer {TOKEN}"})

dummy_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
files = {
    'profile_photo': ('dummy.png', io.BytesIO(dummy_image_data), 'image/png')
}

upload_resp = session.patch(f"{BASE_URL}/users/me/", files=files)

print(f"Upload response status: {upload_resp.status_code}")
print(f"Upload response body: {upload_resp.text}")
