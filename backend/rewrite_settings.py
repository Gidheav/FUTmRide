import re

with open('mobile/src/student/pages/NotificationSettingsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_state_def = '''type NotifPrefs = {
  notif_sound_enabled: boolean
  notif_ride_requested: boolean
  notif_driver_assigned: boolean
  notif_driver_en_route: boolean
  notif_driver_arrived: boolean
  notif_trip_started: boolean
  notif_trip_completed: boolean
  notif_ride_cancelled: boolean
  notif_wallet_credit: boolean
  notif_wallet_debit: boolean
  notif_promotions: boolean
  email_announcements: boolean
  email_transactions: boolean
  email_rides: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  notif_sound_enabled: false,
  notif_ride_requested: false,
  notif_driver_assigned: false,
  notif_driver_en_route: false,
  notif_driver_arrived: false,
  notif_trip_started: false,
  notif_trip_completed: false,
  notif_ride_cancelled: false,
  notif_wallet_credit: false,
  notif_wallet_debit: false,
  notif_promotions: false,
  email_announcements: false,
  email_transactions: false,
  email_rides: false,
}'''

code = re.sub(r'const STORAGE_KEY = \'@lr_notif_prefs\'.*?const DEFAULT_EMAIL_PREFS.*?\}', new_state_def, code, flags=re.DOTALL)

new_component = '''export default function StudentNotificationSettingsPage({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    api.get('auth/settings/preferences/')
      .then((res) => {
        if (res.data) {
          setPrefs((prev) => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const update = async (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSaving(true)
    try {
      await api.patch('auth/settings/preferences/', { [key]: value })
    } catch {
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }'''

code = re.sub(r'export default function StudentNotificationSettingsPage.*?const updateEmail = async.*?\}', new_component, code, flags=re.DOTALL)

# Map UI props to new state keys
code = code.replace("prefs.soundEnabled", "prefs.notif_sound_enabled")
code = code.replace("update('soundEnabled', v)", "void update('notif_sound_enabled', v)")

code = code.replace("prefs.rideRequested", "prefs.notif_ride_requested")
code = code.replace("update('rideRequested', v)", "void update('notif_ride_requested', v)")

code = code.replace("prefs.driverAssigned", "prefs.notif_driver_assigned")
code = code.replace("update('driverAssigned', v)", "void update('notif_driver_assigned', v)")

code = code.replace("prefs.driverEnRoute", "prefs.notif_driver_en_route")
code = code.replace("update('driverEnRoute', v)", "void update('notif_driver_en_route', v)")

code = code.replace("prefs.driverArrived", "prefs.notif_driver_arrived")
code = code.replace("update('driverArrived', v)", "void update('notif_driver_arrived', v)")

code = code.replace("prefs.tripStarted", "prefs.notif_trip_started")
code = code.replace("update('tripStarted', v)", "void update('notif_trip_started', v)")

code = code.replace("prefs.tripCompleted", "prefs.notif_trip_completed")
code = code.replace("update('tripCompleted', v)", "void update('notif_trip_completed', v)")

code = code.replace("prefs.rideCancelled", "prefs.notif_ride_cancelled")
code = code.replace("update('rideCancelled', v)", "void update('notif_ride_cancelled', v)")

code = code.replace("prefs.walletCredit", "prefs.notif_wallet_credit")
code = code.replace("update('walletCredit', v)", "void update('notif_wallet_credit', v)")

code = code.replace("prefs.walletDebit", "prefs.notif_wallet_debit")
code = code.replace("update('walletDebit', v)", "void update('notif_wallet_debit', v)")

code = code.replace("prefs.promotions", "prefs.notif_promotions")
code = code.replace("update('promotions', v)", "void update('notif_promotions', v)")

code = code.replace("emailPrefs.email_announcements", "prefs.email_announcements")
code = code.replace("updateEmail('email_announcements', v)", "update('email_announcements', v)")

code = code.replace("emailPrefs.email_transactions", "prefs.email_transactions")
code = code.replace("updateEmail('email_transactions', v)", "update('email_transactions', v)")

code = code.replace("emailPrefs.email_rides", "prefs.email_rides")
code = code.replace("updateEmail('email_rides', v)", "update('email_rides', v)")

code = code.replace("emailSaving", "saving")
code = code.replace("emailLoading", "loading")

code = code.replace("import AsyncStorage from '@react-native-async-storage/async-storage'\n", "")

with open('mobile/src/student/pages/NotificationSettingsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done!')
