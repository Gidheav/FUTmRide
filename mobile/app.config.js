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
  expo: { ...appJson.expo },
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
