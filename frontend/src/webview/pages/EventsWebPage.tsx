import { Calendar } from 'lucide-react'

export default function EventsWebPage() {
  const events = [
    {
      id: 1,
      title: "Tech Innovation Summit 2026",
      date: "Nov 15, 2026",
      time: "09:00 AM",
      location: "Main Auditorium",
    },
    {
      id: 2,
      title: "Inter-Faculty Sports Final",
      date: "Nov 20, 2026",
      time: "03:00 PM",
      location: "University Sports Complex",
    },
    {
      id: 3,
      title: "Career Fair & Networking",
      date: "Dec 02, 2026",
      time: "10:00 AM",
      location: "Student Union Building",
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-blue-600 pt-12 pb-6 px-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Upcoming Events</h1>
        </div>
        <p className="text-blue-100 mt-2 text-sm">Don't miss out on what's happening around campus.</p>
      </header>
      
      <main className="px-5 mt-8 space-y-4">
        {events.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="bg-blue-50 text-blue-700 font-bold px-3 py-2 rounded-xl text-center min-w-[70px]">
              <div className="text-xs uppercase opacity-80">{item.date.split(' ')[0]}</div>
              <div className="text-xl">{item.date.split(' ')[1].replace(',', '')}</div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{item.title}</h2>
              <p className="text-gray-500 text-sm font-medium">{item.time}</p>
              <p className="text-gray-600 text-sm mt-1 flex items-center gap-1">
                <span className="text-xs">📍</span> {item.location}
              </p>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
