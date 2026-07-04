import { 
  Server, Shield, Users, Radio, Car, Map, CreditCard, Ticket, Bell, Settings,
  Smartphone, QrCode, Route, Medal, User, FileCheck, ListOrdered, Navigation, Banknote, AlertTriangle, PlaySquare, Calculator, Activity, BarChart
} from 'lucide-react'

export interface DocMenuItem {
  id: string
  label: string
  icon: any
}

export interface DocMenuGroup {
  groupLabel: string
  items: DocMenuItem[]
}

export type DocsMenuConfig = {
  admin: DocMenuGroup[]
  student: DocMenuGroup[]
  driver: DocMenuGroup[]
}

export const DOCS_MENU: DocsMenuConfig = {
  admin: [
    {
      groupLabel: 'Core Architecture',
      items: [
        { id: 'overview', label: 'Platform Overview', icon: Server },
        { id: 'auth', label: 'Login & Authentication', icon: Shield },
      ]
    },
    {
      groupLabel: 'Operations & Dispatch',
      items: [
        { id: 'dashboard', label: 'Dashboard (Live Ops)', icon: Activity },
        { id: 'dispatch', label: 'Dispatch Engine', icon: Car },
        { id: 'operations', label: 'Operations Hub', icon: Radio },
      ]
    },
    {
      groupLabel: 'User Verification',
      items: [
        { id: 'user_management', label: 'User Management', icon: Users },
        { id: 'kyc_driver', label: 'Driver Verification (KYC)', icon: FileCheck },
        { id: 'kyc_student', label: 'Account Verification', icon: Shield },
      ]
    },
    {
      groupLabel: 'Finance & Pricing',
      items: [
        { id: 'finance', label: 'Financial Hub', icon: CreditCard },
        { id: 'fare_engine', label: 'Fare Engine', icon: Calculator },
        { id: 'analytics', label: 'Analytics', icon: BarChart },
      ]
    },
    {
      groupLabel: 'System Configuration',
      items: [
        { id: 'notifications', label: 'Notification Center', icon: Bell },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'test_lab', label: 'Test Lab', icon: PlaySquare },
      ]
    }
  ],
  student: [
    {
      groupLabel: 'Getting Started',
      items: [
        { id: 'student_setup', label: 'Getting Started', icon: User },
        { id: 'student_home', label: 'Dashboard & Home', icon: Smartphone },
      ]
    },
    {
      groupLabel: 'Rides & Tracking',
      items: [
        { id: 'student_booking', label: 'Booking a Ride', icon: Map },
        { id: 'student_matching', label: 'Ride Matching', icon: Radio },
        { id: 'student_tracking', label: 'Active Ride & Tracking', icon: Route },
        { id: 'student_garage', label: 'Garage Rides (Scheduled)', icon: Car },
      ]
    },
    {
      groupLabel: 'Account & Payments',
      items: [
        { id: 'student_wallet', label: 'Wallet & Payments', icon: CreditCard },
        { id: 'student_notifications', label: 'Notifications', icon: Bell },
        { id: 'student_profile', label: 'Profile & Security', icon: Shield },
        { id: 'student_history', label: 'Ride History & Ratings', icon: Medal },
      ]
    }
  ],
  driver: [
    {
      groupLabel: 'Onboarding',
      items: [
        { id: 'driver_setup', label: 'Getting Started', icon: Smartphone },
        { id: 'driver_kyc', label: 'Account Verification', icon: FileCheck },
        { id: 'driver_vehicle', label: 'Vehicle Verification', icon: Car },
      ]
    },
    {
      groupLabel: 'Handling Rides',
      items: [
        { id: 'driver_home', label: 'Dashboard & Home', icon: Activity },
        { id: 'driver_requests', label: 'Receiving Ride Requests', icon: Radio },
        { id: 'driver_in_ride', label: 'In-Ride Operations', icon: Navigation },
        { id: 'driver_garage', label: 'Creating Garage Rides', icon: ListOrdered },
      ]
    },
    {
      groupLabel: 'Earnings & Account',
      items: [
        { id: 'driver_wallet', label: 'Wallet & Earnings', icon: Banknote },
        { id: 'driver_profile', label: 'Profile & Settings', icon: Settings },
      ]
    }
  ]
}
