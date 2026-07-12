import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function SafetyGuidePage() {
  const url = useExternalWebViewUrl('safety_guide_url')
  return <GenericWebPage url={url} enablePullToRefresh={true} />
}
