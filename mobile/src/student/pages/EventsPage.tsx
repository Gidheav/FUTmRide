import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function EventsPage() {
  const url = useExternalWebViewUrl('events_url')
  return <GenericWebPage url={url} enablePullToRefresh={true} />
}
