"""
Upload FCM V1 Service Account Key to Expo project via GraphQL API.
"""
import json
import sys
import os
import requests

# ---- Config ----
EXPO_GRAPHQL = "https://api.expo.dev/graphql"
SA_KEY_PATH = r"C:\Users\DELL\Downloads\futride-student-firebase-adminsdk-fbsvc-c8eda0bead.json"
APP_FULL_NAME = "@heavpro/lr-ride-mobile"
PACKAGE_NAME = "com.lrride.mobile"

# ---- Auth ----
state_path = os.path.join(os.environ["USERPROFILE"], ".expo", "state.json")
with open(state_path) as f:
    state = json.load(f)

session_secret = state["auth"]["sessionSecret"]
if isinstance(session_secret, dict):
    session_cookie = json.dumps(session_secret)
else:
    session_cookie = session_secret

headers = {
    "Content-Type": "application/json",
    "expo-session": session_cookie,
}

# ---- Read SA key as dict (not string!) ----
with open(SA_KEY_PATH) as f:
    sa_key = json.load(f)

def gql(query, variables=None):
    r = requests.post(EXPO_GRAPHQL, json={"query": query, "variables": variables or {}}, headers=headers, timeout=30)
    data = r.json()
    if "errors" in data:
        print(f"  GQL Error: {json.dumps(data['errors'], indent=2)}")
        return data
    return data

# ---- Step 1: Get account + app IDs ----
print("[1/4] Getting account info...")
res = gql("""
query {
  meActor {
    ... on User {
      id
      accounts { id name }
    }
  }
}
""")
me = res["data"]["meActor"]
account_id = me["accounts"][0]["id"]
print(f"  Account: {me['accounts'][0]['name']} ({account_id})")

print("[2/4] Getting app info...")
res = gql("""
query($fullName: String!) {
  app { byFullName(fullName: $fullName) { id slug fullName } }
}
""", {"fullName": APP_FULL_NAME})
app_id = res["data"]["app"]["byFullName"]["id"]
print(f"  App ID: {app_id}")

# ---- Step 2: Upload the service account key (jsonKey must be JSONObject, i.e. dict) ----
print("[3/4] Uploading service account key...")
res = gql("""
mutation($accountId: ID!, $input: GoogleServiceAccountKeyInput!) {
  googleServiceAccountKey {
    createGoogleServiceAccountKey(accountId: $accountId, googleServiceAccountKeyInput: $input) {
      id
      projectIdentifier
      clientEmail
    }
  }
}
""", {
    "accountId": account_id,
    "input": {
        "jsonKey": sa_key  # Pass as dict/object, NOT as JSON string
    }
})

if "errors" in res:
    # Key might already exist, list existing keys
    print("  Key upload failed (might already exist). Listing existing keys...")
    res2 = gql("""
    query($accountName: String!) {
      account { byName(accountName: $accountName) {
        googleServiceAccountKeys { id projectIdentifier clientEmail }
      }}
    }
    """, {"accountName": "heavpro"})

    if "errors" not in res2:
        keys = res2["data"]["account"]["byName"]["googleServiceAccountKeys"]
        print(f"  Found {len(keys)} existing key(s)")
        gsa_key_id = None
        for k in keys:
            print(f"    - {k['id']}: {k.get('clientEmail', 'N/A')} ({k.get('projectIdentifier', 'N/A')})")
            if k.get("projectIdentifier") == "futride-student":
                gsa_key_id = k["id"]
        if not gsa_key_id and keys:
            gsa_key_id = keys[-1]["id"]
    else:
        print("  Could not list keys either. Exiting.")
        sys.exit(1)
else:
    created = res["data"]["googleServiceAccountKey"]["createGoogleServiceAccountKey"]
    gsa_key_id = created["id"]
    print(f"  Created key: {gsa_key_id} ({created.get('clientEmail', '')})")

print(f"  Using key ID: {gsa_key_id}")

# ---- Step 3: Get or create AndroidAppCredentials, then assign FCM key ----
print("[4/4] Linking key to app credentials...")

# Check existing credentials
res = gql("""
query($fullName: String!) {
  app { byFullName(fullName: $fullName) {
    id
    androidAppCredentials {
      id
      applicationIdentifier
      googleServiceAccountKeyForFcmV1 { id projectIdentifier clientEmail }
    }
  }}
}
""", {"fullName": APP_FULL_NAME})

app_creds = []
if "errors" not in res:
    app_creds = res["data"]["app"]["byFullName"]["androidAppCredentials"]

# Find matching credentials for our package
cred_id = None
for c in app_creds:
    if c["applicationIdentifier"] == PACKAGE_NAME:
        cred_id = c["id"]
        existing_key = c.get("googleServiceAccountKeyForFcmV1")
        if existing_key:
            print(f"  Already has FCM key: {existing_key.get('clientEmail', 'N/A')}")
        break

if cred_id:
    # Update existing
    print(f"  Updating existing credential {cred_id}...")
    res = gql("""
    mutation($credId: ID!, $keyId: ID!) {
      androidAppCredentials {
        setGoogleServiceAccountKeyForFcmV1(id: $credId, googleServiceAccountKeyId: $keyId) {
          id
          googleServiceAccountKeyForFcmV1 { id projectIdentifier clientEmail }
        }
      }
    }
    """, {"credId": cred_id, "keyId": gsa_key_id})
    if "errors" not in res:
        linked = res["data"]["androidAppCredentials"]["setGoogleServiceAccountKeyForFcmV1"]
        key_info = linked.get("googleServiceAccountKeyForFcmV1", {})
        print(f"  SUCCESS! FCM V1 key linked: {key_info.get('clientEmail', 'N/A')}")
    else:
        print("  Failed to set key on existing credentials.")
else:
    # Need to create credentials first
    print("  No credentials found for this package. Creating...")
    res = gql("""
    mutation($appId: ID!, $pkg: String!) {
      androidAppCredentials {
        createAndroidAppCredentials(
          androidAppCredentialsInput: {}
          appId: $appId
          applicationIdentifier: $pkg
        ) { id applicationIdentifier }
      }
    }
    """, {"appId": app_id, "pkg": PACKAGE_NAME})

    if "errors" not in res:
        cred_id = res["data"]["androidAppCredentials"]["createAndroidAppCredentials"]["id"]
        print(f"  Created credential: {cred_id}")

        # Now set the key
        res = gql("""
        mutation($credId: ID!, $keyId: ID!) {
          androidAppCredentials {
            setGoogleServiceAccountKeyForFcmV1(id: $credId, googleServiceAccountKeyId: $keyId) {
              id
              googleServiceAccountKeyForFcmV1 { id projectIdentifier clientEmail }
            }
          }
        }
        """, {"credId": cred_id, "keyId": gsa_key_id})
        if "errors" not in res:
            print("  SUCCESS! FCM V1 key linked.")
        else:
            print("  Failed to link key after creating credentials.")
    else:
        print("  Failed to create credentials.")

print("\nDone. Run push test to verify.")
