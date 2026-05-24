import React, { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Car, Save, Phone, Mail, User } from "lucide-react"
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
  ".main { max-width: 600px; margin: 0 auto; padding: 36px 40px; }" +
  ".avatar-row { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }" +
  ".avatar { width: 68px; height: 68px; border-radius: 50%; background: #007A47; display: flex; align-items: center; justify-content: center; font-family: ui-serif, Georgia, serif; font-size: 26px; color: #fff; flex-shrink: 0; }" +
  ".avatar-name { font-family: ui-serif, Georgia, serif; font-size: 22px; color: #0a0a0a; letter-spacing: -0.5px; }" +
  ".avatar-sub { font-size: 13px; color: #9ca3af; margin-top: 3px; }" +
  ".card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; padding: 26px; margin-bottom: 18px; }" +
  ".card-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 20px; }" +
  ".grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }" +
  ".field { margin-bottom: 16px; }" +
  ".field-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; display: flex; align-items: center; gap: 5px; }" +
  ".field-input { width: 100%; height: 46px; padding: 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0a0a0a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }" +
  ".field-input:focus { border-color: #007A47; background: #fff; }" +
  ".field-input:disabled { color: #9ca3af; cursor: not-allowed; background: #f9fafb; }" +
  ".save-btn { height: 48px; padding: 0 26px; background: #007A47; border: none; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }" +
  ".save-btn:hover:not(:disabled) { background: #006339; }" +
  ".save-btn:disabled { opacity: 0.55; cursor: not-allowed; }" +
  ".spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }" +
  "@keyframes spin { to { transform: rotate(360deg); } }" +
  "@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .grid2 { grid-template-columns: 1fr; } }"

export default function ProfilePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" })
  const [vform, setVform] = useState({ vehicle_make: "", vehicle_model: "", vehicle_year: "", vehicle_color: "", plate_number: "" })
  const [ready, setReady] = useState(false)

  const { data: me } = useQuery<any>({
    queryKey: ["driver-me"],
    queryFn: async () => { const r = await api.get("/users/me/"); return r.data },
  })

  const { data: dp } = useQuery<any>({
    queryKey: ["driver-profile-detail"],
    queryFn: async () => { const r = await api.get("/users/me/driver-profile/"); return r.data },
  })


  
  React.useEffect(() => {
    if (me && !ready) {
      setForm({ first_name: me.first_name, last_name: me.last_name, email: me.email || "" })
      setReady(true)
    }
  }, [me, ready])

  React.useEffect(() => {
    if (dp) {
      setVform({ vehicle_make: dp.vehicle_make||"", vehicle_model: dp.vehicle_model||"", vehicle_year: String(dp.vehicle_year||""), vehicle_color: dp.vehicle_color||"", plate_number: dp.plate_number||"" })
    }
  }, [dp])

  const profileMutation = useMutation({
    mutationFn: () => api.patch("/users/me/", form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["driver-me"] }); toast.success("Profile saved.") },
    onError: () => toast.error("Failed to save profile."),
  })

  const vehicleMutation = useMutation({
    mutationFn: () => api.patch("/users/me/driver-profile/", vform).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["driver-profile-detail"] }); toast.success("Vehicle info saved.") },
    onError: () => toast.error("Failed to save vehicle info."),
  })

  const initials = me ? `${me.first_name?.[0]||""}${me.last_name?.[0]||""}`.toUpperCase() : "?"

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/driver" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">My Profile</span>
        </nav>
        <main className="main">
          <div className="avatar-row">
            <div className="avatar">{initials}</div>
            <div>
              <div className="avatar-name">{me?.first_name} {me?.last_name}</div>
              <div className="avatar-sub">{me?.phone_number} &middot; Driver</div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Personal Information</div>
            <div className="grid2">
              <div className="field">
                <label className="field-label"><User size={11} /> First Name</label>
                <input className="field-input" value={form.first_name} onChange={e => setForm(f=>({...f,first_name:e.target.value}))} />
              </div>
              <div className="field">
                <label className="field-label"><User size={11} /> Last Name</label>
                <input className="field-input" value={form.last_name} onChange={e => setForm(f=>({...f,last_name:e.target.value}))} />
              </div>
            </div>
            <div className="field">
              <label className="field-label"><Mail size={11} /> Email</label>
              <input className="field-input" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="Optional" />
            </div>
            <div className="field">
              <label className="field-label"><Phone size={11} /> Phone</label>
              <input className="field-input" value={me?.phone_number||""} disabled />
            </div>
            <button className="save-btn" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? <><span className="spinner" /> Saving...</> : <><Save size={14} /> Save</>}
            </button>
          </div>
          <div className="card">
            <div className="card-title">Vehicle Information</div>
            <div className="grid2">
              <div className="field">
                <label className="field-label"><Car size={11} /> Make</label>
                <input className="field-input" value={vform.vehicle_make} onChange={e => setVform(f=>({...f,vehicle_make:e.target.value}))} placeholder="Toyota" />
              </div>
              <div className="field">
                <label className="field-label"><Car size={11} /> Model</label>
                <input className="field-input" value={vform.vehicle_model} onChange={e => setVform(f=>({...f,vehicle_model:e.target.value}))} placeholder="Corolla" />
              </div>
              <div className="field">
                <label className="field-label">Year</label>
                <input className="field-input" value={vform.vehicle_year} onChange={e => setVform(f=>({...f,vehicle_year:e.target.value}))} placeholder="2020" />
              </div>
              <div className="field">
                <label className="field-label">Color</label>
                <input className="field-input" value={vform.vehicle_color} onChange={e => setVform(f=>({...f,vehicle_color:e.target.value}))} placeholder="White" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Plate Number</label>
              <input className="field-input" value={vform.plate_number} onChange={e => setVform(f=>({...f,plate_number:e.target.value}))} placeholder="ABC-123-XY" />
            </div>
            <button className="save-btn" onClick={() => vehicleMutation.mutate()} disabled={vehicleMutation.isPending}>
              {vehicleMutation.isPending ? <><span className="spinner" /> Saving...</> : <><Save size={14} /> Save Vehicle</>}
            </button>
          </div>
        </main>
      </div>
    </>
  )
}