import api from './api'
import { useSecurityStore } from './securityStore'

export const refreshTransactionPinStatus = async () => {
  const { setHasTransactionPin, setTransactionPinStatus } = useSecurityStore.getState()

  setTransactionPinStatus('loading')
  try {
    const response = await api.get('auth/settings/preferences/')
    const hasPin = Boolean(response.data?.has_pin)
    setHasTransactionPin(hasPin)
    setTransactionPinStatus('ready')
    return hasPin
  } catch (error) {
    setTransactionPinStatus('error')
    throw error
  }
}
