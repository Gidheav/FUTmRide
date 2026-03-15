export default function BookRidePage() {
  useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_type_requested: 'sedan',
      payment_method: 'cash',
    },
  })

  const selectedVehicle = watch('vehicle_type_requested')
  
  

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post('/rides/request/', data)
      return res.data
    },
    onSuccess: (data) => {
      if (data.status === 'cancelled_no_driver') {
        toast.error('No drivers available right now. Please try again.')
      } else {
        toast.success('Ride booked. Your driver is on the way.')
        navigate('/student/rides')
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || 'Booking failed. Please try again.'
      toast.error(msg)
    },
  })

  const selectLocation = (field: 'pickup' | 'dropoff', loc: typeof LOCATIONS[0]) => {
    if (field === 'pickup') {
      setValue('pickup_address', loc.label)
      setValue('pickup_latitude', loc.lat)
      setValue('pickup_longitude', loc.lng)
    } else {
      setValue('dropoff_address', loc.label)
      setValue('dropoff_latitude', loc.lat)
      setValue('dropoff_longitude', loc.lng)
    }
  }

  const fareMap: Record<string, number> = {
    motorcycle: 250, tricycle: 350, sedan: 600, suv: 800, minivan: 700,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f4f6f3; font-family: 'Instrument Sans', sans-serif; }

        .page { min-height: 100vh; background: #f4f6f3; }

        .nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }
        .nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff; color: #374151; cursor: pointer; text-decoration: none; transition: background 0.15s; }
        .nav-back:hover { background: #f4f6f3; }
        .nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }
        .nav-title { font-weight: 700; font-size: 16px; color: #0a0a0a; letter-spacing: -0.3px; }

        .main { max-width: 860px; margin: 0 auto; padding: 36px 40px; }

        .steps-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; }
        .step-item { display: flex; align-items: center; gap: 8px; }
        .step-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; transition: all 0.2s; }
        .step-num.active { background: #007A47; color: #fff; }
        .step-num.done { background: #f0fdf4; color: #007A47; border: 1.5px solid #bbf7d0; }
        .step-num.idle { background: #f3f4f6; color: #9ca3af; }
        .step-label { font-size: 13px; font-weight: 500; }
        .step-label.active { color: #007A47; }
        .step-label.idle { color: #9ca3af; }
        .step-sep { flex: 1; height: 1px; background: #e5e7eb; max-width: 40px; }

        .card { background: #fff; border-radius: 20px; border: 1px solid #eaeaea; overflow: hidden; }
        .card-head { padding: 24px 28px; border-bottom: 1px solid #f3f4f6; }
        .card-title { font-size: 16px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.3px; margin-bottom: 4px; }
        .card-sub { font-size: 13px; color: #9ca3af; }
        .card-body { padding: 28px; }

        .location-group { display: flex; flex-direction: column; gap: 0; }
        .location-field { position: relative; }
        .location-connector { display: flex; align-items: center; justify-content: center; height: 16px; }
        .connector-line { width: 1.5px; height: 16px; background: #e5e7eb; }

        .loc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .loc-input-wrap { position: relative; }
        .loc-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .loc-input { width: 100%; height: 52px; padding: 0 14px 0 42px; background: #f9fafb; border: 1.5px solid #e8e8e8; border-radius: 12px; font-family: 'Instrument Sans', sans-serif; font-size: 14px; color: #0a0a0a; outline: none; transition: border-color 0.15s, background 0.15s; box-sizing: border-box; }
        .loc-input:focus { border-color: #007A47; background: #fff; }
        .loc-input.err { border-color: #ef4444; }
        .field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }

        .quick-picks { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
        .quick-pick { padding: 5px 12px; background: #f4f6f3; border: 1px solid #e5e7eb; border-radius: 100px; font-size: 12px; font-weight: 500; color: #374151; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .quick-pick:hover { background: #f0fdf4; border-color: #bbf7d0; color: #007A47; }

        .vehicle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
        .vehicle-card { padding: 16px; border-radius: 14px; border: 1.5px solid #e8e8e8; cursor: pointer; transition: all 0.15s; background: #fff; text-align: left; }
        .vehicle-card:hover { border-color: #007A47; background: #f9fefb; }
        .vehicle-card.selected { border-color: #007A47; background: #f0fdf4; }
        .vehicle-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .vehicle-icon { width: 36px; height: 36px; border-radius: 9px; background: #f4f6f3; display: flex; align-items: center; justify-content: center; }
        .vehicle-card.selected .vehicle-icon { background: #dcfce7; }
        .vehicle-fare { font-size: 12px; font-weight: 700; color: #007A47; }
        .vehicle-name { font-size: 13px; font-weight: 700; color: #0a0a0a; margin-bottom: 2px; }
        .vehicle-desc { font-size: 11px; color: #9ca3af; }

        .pay-label { font-size: 12px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280; margin-bottom: 10px; }
        .pay-options { display: flex; gap: 8px; }
        .pay-option { flex: 1; padding: 12px 16px; border: 1.5px solid #e8e8e8; border-radius: 12px; font-family: 'Instrument Sans', sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; background: #fff; text-align: center; transition: all 0.15s; }
        .pay-option:hover { border-color: #007A47; color: #007A47; }
        .pay-option.selected { border-color: #007A47; background: #f0fdf4; color: #007A47; }

        .summary-box { background: #f9fafb; border: 1px solid #f0f0f0; border-radius: 14px; padding: 20px; margin-bottom: 20px; }
        .summary-row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .summary-row:last-child { border-bottom: none; padding-bottom: 0; }
        .summary-icon { width: 32px; height: 32px; border-radius: 8px; background: #fff; border: 1px solid #e8e8e8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .summary-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .summary-value { font-size: 14px; font-weight: 600; color: #0a0a0a; }
        .fare-box { background: #007A47; border-radius: 14px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .fare-label { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500; }
        .fare-value { font-family: 'Instrument Serif', serif; font-size: 32px; color: #fff; letter-spacing: -1px; }
        .fare-note { color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 2px; }

        .btn-row { display: flex; gap: 10px; }
        .btn-secondary { flex: 1; height: 50px; background: #fff; border: 1.5px solid #e8e8e8; border-radius: 12px; font-family: 'Instrument Sans', sans-serif; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s; }
        .btn-secondary:hover { background: #f4f6f3; }
        .btn-primary { flex: 2; height: 50px; background: #007A47; border: none; border-radius: 12px; font-family: 'Instrument Sans', sans-serif; font-size: 14px; font-weight: 700; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(0,122,71,0.28); transition: background 0.15s, transform 0.1s; }
        .btn-primary:hover:not(:disabled) { background: #006339; transform: translateY(-1px); }
        .btn-primary:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .nav { padding: 0 16px; }
          .main { padding: 24px 16px; }
          .vehicle-grid { grid-template-columns: 1fr 1fr; }
          .pay-options { flex-direction: column; }
        }
      `}</style>

      <div className="page">
        <nav className="nav">
          <Link to="/student" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Book a Ride</span>
        </nav>

        <main className="main">
          <div className="steps-bar">
            <div className="step-item">
              <div className={`step-num ${step === 1 ? 'active' : 'done'}`}>1</div>
              <span className={`step-label ${step === 1 ? 'active' : 'idle'}`}>Trip Details</span>
            </div>
            <div className="step-sep" />
            <div className="step-item">
              <div className={`step-num ${step === 2 ? 'active' : 'idle'}`}>2</div>
              <span className={`step-label ${step === 2 ? 'active' : 'idle'}`}>Confirm Ride</span>
            </div>
          </div>

          {step === 1 && (
            <form onSubmit={(e) => {
              e.preventDefault()
              handleSubmit(() => setStep(2))()
            }}>
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-head">
                  <div className="card-title">Where are you going?</div>
                  <div className="card-sub">Set your pickup and destination</div>
                </div>
                <div className="card-body">
                  <div className="location-group">
                    <div className="location-field">
                      <div className="loc-label">
                        <Navigation size={12} color="#007A47" /> Pickup
                      </div>
                      <div className="loc-input-wrap">
                        <span className="loc-icon"><MapPin size={16} color="#9ca3af" /></span>
                        <input
                          {...register('pickup_address')}
                          placeholder="Enter pickup location"
                          className={`loc-input${errors.pickup_address ? ' err' : ''}`}
                        />
                      </div>
                      {errors.pickup_address && <div className="field-error">{errors.pickup_address.message}</div>}
                      <div className="quick-picks">
                        {LOCATIONS.slice(0, 4).map(loc => (
                          <button key={loc.label} type="button" className="quick-pick" onClick={() => selectLocation('pickup', loc)}>
                            {loc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="location-connector"><div className="connector-line" /></div>

                    <div className="location-field">
                      <div className="loc-label">
                        <MapPin size={12} color="#dc2626" /> Destination
                      </div>
                      <div className="loc-input-wrap">
                        <span className="loc-icon"><MapPin size={16} color="#9ca3af" /></span>
                        <input
                          {...register('dropoff_address')}
                          placeholder="Enter destination"
                          className={`loc-input${errors.dropoff_address ? ' err' : ''}`}
                        />
                      </div>
                      {errors.dropoff_address && <div className="field-error">{errors.dropoff_address.message}</div>}
                      <div className="quick-picks">
                        {LOCATIONS.slice(1).map(loc => (
                          <button key={loc.label} type="button" className="quick-pick" onClick={() => selectLocation('dropoff', loc)}>
                            {loc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <input type="hidden" {...register('pickup_latitude')} />
                  <input type="hidden" {...register('pickup_longitude')} />
                  <input type="hidden" {...register('dropoff_latitude')} />
                  <input type="hidden" {...register('dropoff_longitude')} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-head">
                  <div className="card-title">Select Vehicle Type</div>
                  <div className="card-sub">Choose the ride that suits you</div>
                </div>
                <div className="card-body">
                  <div className="vehicle-grid">
                    {VEHICLES.map(v => (
                      <button
                        key={v.value}
                        type="button"
                        className={`vehicle-card${selectedVehicle === v.value ? ' selected' : ''}`}
                        onClick={() => setValue('vehicle_type_requested', v.value as any)}
                      >
                        <div className="vehicle-card-top">
                          <div className="vehicle-icon">
                            {v.value === 'motorcycle' || v.value === 'tricycle'
                              ? <Bike size={16} color={selectedVehicle === v.value ? '#007A47' : '#6b7280'} />
                              : <Car size={16} color={selectedVehicle === v.value ? '#007A47' : '#6b7280'} />
                            }
                          </div>
                          <span className="vehicle-fare">{v.fare}</span>
                        </div>
                        <div className="vehicle-name">{v.label}</div>
                        <div className="vehicle-desc">{v.desc}</div>
                      </button>
                    ))}
                  </div>

                  <div className="pay-label">Payment Method</div>
                  <div className="pay-options">
                    {(['cash', 'wallet', 'card'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`pay-option${watch('payment_method') === m ? ' selected' : ''}`}
                        onClick={() => setValue('payment_method', m)}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button type="submit" className="btn-primary">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-head">
                  <div className="card-title">Confirm Your Ride</div>
                  <div className="card-sub">Review details before booking</div>
                </div>
                <div className="card-body">
                  <div className="summary-box">
                    <div className="summary-row">
                      <div className="summary-icon"><Navigation size={14} color="#007A47" /></div>
                      <div>
                        <div className="summary-label">Pickup</div>
                        <div className="summary-value">{watch('pickup_address')}</div>
                      </div>
                    </div>
                    <div className="summary-row">
                      <div className="summary-icon"><MapPin size={14} color="#dc2626" /></div>
                      <div>
                        <div className="summary-label">Destination</div>
                        <div className="summary-value">{watch('dropoff_address')}</div>
                      </div>
                    </div>
                    <div className="summary-row">
                      <div className="summary-icon"><Car size={14} color="#6b7280" /></div>
                      <div>
                        <div className="summary-label">Vehicle</div>
                        <div className="summary-value">
                          {VEHICLES.find(v => v.value === selectedVehicle)?.label}
                        </div>
                      </div>
                    </div>
                    <div className="summary-row">
                      <div className="summary-icon"><ChevronDown size={14} color="#6b7280" /></div>
                      <div>
                        <div className="summary-label">Payment</div>
                        <div className="summary-value" style={{ textTransform: 'capitalize' }}>
                          {watch('payment_method')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="fare-box">
                    <div>
                      <div className="fare-label">Estimated Fare</div>
                      <div className="fare-value">
                        &#x20A6;{(fareMap[selectedVehicle] || 600).toLocaleString()}+
                      </div>
                      <div className="fare-note">Final fare may vary based on distance</div>
                    </div>
                    <Car size={32} color="rgba(255,255,255,0.3)" />
                  </div>

                  <div className="btn-row">
                    <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={mutation.isPending}
                      onClick={handleSubmit((data) => mutation.mutate(data))}
                    >
                      {mutation.isPending
                        ? <><div className="spinner" /> Booking...</>
                        : <>Confirm Booking <ArrowRight size={16} /></>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}