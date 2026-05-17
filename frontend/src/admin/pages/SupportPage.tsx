import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, MessageSquare, CheckCircle, Clock, AlertCircle } from "lucide-react"
import toast from "react-hot-toast"
import api from "../../core/api"

const css = "" +
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }" +
  "body { background: #f4f6f3; font-family: system-ui, -apple-system, sans-serif; }" +
  ".page { min-height: 100vh; }" +
  ".nav { background: #0a0a0a; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }" +
  ".nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.6); text-decoration: none; }" +
  ".nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }" +
  ".nav-title { font-weight: 700; font-size: 16px; color: #fff; }" +
  ".main { max-width: 1000px; margin: 0 auto; padding: 36px 40px; }" +
  ".page-title { font-family: ui-serif, Georgia, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }" +
  ".page-sub { font-size: 14px; color: #9ca3af; margin-bottom: 24px; }" +
  ".toolbar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }" +
  ".filter-btn { padding: 7px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.15s; }" +
  ".filter-btn:hover { border-color: #007A47; color: #007A47; }" +
  ".filter-btn.active { background: #007A47; border-color: #007A47; color: #fff; }" +
  ".ticket-list { display: flex; flex-direction: column; gap: 10px; }" +
  ".ticket-card { background: #fff; border-radius: 14px; border: 1px solid #eaeaea; padding: 18px 22px; display: flex; align-items: flex-start; gap: 14px; transition: box-shadow 0.15s; }" +
  ".ticket-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }" +
  ".ticket-icon { width: 40px; height: 40px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
  ".ticket-body { flex: 1; min-width: 0; }" +
  ".ticket-ref { font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3px; }" +
  ".ticket-subject { font-size: 14px; font-weight: 600; color: #0a0a0a; margin-bottom: 4px; }" +
  ".ticket-meta { font-size: 12px; color: #9ca3af; }" +
  ".ticket-right { text-align: right; flex-shrink: 0; }" +
  ".status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }" +
  ".priority-pill { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600; margin-top: 5px; }" +
  ".resolve-btn { margin-top: 8px; padding: 5px 12px; background: #007A47; border: none; border-radius: 7px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; color: #fff; cursor: pointer; transition: background 0.15s; }" +
  ".resolve-btn:hover { background: #006339; }" +
  ".empty { padding: 60px; text-align: center; color: #9ca3af; font-size: 14px; }" +
  ".skeleton { background: #f3f4f6; border-radius: 14px; height: 80px; animation: shimmer 1.2s infinite; }" +
  "@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }" +
  ".pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }" +
  ".page-btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }" +
  ".page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }" +
  ".page-btn:disabled { opacity: 0.4; cursor: not-allowed; }" +
  ".page-info { font-size: 13px; color: #9ca3af; padding: 0 8px; }" +
  "@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } }"

const statusStyles: Record<string,{bg:string;color:string}> = {
  open: { bg: "#fefce8", color: "#ca8a04" },
  in_progress: { bg: "#eff6ff", color: "#2563eb" },
  resolved: { bg: "#f0fdf4", color: "#16a34a" },
  closed: { bg: "#f3f4f6", color: "#6b7280" },
}
const priorityStyles: Record<string,{bg:string;color:string}> = {
  low: { bg: "#f3f4f6", color: "#6b7280" },
  medium: { bg: "#fefce8", color: "#ca8a04" },
  high: { bg: "#fff7ed", color: "#ea580c" },
  urgent: { bg: "#fef2f2", color: "#dc2626" },
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"})

export default function SupportPage() {
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", status, page],
    queryFn: async () => {
      let url = `/support/admin/tickets/?page=${page}&page_size=15`
      if (status !== "all") url += `&status=${status}`
      const r = await api.get(url)
      return r.data
    },
    staleTime: 15000,
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/support/admin/tickets/${id}/`, { status: "resolved" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tickets"] }); toast.success("Ticket resolved.") },
    onError: () => toast.error("Failed to resolve ticket."),
  })

  const tickets = data?.results || []
  const pagination = data?.pagination
  const filters = ["all","open","in_progress","resolved","closed"]

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/admin" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Support Tickets</span>
        </nav>
        <main className="main">
          <h1 className="page-title">Support</h1>
          <p className="page-sub">{data?.pagination?.count ?? 0} total tickets</p>
          <div className="toolbar">
            {filters.map(f => (
              <button key={f} className={`filter-btn${status===f?" active":""}`} onClick={() => { setStatus(f); setPage(1) }}>
                {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty">No tickets found</div>
          ) : (
            <>
              <div className="ticket-list">
                {tickets.map((t: any) => {
                  const ss = statusStyles[t.status] || { bg:"#f3f4f6", color:"#6b7280" }
                  const ps = priorityStyles[t.priority] || { bg:"#f3f4f6", color:"#6b7280" }
                  return (
                    <div className="ticket-card" key={t.id}>
                      <div className="ticket-icon"><MessageSquare size={18} color="#007A47" /></div>
                      <div className="ticket-body">
                        <div className="ticket-ref">{t.reference} &middot; {t.category.replace("_"," ")}</div>
                        <div className="ticket-subject">{t.subject}</div>
                        <div className="ticket-meta">{t.submitted_by_name} &middot; {fmt(t.created_at)}</div>
                      </div>
                      <div className="ticket-right">
                        <span className="status-pill" style={{ background:ss.bg, color:ss.color }}>{t.status.replace("_"," ")}</span><br />
                        <span className="priority-pill" style={{ background:ps.bg, color:ps.color }}>{t.priority}</span>
                        {t.status === "open" && (
                          <div>
                            <button className="resolve-btn" onClick={() => resolveMutation.mutate(t.id)}>
                              <CheckCircle size={11} style={{ marginRight:"4px", verticalAlign:"middle" }} />Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {pagination && pagination.total_pages > 1 && (
                <div className="pagination">
                  <button className="page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}><ArrowLeft size={13} /> Prev</button>
                  <span className="page-info">Page {page} of {pagination.total_pages}</span>
                  <button className="page-btn" disabled={page===pagination.total_pages} onClick={() => setPage(p=>p+1)}>Next <ArrowRight size={13} /></button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}