import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { User, ShieldCheck } from "lucide-react"
import api from "../../core/api"
import { useAuthStore } from "../../core/authStore"

const step1Schema = z.object({
  first_name: z.string().min(2, "First name required"),
  last_name: z.string().min(2, "Last name required"),
  phone_number: z.string().min(7, "Enter a valid phone number"),
  password: z.string().min(8, "Minimum 8 characters"),
  confirm_password: z.string(),
  data_consent_given: z.boolean().refine(v => v === true, "You must accept to continue"),
}).refine(d => d.password === d.confirm_password, { message: "Passwords do not match", path: ["confirm_password"] })

const step2Schema = z.object({
  vehicle_type: z.enum(["motorcycle", "tricycle", "sedan", "suv", "minivan"]),
  vehicle_make: z.string().min(2, "Vehicle make required"),
  vehicle_model: z.string().min(1, "Vehicle model required"),
  vehicle_year: z.number().min(2000).max(2026),
  vehicle_color: z.string().min(2, "Vehicle color required"),
  plate_number: z.string().min(4, "Plate number required"),
})

type Step1Data = z.infer<typeof step1Schema>
type Step2Data = z.infer<typeof step2Schema>

const css = "" +
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }" +
  "body { background: #f4f6f3; font-family: system-ui, -apple-system, sans-serif; }" +
  ".page { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }" +
  ".panel-left { background: #0a0a0a; position: relative; display: flex; flex-direction: column; padding: 52px; overflow: hidden; }" +
  ".panel-left-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 48px 48px; }" +
  ".panel-left-glow { position: absolute; bottom: -100px; left: -100px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(0,122,71,0.18) 0%, transparent 70%); }" +
  ".left-top { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; }" +
  ".logo-badge { width: 36px; height: 36px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; }" +
  ".logo-name { color: #fff; font-weight: 600; font-size: 17px; }" +
  ".driver-tag { background: rgba(0,122,71,0.3); border: 1px solid rgba(0,122,71,0.5); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #4ade80; text-transform: uppercase; }" +
  ".left-mid { position: relative; z-index: 2; margin-top: auto; margin-bottom: auto; padding: 60px 0; }" +
  ".headline { font-family: ui-serif, Georgia, serif; font-size: 44px; color: #fff; letter-spacing: -1.5px; line-height: 1.08; margin-bottom: 20px; }" +
  ".headline em { font-style: italic; color: rgba(255,255,255,0.4); }" +
  ".subline { color: rgba(255,255,255,0.45); font-size: 15px; line-height: 1.7; }" +
  ".steps { position: relative; z-index: 2; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 28px; display: flex; flex-direction: column; gap: 14px; }" +
  ".step { display: flex; align-items: center; gap: 12px; }" +
  ".step-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }" +
  ".step-num.done { background: rgba(0,122,71,0.3); border-color: rgba(0,122,71,0.5); color: #4ade80; }" +
  ".step-text { font-size: 13px; color: rgba(255,255,255,0.55); }" +
  ".step-text.done { color: #4ade80; }" +
  ".panel-right { background: #fff; display: flex; align-items: center; justify-content: center; padding: 52px; overflow-y: auto; }" +
  ".form-box { width: 100%; max-width: 400px; }" +
  ".form-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #007A47; margin-bottom: 12px; }" +
  ".form-title { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 6px; }" +
  ".form-sub { font-size: 14px; color: #9ca3af; margin-bottom: 28px; }" +
  ".field { margin-bottom: 16px; }" +
  ".field-label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 7px; }" +
  ".field-input { width: 100%; height: 48px; padding: 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0a0a0a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }" +
  ".field-input:focus { border-color: #007A47; background: #fff; }" +
  ".field-input.has-error { border-color: #ef4444; }" +
  ".field-select { width: 100%; height: 48px; padding: 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0a0a0a; outline: none; cursor: pointer; box-sizing: border-box; }" +
  ".field-select:focus { border-color: #007A47; }" +
  ".field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }" +
  ".input-wrap { position: relative; }" +
  ".show-btn { position: absolute; right: 0; top: 0; height: 48px; width: 44px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; }" +
  ".show-btn:hover { color: #007A47; }" +
  ".grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }" +
  ".consent { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 8px; padding: 12px; background: #f0fdf6; border: 1px solid #bbf7d0; border-radius: 10px; }" +
  ".consent-text { font-size: 12px; color: #374151; line-height: 1.6; }" +
  ".submit-btn { width: 100%; height: 50px; background: #007A47; border: none; border-radius: 10px; color: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; transition: background 0.2s; box-shadow: 0 4px 20px rgba(0,122,71,0.25); }" +
  ".submit-btn:hover:not(:disabled) { background: #006339; }" +
  ".submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }" +
  ".spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }" +
  "@keyframes spin { to { transform: rotate(360deg); } }" +
  ".footer { text-align: center; margin-top: 24px; font-size: 13px; color: #9ca3af; }" +
  ".footer a { color: #007A47; font-weight: 600; text-decoration: none; }" +
  "@media (max-width: 820px) { .page { grid-template-columns: 1fr; } .panel-left { display: none; } .panel-right { padding: 36px 24px; } .grid2 { grid-template-columns: 1fr; } }"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [userPhone, setUserPhone] = useState<string>("")
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { vehicle_type: "sedan", vehicle_year: 2020 },
  })

  const step1Mutation = useMutation({
    mutationFn: async (data: Step1Data) => {
      let phone = data.phone_number.trim()
      if (phone.startsWith("0") && phone.length === 11) phone = "+234" + phone.slice(1)
      const res = await api.post("/auth/register/", {
        ...data,
        phone_number: phone,
        role: "driver",
      })
      const loginRes = await api.post("/auth/login/", {
        phone_number: phone,
        password: data.password,
      })
      return { registerData: res.data, loginData: loginRes.data, phone }
    },
    onSuccess: async ({ registerData, loginData, phone }) => {
      setUserPhone(phone)
      const userRes = await api.get("/users/me/", {
        headers: { Authorization: `Bearer ${loginData.access}` },
      })
      setAuth(userRes.data, loginData.access, loginData.refresh)
      toast.success("Account created. Now add your vehicle details.")
      setStep(2)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || "Registration failed."
      toast.error(msg)
    },
  })

  const step2Mutation = useMutation({
    mutationFn: async (data: Step2Data) => {
      const res = await api.post("/users/me/driver-profile/create/", {
        ...data,
        vehicle_year: Number(data.vehicle_year),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success("Profile complete. Please verify your phone number.")
      navigate("/verify", { state: { phone: userPhone } })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || "Failed to save vehicle details."
      toast.error(msg)
    },
  })

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="panel-left">
          <div className="panel-left-grid" />
          <div className="panel-left-glow" />
          <div className="left-top">
            <div className="logo-badge">LR</div>
            <span className="logo-name">LR Ride</span>
            <span className="driver-tag">Driver</span>
          </div>
          <div className="left-mid">
            <h2 className="headline">Drive with<br /><em>LR Ride.</em></h2>
            <p className="subline">Join hundreds of drivers earning daily on the FUTMINNA campus and surrounding axis.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className={`step-num${step > 1 ? " done" : ""}`}>{step > 1 ? "✓" : "1"}</div>
              <span className={`step-text${step > 1 ? " done" : ""}`}>Create your account</span>
            </div>
            <div className="step">
              <div className={`step-num${step === 2 ? "" : ""}`}>2</div>
              <span className="step-text">Add vehicle details</span>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <span className="step-text">Await admin approval</span>
            </div>
          </div>
        </div>

        <div className="panel-right">
          <div className="form-box">
            {step === 1 ? (
              <>
                <div className="form-eyebrow">Step 1 of 2</div>
                <h1 className="form-title">Create your<br />driver account</h1>
                <p className="form-sub">Enter your personal details</p>
                <form onSubmit={form1.handleSubmit(d => { setStep1Data(d); step1Mutation.mutate(d) })}>
                  <div className="grid2">
                    <div className="field">
                      <div className="field-label">First Name</div>
                      <input {...form1.register("first_name")} className={`field-input${form1.formState.errors.first_name ? " has-error" : ""}`} placeholder="Musa" />
                      {form1.formState.errors.first_name && <div className="field-error">{form1.formState.errors.first_name.message}</div>}
                    </div>
                    <div className="field">
                      <div className="field-label">Last Name</div>
                      <input {...form1.register("last_name")} className={`field-input${form1.formState.errors.last_name ? " has-error" : ""}`} placeholder="Ibrahim" />
                      {form1.formState.errors.last_name && <div className="field-error">{form1.formState.errors.last_name.message}</div>}
                    </div>
                  </div>
                  <div className="field">
                    <div className="field-label">Phone Number</div>
                    <input {...form1.register("phone_number")} className={`field-input${form1.formState.errors.phone_number ? " has-error" : ""}`} placeholder="09031234567 or +2349031234567" />
                    {form1.formState.errors.phone_number && <div className="field-error">{form1.formState.errors.phone_number.message}</div>}
                  </div>
                  <div className="field">
                    <div className="field-label">Password</div>
                    <div className="input-wrap">
                      <input {...form1.register("password")} type={showPass ? "text" : "password"} className={`field-input${form1.formState.errors.password ? " has-error" : ""}`} placeholder="Min. 8 characters" style={{ paddingRight: "44px" }} />
                      <button type="button" className="show-btn" onClick={() => setShowPass(!showPass)}>{showPass ? "hide" : "show"}</button>
                    </div>
                    {form1.formState.errors.password && <div className="field-error">{form1.formState.errors.password.message}</div>}
                  </div>
                  <div className="field">
                    <div className="field-label">Confirm Password</div>
                    <div className="input-wrap">
                      <input {...form1.register("confirm_password")} type={showConfirm ? "text" : "password"} className={`field-input${form1.formState.errors.confirm_password ? " has-error" : ""}`} placeholder="Repeat password" style={{ paddingRight: "44px" }} />
                      <button type="button" className="show-btn" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? "hide" : "show"}</button>
                    </div>
                    {form1.formState.errors.confirm_password && <div className="field-error">{form1.formState.errors.confirm_password.message}</div>}
                  </div>
                  <div className="consent">
                    <input type="checkbox" id="consent" {...form1.register("data_consent_given")} style={{ width: "16px", height: "16px", accentColor: "#007A47", flexShrink: 0, marginTop: "1px" }} />
                    <label htmlFor="consent" className="consent-text">I agree to the processing of my personal data for ride services.</label>
                  </div>
                  {form1.formState.errors.data_consent_given && <div className="field-error">{form1.formState.errors.data_consent_given.message}</div>}
                  <button type="submit" className="submit-btn" disabled={step1Mutation.isPending}>
                    {step1Mutation.isPending ? <><span className="spinner" />Creating account...</> : "Continue to Step 2"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="form-eyebrow">Step 2 of 2</div>
                <h1 className="form-title">Your vehicle<br />details</h1>
                <p className="form-sub">Tell us about the vehicle you will be driving</p>
                <form onSubmit={form2.handleSubmit(d => step2Mutation.mutate(d))}>
                  <div className="field">
                    <div className="field-label">Vehicle Type</div>
                    <select {...form2.register("vehicle_type")} className="field-select">
                      <option value="motorcycle">Motorcycle (Okada)</option>
                      <option value="tricycle">Tricycle (Keke)</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="minivan">Minivan / Shuttle</option>
                    </select>
                  </div>
                  <div className="grid2">
                    <div className="field">
                      <div className="field-label">Make</div>
                      <input {...form2.register("vehicle_make")} className={`field-input${form2.formState.errors.vehicle_make ? " has-error" : ""}`} placeholder="Toyota" />
                      {form2.formState.errors.vehicle_make && <div className="field-error">{form2.formState.errors.vehicle_make.message}</div>}
                    </div>
                    <div className="field">
                      <div className="field-label">Model</div>
                      <input {...form2.register("vehicle_model")} className={`field-input${form2.formState.errors.vehicle_model ? " has-error" : ""}`} placeholder="Corolla" />
                      {form2.formState.errors.vehicle_model && <div className="field-error">{form2.formState.errors.vehicle_model.message}</div>}
                    </div>
                    <div className="field">
                      <div className="field-label">Year</div>
                      <input {...form2.register("vehicle_year", { valueAsNumber: true })} className={`field-input${form2.formState.errors.vehicle_year ? " has-error" : ""}`} placeholder="2020" type="number" />
                      {form2.formState.errors.vehicle_year && <div className="field-error">{form2.formState.errors.vehicle_year.message}</div>}
                    </div>
                    <div className="field">
                      <div className="field-label">Color</div>
                      <input {...form2.register("vehicle_color")} className={`field-input${form2.formState.errors.vehicle_color ? " has-error" : ""}`} placeholder="White" />
                      {form2.formState.errors.vehicle_color && <div className="field-error">{form2.formState.errors.vehicle_color.message}</div>}
                    </div>
                  </div>
                  <div className="field">
                    <div className="field-label">Plate Number</div>
                    <input {...form2.register("plate_number")} className={`field-input${form2.formState.errors.plate_number ? " has-error" : ""}`} placeholder="ABC-123-XY" />
                    {form2.formState.errors.plate_number && <div className="field-error">{form2.formState.errors.plate_number.message}</div>}
                  </div>
                  <button type="submit" className="submit-btn" disabled={step2Mutation.isPending}>
                    {step2Mutation.isPending ? <><span className="spinner" />Saving...</> : "Complete Registration"}
                  </button>
                </form>
              </>
            )}
            <div className="footer">
              Already have an account? <Link to="/driver/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}