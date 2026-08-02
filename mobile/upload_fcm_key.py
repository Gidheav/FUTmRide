"""
Upload FCM V1 Service Account Key to Expo via the Expo GraphQL API.
This script:
  1. Reads your local EAS session token
  2. Gets the Android app credential for your project
  3. Creates/updates the FCM V1 service account key
"""
import json
import os
import re
import subprocess
import sys

SERVICE_ACCOUNT_PATH = r"C:\Users\DELL\Downloads\futride-student-firebase-adminsdk-fbsvc-7438fb7f99.json"
PROJECT_ID = "9c583883-3a9d-4f4c-b8cf-c5778a44cb99"
EXPO_API = "https://api.expo.dev/graphql"


def get_session_token():
    """Read the EAS session secret from the local config."""
    candidates = [
        os.path.expanduser(r"~\.expo\state.json"),
        os.path.expanduser(r"~\AppData\Roaming\expo\state.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            session = data.get("auth", {}).get("sessionSecret")
            if session:
                # It's stored as a JSON string of an object — encode it back
                if isinstance(session, dict):
                    token = json.dumps(session)
                else:
                    token = session
                print(f"[OK] Found session in {path}")
                return token
    return None


def graphql(session_secret, query, variables=None):
    import urllib.request
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    # Expo API accepts the session secret as a cookie
    cookie_val = urllib.parse.quote(session_secret) if isinstance(session_secret, str) else session_secret
    req = urllib.request.Request(
        EXPO_API,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Cookie": f"expo-session={cookie_val}",
            "expo-client-id": "eas-cli",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    # 1. Read service account JSON
    with open(SERVICE_ACCOUNT_PATH) as f:
        service_account_json = f.read()
    print(f"[OK] Read service account: {SERVICE_ACCOUNT_PATH}")

    # 2. Get session token
    token = get_session_token()
    if not token:
        print("[ERROR] Could not find Expo session token.")
        print("  Run: npx eas-cli whoami (to verify you are logged in)")
        sys.exit(1)

    # 3. Get app credential ID for this project + Android platform
    print(f"[..] Fetching Android app credential for project {PROJECT_ID}...")
    query_app = """
    query GetAppCredentials($appId: String!) {
      app {
        byId(appId: $appId) {
          id
          androidAppCredentials {
            id
            applicationIdentifier
            androidFcmV1Key {
              id
            }
          }
        }
      }
    }
    """
    result = graphql(token, query_app, {"appId": PROJECT_ID})
    errors = result.get("errors")
    if errors:
        print(f"[ERROR] GraphQL error: {errors}")
        sys.exit(1)

    app_creds = result["data"]["app"]["byId"]["androidAppCredentials"]
    print(f"[OK] Found {len(app_creds)} Android app credential(s)")

    if not app_creds:
        # Create app credential first
        print("[..] No Android credential found. Creating one...")
        create_cred = """
        mutation CreateAndroidAppCredentials($appId: String!, $bundleIdentifier: String!) {
          androidAppCredentials {
            createAndroidAppCredentials(appId: $appId, applicationIdentifier: $bundleIdentifier) {
              id
              applicationIdentifier
            }
          }
        }
        """
        r = graphql(token, create_cred, {
            "appId": PROJECT_ID,
            "bundleIdentifier": "com.lrride.mobile",
        })
        if r.get("errors"):
            print(f"[ERROR] {r['errors']}")
            sys.exit(1)
        cred_id = r["data"]["androidAppCredentials"]["createAndroidAppCredentials"]["id"]
        existing_fcm_id = None
    else:
        cred = app_creds[0]
        cred_id = cred["id"]
        fcm_v1 = cred.get("androidFcmV1Key")
        existing_fcm_id = fcm_v1["id"] if fcm_v1 else None

    print(f"[OK] Android credential ID: {cred_id}")
    if existing_fcm_id:
        print(f"[OK] Existing FCM V1 key ID: {existing_fcm_id} (will be replaced)")

    # 4. Delete existing FCM V1 key if present
    if existing_fcm_id:
        print("[..] Removing existing FCM V1 key...")
        delete_q = """
        mutation DeleteAndroidFcmKey($id: ID!) {
          androidFcmV1Key {
            deleteAndroidFcmKey(id: $id) {
              id
            }
          }
        }
        """
        r = graphql(token, delete_q, {"id": existing_fcm_id})
        if r.get("errors"):
            print(f"[WARN] Could not delete old key: {r['errors']}")
        else:
            print("[OK] Old FCM V1 key deleted")

    # 5. Create new FCM V1 key
    print("[..] Uploading new FCM V1 service account key...")
    create_q = """
    mutation CreateAndroidFcmKey($appCredentialId: ID!, $serviceAccountKeyJsonString: String!) {
      androidFcmV1Key {
        createAndroidFcmKey(
          androidAppCredentialsId: $appCredentialId,
          serviceAccountKeyJsonString: $serviceAccountKeyJsonString
        ) {
          id
          createdAt
          keyId
        }
      }
    }
    """
    r = graphql(token, create_q, {
        "appCredentialId": cred_id,
        "serviceAccountKeyJsonString": service_account_json,
    })
    if r.get("errors"):
        print(f"[ERROR] Upload failed: {r['errors']}")
        sys.exit(1)

    new_key = r["data"]["androidFcmV1Key"]["createAndroidFcmKey"]
    print(f"\n✅ SUCCESS! FCM V1 key uploaded.")
    print(f"   Key ID  : {new_key['id']}")
    print(f"   Key ID  : {new_key.get('keyId', 'N/A')}")
    print(f"   Created : {new_key['createdAt']}")
    print("\nWallet push notifications will now work correctly on Android!")


if __name__ == "__main__":
    main()
