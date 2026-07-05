import { Users } from 'lucide-react'

export default function ActivitiesWebPage() {
  const activities = [
    {
      id: 1,
      title: "Google Developer Student Clubs",
      category: "Tech & Innovation",
      status: "Recruiting",
    },
    {
      id: 2,
      title: "University Debate Society",
      category: "Public Speaking",
      status: "Active",
    },
    {
      id: 3,
      title: "Green Campus Initiative",
      category: "Environment",
      status: "Active",
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-emerald-600 pt-12 pb-6 px-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Activities</h1>
        </div>
        <p className="text-emerald-100 mt-2 text-sm">Join clubs, societies, and make an impact.</p>
      </header>
      
      <main className="px-5 mt-8 space-y-4">
        {activities.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{item.category}</span>
              <h2 className="text-lg font-bold text-gray-900 mt-1 mb-1 leading-tight">{item.title}</h2>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              item.status === 'Recruiting' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {item.status}
            </div>
          </div>
        ))}
        
        <button className="w-full mt-6 bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-sm active:bg-emerald-700 transition-colors">
          Browse All Clubs
        </button>
      </main>
    </div>
  )
}
