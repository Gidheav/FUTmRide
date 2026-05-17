const fs = require('fs')
const path = require('path')

const EXPECTED_ANDROID_PACKAGE = 'com.lrride.mobile'

const args = new Set(process.argv.slice(2))
const ciMode = args.has('--ci')
const buildPlatform = process.env.EAS_BUILD_PLATFORM

if (ciMode && buildPlatform && buildPlatform !== 'android') {
  console.log(`[push-config] Skipped for ${buildPlatform} build.`)
  process.exit(0)
}

const localGoogleServicesFile = './google-services.json'
const configuredGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON

const fileCandidates = [
  configuredGoogleServicesFile,
  localGoogleServicesFile,
].filter(Boolean)

const resolvedGoogleServicesPath = fileCandidates
  .map((candidate) => path.resolve(process.cwd(), candidate))
  .find((candidatePath) => fs.existsSync(candidatePath))

if (!resolvedGoogleServicesPath) {
  console.error('[push-config] Missing Android Firebase config.')
  console.error('[push-config] Add ./google-services.json, or set GOOGLE_SERVICES_JSON as an EAS file variable.')
  console.error(
    `[push-config] The Firebase Android app package must be ${EXPECTED_ANDROID_PACKAGE}.`,
  )
  process.exit(1)
}

let googleServices
try {
  googleServices = JSON.parse(fs.readFileSync(resolvedGoogleServicesPath, 'utf8'))
} catch (error) {
  console.error(`[push-config] Could not parse ${resolvedGoogleServicesPath} as JSON.`)
  process.exit(1)
}

const clients = Array.isArray(googleServices.client) ? googleServices.client : []
const hasMatchingClient = clients.some(
  (client) =>
    client?.client_info?.android_client_info?.package_name === EXPECTED_ANDROID_PACKAGE,
)

if (!hasMatchingClient) {
  console.error(
    `[push-config] No Firebase client for ${EXPECTED_ANDROID_PACKAGE} was found in ${resolvedGoogleServicesPath}.`,
  )
  console.error(
    '[push-config] Download a google-services.json from Firebase that includes this package name.',
  )
  process.exit(1)
}

console.log(
  `[push-config] OK: ${path.basename(
    resolvedGoogleServicesPath,
  )} contains Firebase client for ${EXPECTED_ANDROID_PACKAGE}.`,
)
