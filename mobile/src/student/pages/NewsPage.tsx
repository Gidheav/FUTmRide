import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function NewsPage() {
  return <GenericWebPage url={useExternalWebViewUrl('news_url')} enablePullToRefresh={true} />
}
