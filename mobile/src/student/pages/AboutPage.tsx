import { StyleSheet, Text, View } from 'react-native'

export default function AboutPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Student App</Text>
      <Text style={styles.title}>About FUTMRide</Text>
      <Text style={styles.subtitle}>
        The Development of an Application Software to Optimize Multi-Campus Transportation at Federal University of Technology, Minna, Nigeria.
      </Text>
      <Text style={styles.text}>
        FUTMRide is the student mobile application for requesting rides, tracking trips, managing wallet payments, and staying connected to campus transport operations.
      </Text>
      <Text style={styles.text}>
        It supports verified student mobility across campus routes by connecting riders to approved drivers through a secure and organized transport workflow.
      </Text>
      <Text style={styles.text}>
        Version 1.0.0
      </Text>
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
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#6A1B9A',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#6A1B9A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  text: {
    fontSize: 15,
    color: '#3d4a3e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
})
