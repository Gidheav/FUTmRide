import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { ArrowLeft, ArrowRight, MapPin, Car, Navigation, ChevronDown } from "lucide-react"
import api from "../../core/api"
import { useAuthStore } from "../../core/authStore"

const LOCATIONS = [
  { label: "Gidan Kwano Main Gate", lat: "9.0820", lng: "7.4891" },
  { label: "FUTMINNA Library", lat: "9.0751", lng: "7.4802" },
  { label: "School of Engineering", lat: "9.0763", lng: "7.4815" },
  { label: "School of Science", lat: "9.0748", lng: "7.4799" },
  { label: "Student Hostel A", lat: "9.0801", lng: "7.4856" },
  { label: "Student Hostel B", lat: "9.0808", lng: "7.4862" },
  { label: "Staff Quarters", lat: "9.0835", lng: "7.4900" },
  { label: "FUTMINNA Admin Block", lat: "9.0740", lng: "7.4780" },
  { label: "Bosso Campus Gate", lat: "9.0650", lng: "7.4700" },
  { label: "Minna Central", lat: "9.0620", lng: "7.4600" },
]

const VEHICLES = [
  { value: "motorcycle", label: "Motorcycle (Okada)", price: "From NGN 200" },
  { value: "tricycle", label: "Tricycle (Keke)", price: "From NGN 300" },
  { value: "sedan", label: "Sedan", price: "From NGN 500" },
  { value: "suv", label: "SUV", price: "From NGN 700" },
  { value: "minivan", label: "Minivan / Shuttle", price: "From NGN 800" },
]

const schema = z.object({
  pickup_address: z.string().min(3, "Select a pickup location"),
  pickup_latitude: z.string(),
  pickup_longitude: z.string(),
  dropoff_address: z.string().min(3, "Select a dropoff location"),
  dropoff_latitude: z.string(),
  dropoff_longitude: z.string(),
  vehicle_type_requested: z.string().min(1, "Select vehicle type"),
  payment_method: z.enum(["cash", "wallet"]),
})

type FormData = z.infer<typeof schema>

const css = "@import url(https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap);" +
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }" +
  "body { background: #f4f6f3; font-family: Instrument Sans, sans-serif; }" +
  ".page { min-height: 100vh; background: #f4f6f3; }" +
  ".nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }" +
  ".nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff; color: #374151; text-decoration: none; transition: background 0.15s; }" +
  ".nav-back:hover { background: #f4f6f3; }" +
  ".nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }" +
  ".nav-title { font-weight: 700; font-size: 16px; color: #0a0a0a; }" +
  ".main { max-width: 680px; margin: 0 auto; padding: 36px 40px; }" +
  ".page-title { font-family: Instrument Serif, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }" +
  ".page-sub { font-size: 14px; color: #9ca3af; margin-bottom: 28px; }" +
  ".card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; padding: 26px; margin-bottom: 18px; }" +
  ".card-title { font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 18px; }" +
  ".field { margin-bottom: 16px; position: relative; }" +
  ".field-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; display: flex; align-items: center; gap: 5px; }" +
  ".field-select { width: 100%; height: 48px; padding: 0 36px 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: Instrument Sans, sans-serif; font-size: 14px; color: #0a0a0a; outline: none; cursor: pointer; appearance: none; transition: border-color 0.15s; }" +
  ".field-select:focus { border-color: #007A47; background: #fff; }" +
  ".field-select.has-error { border-color: #ef4444; }" +
  ".select-arrow { position: absolute; right: 12px; bottom: 14px; pointer-events: none; }" +
  ".field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }" +
  ".location-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }" +
  ".loc-pill { padding: 6px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 100px; font-size: 12px; font-weight: 500; color: #16a34a; cursor: pointer; transition: all 0.15s; white-space: nowrap; }" +
  ".loc-pill:hover { background: #007A47; color: #fff; border-color: #007A47; }" +
  ".vehicle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }" +
  ".vehicle-card { padding: 14px; border-radius: 12px; border: 1.5px solid #e8e8e8; cursor: pointer; transition: all 0.15s; background: #fff; }" +
  ".vehicle-card:hover { border-color: #007A47; }" +
  ".vehicle-card.selected { border-color: #007A47; background: #f0fdf4; }" +
  ".vehicle-name { font-size: 13px; font-weight: 600; color: #0a0a0a; margin-bottom: 3px; }" +
  ".vehicle-price { font-size: 12px; color: #9ca3af; }" +
  ".payment-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }" +
  ".pay-card { padding: 14px; border-radius: 12px; border: 1.5px solid #e8e8e8; cursor: pointer; transition: all 0.15s; text-align: center; }" +
  ".pay-card:hover { border-color: #007A47; }" +
  ".pay-card.selected { border-color: #007A47; background: #f0fdf4; }" +
  ".pay-label { font-size: 13px; font-weight: 600; color: #0a0a0a; }" +
  ".pay-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }" +
  ".summary-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #f3f4f6; }" +
  ".summary-row:last-child { border-bottom: none; }" +
  ".summary-icon { width: 36px; height: 36px; background: #f0fdf4; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
  ".summary-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }" +
  ".summary-value { font-size: 14px; font-weight: 600; color: #0a0a0a; }" +
  ".submit-btn { width: 100%; height: 52px; background: #007A47; border: none; border-radius: 12px; color: #fff; font-family: Instrument Sans, sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; box-shadow: 0 4px 20px rgba(0,122,71,0.25); }" +
  ".submit-btn:hover:not(:disabled) { background: #006339; }" +
  ".submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }" +
  ".spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }" +
  "@keyframes spin { to { transform: rotate(360deg); } }" +
  "@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .vehicle-grid { grid-template-columns: 1fr; } }"

