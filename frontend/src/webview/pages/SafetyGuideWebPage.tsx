import { ShieldAlert, Phone } from 'lucide-react'

export default function SafetyGuideWebPage() {
  const contacts = [
    {
      id: 1,
      name: "Campus Security (Main Gate)",
      phone: "+234 800 000 0001",
      emergency: true,
    },
    {
      id: 2,
      name: "University Clinic",
      phone: "+234 800 000 0002",
      emergency: true,
    },
    {
      id: 3,
      name: "Student Affairs Unit",
      phone: "+234 800 000 0003",
      emergency: false,
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-red-600 pt-12 pb-6 px-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Safety Guide</h1>
        </div>
        <p className="text-red-100 mt-2 text-sm">Emergency contacts and safety protocols on campus.</p>
      </header>
      
      <main className="px-5 mt-8 space-y-6">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Emergency Contacts</h2>
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{contact.name}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">{contact.phone}</p>
                </div>
                <a 
                  href={`tel:${contact.phone}`}
                  className={`p-3 rounded-full ${
                    contact.emergency ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <Phone className="w-5 h-5" />
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200">
          <h2 className="text-lg font-bold text-yellow-900 mb-2">Safety Protocol</h2>
          <p className="text-yellow-800 text-sm leading-relaxed">
            In the event of an emergency, remain calm and contact Campus Security immediately. Do not attempt to resolve violent situations on your own. Always carry your Student ID card.
          </p>
        </section>
      </main>
    </div>
  )
}
