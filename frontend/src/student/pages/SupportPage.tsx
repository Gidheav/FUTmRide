import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, MessageSquare, Plus, Send } from "lucide-react"
import toast from "react-hot-toast"
import api from "../../core/api"

const css = "" +
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }" +
  "body { background: #f4f6f3; font-family: var(--font-sans); }" +
  ".page { min-height: 100vh; }" +
  ".nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }" +
  ".nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff; color: #374151; text-decoration: none; }" +
  ".nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }" +
  ".nav-title { font-weight: 700; font-size: 16px; color: #0a0a0a; }" +
  ".nav-spacer { flex: 1; }" +
  ".new-btn { display: flex; align-items: center; gap: 7px; background: #007A47; color: #fff; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; font-family: var(--font-sans); }" +
  ".new-btn:hover { background: #006339; }" +
  ".main { max-width: 720px; margin: 0 auto; padding: 36px 40px; }" +
  ".page-title { font-family: var(--font-serif); font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }" +
  ".page-sub { font-size: 14px; color: #9ca3af; margin-bottom: 28px; }" +
  ".form-card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; padding: 26px; margin-bottom: 24px; }" +
  ".form-title { font-size: 14px; font-weight: 700; color: #0a0a0a; margin-bottom: 20px; }" +
  ".field { margin-bottom: 16px; }" +
  ".field-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }" +
  ".field-input { width: 100%; height: 46px; padding: 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: var(--font-sans); font-size: 14px; color: #0a0a0a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }" +
  ".field-input:focus { border-color: #007A47; background: #fff; }" +
  ".field-select { width: 100%; height: 46px; padding: 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: var(--font-sans); font-size: 14px; color: #0a0a0a; outline: none; cursor: pointer; }" +
  ".field-textarea { width: 100%; padding: 12px 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: var(--font-sans); font-size: 14px; color: #0a0a0a; outline: none; resize: vertical; min-height: 100px; transition: border-color 0.15s; box-sizing: border-box; }" +
  ".field-textarea:focus { border-color: #007A47; background: #fff; }" +
  ".submit-btn { height: 48px; padding: 0 26px; background: #007A47; border: none; border-radius: 10px; font-family: var(--font-sans); font-size: 14px; font-weight: 700; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }" +
  ".submit-btn:hover:not(:disabled) { background: #006339; }" +
  ".submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }" +
  ".ticket-list { display: flex; flex-direction: column; gap: 10px; }" +
  ".ticket-card { background: #fff; border-radius: 14px; border: 1px solid #eaeaea; padding: 16px 20px; display: flex; align-items: center; gap: 14px; }" +
  ".ticket-icon { width: 38px; height: 38px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
  ".ticket-ref { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 3px; }" +
  ".ticket-subject { font-size: 13.5px; font-weight: 600; color: #0a0a0a; margin-bottom: 2px; }" +
  ".ticket-date { font-size: 12px; color: #9ca3af; }" +
  ".status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }" +
  ".empty { text-align: center; padding: 48px; color: #9ca3af; font-size: 14px; }" +
  ".spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }" +
  "@keyframes spin { to { transform: rotate(360deg); } }" +
  "@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } }"

const statusStyles: Record<string,{bg:string;color:string}> = {
  open: { bg:"#fefce8", color:"#ca8a04" },
  in_progress: { bg:"#eff6ff", color:"#2563eb" },
  resolved: { bg:"#f0fdf4", color:"#16a34a" },
  closed: { bg:"#f3f4f6", color:"#6b7280" },
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"})

export default function SupportPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category:"ride_issue", subject:"", description:"", priority:"medium" })

  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => { const r = await api.get("/support/tickets/mine/"); return r.data },
  })

  const mutation = useMutation({
    mutationFn: () => api.post("/support/tickets/", form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tickets"] })
      toast.success("Ticket submitted. We will respond shortly.")
      setShowForm(false)
      setForm({ category:"ride_issue", subject:"", description:"", priority:"medium" })
    },
    onError: () => toast.error("Failed to submit ticket."),
  })

  const tickets = data?.results || []

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/student" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Support</span>
          <div className="nav-spacer" />
          <button className="new-btn" onClick={() => setShowForm(f=>!f)}><Plus size={14} /> New Ticket</button>
        </nav>
        <main className="main">
          <h1 className="page-title">Support</h1>
          <p className="page-sub">Get help with rides, payments, or your account</p>
          {showForm && (
            <div className="form-card">
              <div className="form-title">Submit a Ticket</div>
              <div className="field">
                <div className="field-label">Category</div>
                <select className="field-select" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                  <option value="ride_issue">Ride Issue</option>
                  <option value="payment_issue">Payment Issue</option>
                  <option value="driver_complaint">Driver Complaint</option>
                  <option value="account_issue">Account Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <div className="field-label">Subject</div>
                <input className="field-input" value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))} placeholder="Brief summary of your issue" />
              </div>
              <div className="field">
                <div className="field-label">Description</div>
                <textarea className="field-textarea" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Describe your issue in detail..." />
              </div>
              <button className="submit-btn" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.subject || !form.description}>
                {mutation.isPending ? <><span className="spinner" /> Submitting...</> : <><Send size={14} /> Submit Ticket</>}
              </button>
            </div>
          )}
          {isLoading ? (
            <div style={{ background:"#f3f4f6", borderRadius:"14px", height:"80px", animation:"shimmer 1.2s infinite" }} />
          ) : tickets.length === 0 ? (
            <div className="empty">No tickets yet. Use the button above to get help.</div>
          ) : (
            <div className="ticket-list">
              {tickets.map((t: any) => {
                const ss = statusStyles[t.status] || { bg:"#f3f4f6", color:"#6b7280" }
                return (
                  <div className="ticket-card" key={t.id}>
                    <div className="ticket-icon"><MessageSquare size={17} color="#007A47" /></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="ticket-ref">{t.reference}</div>
                      <div className="ticket-subject">{t.subject}</div>
                      <div className="ticket-date">{fmt(t.created_at)}</div>
                    </div>
                    <span className="status-pill" style={{ background:ss.bg, color:ss.color }}>{t.status.replace("_"," ")}</span>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </>
  )
}