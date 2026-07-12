import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function ActivitiesPage() {
  const url = useExternalWebViewUrl('activities_url')
  return <GenericWebPage url={url} enablePullToRefresh={true} />
}
