import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function ActivitiesPage() {
  return <GenericWebPage url={useExternalWebViewUrl('activities_url')} enablePullToRefresh={true} />
}
