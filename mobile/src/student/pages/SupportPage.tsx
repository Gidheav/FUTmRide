import { StyleSheet, Text, View } from 'react-native'

export default function SupportPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.text}>Contact support for any issues or questions regarding your rides.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6A1B9A',
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: '#3d4a3e',
    textAlign: 'center',
  },
})
