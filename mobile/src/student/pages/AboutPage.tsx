import { StyleSheet, Text, View } from 'react-native'

export default function AboutPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About LR Ride</Text>
      <Text style={styles.text}>Version 1.0.0</Text>
      <Text style={styles.text}>LR Ride is the official transit application for FUTMINNA students, providing safe, reliable, and convenient campus transportation.</Text>
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
    lineHeight: 22,
    marginBottom: 8,
  },
})
