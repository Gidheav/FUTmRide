import GenericWebPage from '../components/GenericWebPage'
import { useExternalWebViewUrl } from '../services/externalConfig'

export default function NewsPage() {
  const url = useExternalWebViewUrl('news_url')
  return <GenericWebPage url={url} enablePullToRefresh={true} />
}
