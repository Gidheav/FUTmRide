import { Newspaper } from 'lucide-react'

export default function NewsWebPage() {
  const news = [
    {
      id: 1,
      title: "New Semester Registration Open",
      date: "Oct 12, 2026",
      summary: "Registration for the 2026/2027 academic session has officially begun for all returning students.",
    },
    {
      id: 2,
      title: "Campus Wi-Fi Upgrade Completed",
      date: "Oct 10, 2026",
      summary: "The ICT center has completed the university-wide Wi-Fi infrastructure upgrade. Enjoy faster speeds.",
    },
    {
      id: 3,
      title: "Library Extended Hours",
      date: "Oct 05, 2026",
      summary: "In preparation for mid-terms, the main campus library will now remain open until 11:00 PM daily.",
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-[#121212] pt-12 pb-6 px-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-full">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campus News</h1>
        </div>
        <p className="text-gray-300 mt-2 text-sm">Stay updated with the latest university announcements.</p>
      </header>
      
      <main className="px-5 mt-8 space-y-4">
        {news.map((item) => (
          <article key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-xs font-semibold text-[#FF3B30] uppercase tracking-wider">{item.date}</span>
            <h2 className="text-lg font-bold text-gray-900 mt-1 mb-2 leading-tight">{item.title}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{item.summary}</p>
          </article>
        ))}
      </main>
    </div>
  )
}
