import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function SafetyGuidePage() {
  return <GenericWebPage url={useExternalWebViewUrl('safety_guide_url')} />
}
