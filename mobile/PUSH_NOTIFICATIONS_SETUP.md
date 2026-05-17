# Android Push Notification Setup (Student Mobile)

This app already includes `expo-notifications` and push-token registration.  
To enable Android push in development or production builds, complete the checklist below.

## 1) Firebase app must match package name

- Android package in this app: `com.lrride.mobile`
- In Firebase, create/select Android app with package name: `com.lrride.mobile`
- Download `google-services.json`

## 2) Provide `google-services.json` to builds

Use one of these:

- Local file: place it at `mobile/google-services.json`
- EAS file variable: create `GOOGLE_SERVICES_JSON` and upload the JSON file

`app.config.js` is already configured to use:

- `process.env.GOOGLE_SERVICES_JSON` (preferred for EAS)
- fallback: `./google-services.json` (local file)

## 3) Validate before building

Run:

```bash
npm run check:push-config
```

It verifies:

- `google-services.json` exists
- it includes the Firebase client for `com.lrride.mobile`

## 4) EAS profiles already mapped

`eas.json` now pins env selection:

- `development` -> `environment: "development"`
- `preview` -> `environment: "preview"`
- `production` -> `environment: "production"`

## 5) Build

```bash
eas build -p android --profile development
```

If native push config changed, reinstall the new build on device before retesting notifications.
