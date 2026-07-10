import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function EventsPage() {
  return <GenericWebPage url={useExternalWebViewUrl('events_url')} enablePullToRefresh={true} />
}