export default function BookRidePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1)
  const [selectedVehicle, setSelectedVehicle] = useState("sedan")
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "wallet">("cash")

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_type_requested: "sedan",
      payment_method: "cash",
    },
  })

  const pickup = watch("pickup_address")
  const dropoff = watch("dropoff_address")

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post("/rides/request/", data)
      return res.data
    },
    onSuccess: (data) => {
      toast.success("Ride requested! Finding you a driver...")
      navigate("/student")
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || "Failed to book ride."
      toast.error(msg)
    },
  })

  const setLocation = (field: "pickup" | "dropoff", loc: any) => {
    if (field === "pickup") {
      setValue("pickup_address", loc.label)
      setValue("pickup_latitude", loc.lat)
      setValue("pickup_longitude", loc.lng)
    } else {
      setValue("dropoff_address", loc.label)
      setValue("dropoff_latitude", loc.lat)
      setValue("dropoff_longitude", loc.lng)
    }
  }

  const onSubmit = (data: FormData) => {
    mutation.mutate({ ...data, vehicle_type_requested: selectedVehicle, payment_method: selectedPayment })
  }

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/student" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Book a Ride</span>
        </nav>

        <main className="main">
          <h1 className="page-title">Where to?</h1>
          <p className="page-sub">Select your pickup and destination</p>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="card">
              <div className="card-title">Locations</div>
              <div className="field">
                <div className="field-label"><Navigation size={11} /> Pickup Location</div>
                <div style={{ position: "relative" }}>
                  <select
                    className={`field-select${errors.pickup_address ? " has-error" : ""}`}
                    value={pickup || ""}
                    onChange={e => {
                      const loc = LOCATIONS.find(l => l.label === e.target.value)
                      if (loc) setLocation("pickup", loc)
                    }}
                  >
                    <option value="">Select pickup location</option>
                    {LOCATIONS.map(loc => <option key={loc.label} value={loc.label}>{loc.label}</option>)}
                  </select>
                  <span className="select-arrow"><ChevronDown size={15} color="#9ca3af" /></span>
                </div>
                {errors.pickup_address && <div className="field-error">{errors.pickup_address.message}</div>}
                <div className="location-pills">
                  {LOCATIONS.slice(0, 4).map(loc => (
                    <span key={loc.label} className="loc-pill" onClick={() => setLocation("pickup", loc)}>
                      {loc.label.split(" ").slice(0, 2).join(" ")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="field">
                <div className="field-label"><MapPin size={11} /> Dropoff Location</div>
                <div style={{ position: "relative" }}>
                  <select
                    className={`field-select${errors.dropoff_address ? " has-error" : ""}`}
                    value={dropoff || ""}
                    onChange={e => {
                      const loc = LOCATIONS.find(l => l.label === e.target.value)
                      if (loc) setLocation("dropoff", loc)
                    }}
                  >
                    <option value="">Select dropoff location</option>
                    {LOCATIONS.map(loc => <option key={loc.label} value={loc.label}>{loc.label}</option>)}
                  </select>
                  <span className="select-arrow"><ChevronDown size={15} color="#9ca3af" /></span>
                </div>
                {errors.dropoff_address && <div className="field-error">{errors.dropoff_address.message}</div>}
                <div className="location-pills">
                  {LOCATIONS.slice(4, 8).map(loc => (
                    <span key={loc.label} className="loc-pill" onClick={() => setLocation("dropoff", loc)}>
                      {loc.label.split(" ").slice(0, 2).join(" ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Vehicle Type</div>
              <div className="vehicle-grid">
                {VEHICLES.map(v => (
                  <div
                    key={v.value}
                    className={`vehicle-card${selectedVehicle === v.value ? " selected" : ""}`}
                    onClick={() => { setSelectedVehicle(v.value); setValue("vehicle_type_requested", v.value) }}
                  >
                    <Car size={18} color={selectedVehicle === v.value ? "#007A47" : "#9ca3af"} style={{ marginBottom: "6px" }} />
                    <div className="vehicle-name">{v.label}</div>
                    <div className="vehicle-price">{v.price}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Payment Method</div>
              <div className="payment-row">
                {(["cash", "wallet"] as const).map(p => (
                  <div
                    key={p}
                    className={`pay-card${selectedPayment === p ? " selected" : ""}`}
                    onClick={() => { setSelectedPayment(p); setValue("payment_method", p) }}
                  >
                    <div className="pay-label">{p === "cash" ? "Cash" : "Wallet"}</div>
                    <div className="pay-sub">{p === "cash" ? "Pay on arrival" : "Deducted from wallet"}</div>
                  </div>
                ))}
              </div>
            </div>

            {pickup && dropoff && (
              <div className="card">
                <div className="card-title">Trip Summary</div>
                <div className="summary-row">
                  <div className="summary-icon"><Navigation size={16} color="#007A47" /></div>
                  <div><div className="summary-label">From</div><div className="summary-value">{pickup}</div></div>
                </div>
                <div className="summary-row">
                  <div className="summary-icon"><MapPin size={16} color="#007A47" /></div>
                  <div><div className="summary-label">To</div><div className="summary-value">{dropoff}</div></div>
                </div>
                <div className="summary-row">
                  <div className="summary-icon"><Car size={16} color="#007A47" /></div>
                  <div>
                    <div className="summary-label">Vehicle</div>
                    <div className="summary-value">{VEHICLES.find(v => v.value === selectedVehicle)?.label}</div>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={mutation.isPending || !pickup || !dropoff}>
              {mutation.isPending ? <><span className="spinner" /> Finding driver...</> : <>Request Ride <ArrowRight size={16} /></>}
            </button>
          </form>
        </main>
      </div>
    </>
  )
}