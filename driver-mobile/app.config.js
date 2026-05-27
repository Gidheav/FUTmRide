const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')

const resolveConfigFilePath = (envVarName, fallbackRelativePath) => {
  const envPath = process.env[envVarName]
  if (envPath) return envPath

  const fallbackAbsolutePath = path.resolve(__dirname, fallbackRelativePath)
  if (fs.existsSync(fallbackAbsolutePath)) return fallbackRelativePath

  return undefined
}

const config = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo?.extra || {}),
      eas: {
        ...(appJson.expo?.extra?.eas || {}),
        projectId: 'd4610c13-8331-41ed-b74d-5457bc5f823e',
      },
    },
  },
}

const androidGoogleServicesFile = resolveConfigFilePath(
  'GOOGLE_SERVICES_JSON',
  './google-services.json',
)

if (androidGoogleServicesFile) {
  config.expo.android = {
    ...config.expo.android,
    googleServicesFile: androidGoogleServicesFile,
  }
}

const iosGoogleServicesFile = resolveConfigFilePath(
  'GOOGLE_SERVICE_INFO_PLIST',
  './GoogleService-Info.plist',
)

if (iosGoogleServicesFile) {
  config.expo.ios = {
    ...config.expo.ios,
    googleServicesFile: iosGoogleServicesFile,
  }
}

module.exports = config
