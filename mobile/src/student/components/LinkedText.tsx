/**
 * LinkedText
 *
 * Renders a string of text and automatically detects URLs within it.
 * URLs are underlined and tappable — tapping opens the in-app browser
 * via WebPageContext (useWebPage). No hardcoding. No configuration needed.
 *
 * Usage:
 *   <LinkedText text="Check out https://example.com for more info" style={styles.body} />
 */
import { Text, type TextStyle } from 'react-native'
import { useWebPage } from '../context/WebPageContext'

const URL_REGEX = /(https?:\/\/[^\s]+)/g

type Segment = { type: 'text' | 'url'; value: string }

function parseSegments(text: string): Segment[] {
  const parts = text.split(URL_REGEX)
  return parts.map((part) => ({
    type: /^https?:\/\/[^\s]+$/.test(part) ? 'url' : 'text',
    value: part,
  }))
}

type Props = {
  text: string
  style?: TextStyle | TextStyle[]
  linkColor?: string
}

export default function LinkedText({ text, style, linkColor = '#6A1B9A' }: Props) {
  const { openWebPage } = useWebPage()
  const segments = parseSegments(text)

  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        seg.type === 'url' ? (
          <Text
            key={i}
            style={{ color: linkColor, textDecorationLine: 'underline', fontWeight: '600' }}
            onPress={() => openWebPage(seg.value)}
            suppressHighlighting
          >
            {seg.value}
          </Text>
        ) : (
          <Text key={i}>{seg.value}</Text>
        ),
      )}
    </Text>
  )
}
