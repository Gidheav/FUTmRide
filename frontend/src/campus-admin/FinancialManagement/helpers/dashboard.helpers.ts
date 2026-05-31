// ─────────────────────────────────────────────────────────────────────────────
// dashboard.helpers.ts
// Pure utility functions for FinancialDashboard ("The Observatory")
// ─────────────────────────────────────────────────────────────────────────────

// ─── Currency formatters ──────────────────────────────────────────────────────

export const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

export const fmtK = (n: number) =>
  n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B`
  : n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `₦${(n / 1e3).toFixed(0)}K`
  : `₦${n}`;

// ─── CSS injection ────────────────────────────────────────────────────────────

let _css = false;
export function injectObservatoryCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');

    .obs { font-family:'JetBrains Mono',monospace; }
    .obs.dark {
      --bg0:#020617;--bg1:#0a1628;--bg2:#0f172a;--bg3:#1e293b;--bg4:#334155;
      --em:#10b981;--em2:#34d399;--em3:#6ee7b7;--emd:rgba(16,185,129,0.12);--emg:rgba(16,185,129,0.28);
      --t1:#f1f5f9;--t2:#94a3b8;--t3:#475569;--t4:#1e293b;
      --border:rgba(16,185,129,0.2);--b2:rgba(51,65,85,0.5);
      --red:#f43f5e;--amber:#f59e0b;--blue:#3b82f6;--purple:#a855f7;--cyan:#06b6d4;
      --card:rgba(10,22,40,0.85);--shadow:0 4px 24px rgba(0,0,0,0.5);--shadowem:0 0 24px rgba(16,185,129,0.18);
    }
    .obs.light {
      --bg0:#edfdf6;--bg1:#f0fdf4;--bg2:#ffffff;--bg3:#dcfce7;--bg4:#bbf7d0;
      --em:#059669;--em2:#10b981;--em3:#34d399;--emd:rgba(5,150,105,0.09);--emg:rgba(5,150,105,0.2);
      --t1:#0f172a;--t2:#374151;--t3:#6b7280;--t4:#d1fae5;
      --border:rgba(5,150,105,0.28);--b2:rgba(209,250,229,0.6);
      --red:#e11d48;--amber:#d97706;--blue:#2563eb;--purple:#9333ea;--cyan:#0891b2;
      --card:rgba(255,255,255,0.92);--shadow:0 4px 20px rgba(0,0,0,0.06);--shadowem:0 0 20px rgba(5,150,105,0.12);
    }

    /* ROOT LAYOUT */
    .obs-root{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg0);color:var(--t1);}
    .obs-ticker-bar{height:32px;display:flex;align-items:center;background:var(--bg1);border-bottom:1px solid var(--border);overflow:hidden;flex-shrink:0;position:relative;}
    .obs-ticker-fade-l{position:absolute;left:80px;top:0;bottom:0;width:40px;background:linear-gradient(90deg,var(--bg1),transparent);z-index:2;pointer-events:none;}
    .obs-ticker-fade-r{position:absolute;right:0;top:0;bottom:0;width:60px;background:linear-gradient(270deg,var(--bg1),transparent);z-index:2;pointer-events:none;}
    .obs-ticker-label{flex-shrink:0;padding:0 14px;font-size:10px;font-weight:700;letter-spacing:0.15em;color:var(--em);text-transform:uppercase;border-right:1px solid var(--border);}
    .obs-ticker-scroll{flex:1;overflow:hidden;white-space:nowrap;}
    .obs-ticker-inner{display:inline-flex;gap:36px;animation:obs-ticker 40s linear infinite;padding-left:20px;}
    @keyframes obs-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    .obs-ticker-item{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--t3);}
    .obs-ticker-item b{color:var(--t1);font-weight:600;}
    .obs-ticker-item .up{color:var(--em);}
    .obs-ticker-item .dn{color:var(--red);}

    .obs-topbar{height:52px;display:flex;align-items:center;gap:12px;padding:0 18px;background:var(--bg1);border-bottom:1px solid var(--border);flex-shrink:0;z-index:90;}
    .obs-logo{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;letter-spacing:-0.02em;white-space:nowrap;background:linear-gradient(135deg,var(--em),var(--em2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .obs-logo-sub{font-size:10px;font-weight:400;color:var(--t3);-webkit-text-fill-color:var(--t3);margin-left:2px;}
    .obs-divv{width:1px;height:22px;background:var(--b2);margin:0 4px;}
    .obs-search-wrap{flex:1;max-width:380px;display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--b2);border-radius:8px;padding:0 12px;height:34px;transition:border-color .2s;}
    .obs-search-wrap:focus-within{border-color:var(--em);}
    .obs-search-wrap input{background:none;border:none;outline:none;color:var(--t1);font-family:inherit;font-size:12px;width:100%;}
    .obs-search-wrap input::placeholder{color:var(--t3);}
    .obs-search-icon{color:var(--t3);font-size:13px;flex-shrink:0;}
    .obs-topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
    .obs-ibtn{width:34px;height:34px;border-radius:8px;border:1px solid var(--b2);background:var(--bg2);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t2);transition:all .15s;font-size:15px;position:relative;}
    .obs-ibtn:hover{background:var(--emd);color:var(--em);border-color:var(--border);}
    .obs-ibtn .dot{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--red);border:2px solid var(--bg1);}
    .obs-theme-btn{display:flex;align-items:center;gap:6px;padding:0 12px;height:34px;border-radius:8px;border:1px solid var(--border);background:var(--emd);cursor:pointer;color:var(--em);font-size:11px;font-family:inherit;font-weight:700;transition:all .15s;white-space:nowrap;letter-spacing:0.05em;}
    .obs-theme-btn:hover{background:var(--em);color:#fff;}
    .obs-live-chip{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--em);letter-spacing:0.1em;text-transform:uppercase;}
    .obs-live-dot{width:7px;height:7px;border-radius:50%;background:var(--em);animation:obs-livepulse 1.4s ease-out infinite;}
    @keyframes obs-livepulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}70%{box-shadow:0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
    .obs-clock{font-size:11px;color:var(--t3);font-variant-numeric:tabular-nums;white-space:nowrap;}

    /* BODY */
    .obs-body{display:flex;flex:1;overflow:hidden;}
    .obs-sidebar{width:210px;flex-shrink:0;background:var(--bg1);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:12px 0 20px;overscroll-behavior:contain;}
    .obs-sidebar::-webkit-scrollbar{width:3px;}
    .obs-sidebar::-webkit-scrollbar-thumb{background:var(--em);border-radius:2px;}
    .obs-main{flex:1;overflow-y:auto;background:var(--bg0);padding:20px 22px;}
    .obs-main::-webkit-scrollbar{width:4px;}
    .obs-main::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
    .obs-rpanel{width:268px;flex-shrink:0;background:var(--bg1);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain;}

    /* SIDEBAR NAV */
    .obs-nav-group{padding:0 10px 6px;margin-bottom:2px;}
    .obs-nav-sect-label{font-size:9.5px;font-weight:700;letter-spacing:0.16em;color:var(--t3);text-transform:uppercase;padding:6px 10px 4px;}
    .obs-nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;color:var(--t2);transition:all .15s;margin-bottom:1px;border:1px solid transparent;user-select:none;}
    .obs-nav-item:hover{background:var(--emd);color:var(--t1);}
    .obs-nav-item.act{background:var(--emd);color:var(--em);border-color:var(--border);font-weight:600;}
    .obs-nav-icon{font-size:15px;width:20px;text-align:center;flex-shrink:0;}
    .obs-nav-label{flex:1;}
    .obs-nav-badge{font-size:9px;padding:1px 6px;border-radius:10px;font-weight:800;background:var(--red);color:#fff;}
    .obs-nav-badge.g{background:var(--em);}
    .obs-nav-score{font-size:11px;font-weight:700;color:var(--em);}

    .obs-sidebar-bottom{margin-top:auto;padding:10px 10px 0;border-top:1px solid var(--b2);margin-top:12px;}
    .obs-mini-stat{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;font-size:11px;}
    .obs-mini-stat-label{color:var(--t3);}
    .obs-mini-stat-val{color:var(--t1);font-weight:700;}

    /* MAIN CARDS */
    .obs-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:var(--shadow);backdrop-filter:blur(8px);position:relative;overflow:hidden;}
    .obs-card:hover{border-color:var(--em);box-shadow:var(--shadowem);}
    .obs-card-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
    .obs-card-title{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.09em;}
    .obs-card-badge{font-size:10px;padding:2px 8px;border-radius:20px;background:var(--emd);color:var(--em);border:1px solid var(--border);}
    .obs-card-badge.red{background:rgba(244,63,94,.12);color:var(--red);border-color:rgba(244,63,94,.3);}
    .obs-card-badge.amber{background:rgba(245,158,11,.12);color:var(--amber);border-color:rgba(245,158,11,.3);}
    .obs-card-badge.blue{background:rgba(59,130,246,.12);color:var(--blue);border-color:rgba(59,130,246,.3);}
    .obs-card-badge.purple{background:rgba(168,85,247,.12);color:var(--purple);border-color:rgba(168,85,247,.3);}
    .obs-card-stripe{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--em),var(--em2));}

    /* KPI GRID */
    .obs-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;}
    .obs-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;position:relative;overflow:hidden;cursor:pointer;transition:all .2s;box-shadow:var(--shadow);}
    .obs-kpi:hover{transform:translateY(-2px);border-color:var(--em);box-shadow:var(--shadowem);}
    .obs-kpi-accent{position:absolute;top:0;left:0;right:0;height:3px;}
    .obs-kpi-icon{position:absolute;right:12px;top:12px;font-size:22px;opacity:.12;}
    .obs-kpi-label{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;}
    .obs-kpi-value{font-family:'Syne',sans-serif;font-size:21px;font-weight:800;color:var(--t1);margin-bottom:5px;font-variant-numeric:tabular-nums;line-height:1.1;}
    .obs-kpi-sub{font-size:11px;display:flex;align-items:center;gap:5px;}
    .obs-up{color:var(--em);}
    .obs-dn{color:var(--red);}
    .obs-neu{color:var(--t3);}
    .obs-kpi-spark{margin-top:8px;}

    /* GRIDS */
    .obs-g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
    .obs-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
    .obs-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px;}
    .obs-g21{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;}
    .obs-g12{display:grid;grid-template-columns:1fr 2fr;gap:14px;margin-bottom:14px;}
    .obs-g31{display:grid;grid-template-columns:3fr 1fr;gap:14px;margin-bottom:14px;}
    .obs-g13{display:grid;grid-template-columns:1fr 3fr;gap:14px;margin-bottom:14px;}
    .obs-gmb{margin-bottom:14px;}

    /* SECTION */
    .obs-section-hd{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
    .obs-section-accent{width:4px;height:22px;background:linear-gradient(180deg,var(--em),transparent);border-radius:2px;}
    .obs-section-title{font-family:'Syne',sans-serif;font-size:19px;font-weight:800;color:var(--t1);letter-spacing:-.02em;}
    .obs-section-desc{font-size:11px;color:var(--t3);margin-left:2px;}
    .obs-section-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
    .obs-tab-group{display:flex;gap:4px;background:var(--bg2);border-radius:8px;padding:3px;}
    .obs-tab-btn{padding:4px 12px;border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;border:none;background:none;color:var(--t3);font-weight:600;transition:all .15s;}
    .obs-tab-btn.act{background:var(--emd);color:var(--em);}

    /* TABLES */
    .obs-tbl{width:100%;border-collapse:collapse;font-size:12px;}
    .obs-tbl th{text-align:left;padding:7px 10px;color:var(--t3);border-bottom:1px solid var(--b2);font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.1em;white-space:nowrap;}
    .obs-tbl td{padding:8px 10px;border-bottom:1px solid var(--b2);color:var(--t2);vertical-align:middle;}
    .obs-tbl tr:last-child td{border-bottom:none;}
    .obs-tbl tr:hover td{background:var(--emd);color:var(--t1);}
    .obs-td-em{color:var(--em)!important;font-weight:700;}
    .obs-td-red{color:var(--red)!important;}
    .obs-td-amber{color:var(--amber)!important;}
    .obs-td-blue{color:var(--blue)!important;}

    /* PILLS */
    .obs-pill{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;}
    .obs-pill.g{background:rgba(16,185,129,.14);color:var(--em);border:1px solid rgba(16,185,129,.3);}
    .obs-pill.r{background:rgba(244,63,94,.14);color:var(--red);border:1px solid rgba(244,63,94,.3);}
    .obs-pill.a{background:rgba(245,158,11,.14);color:var(--amber);border:1px solid rgba(245,158,11,.3);}
    .obs-pill.b{background:rgba(59,130,246,.14);color:var(--blue);border:1px solid rgba(59,130,246,.3);}
    .obs-pill.p{background:rgba(168,85,247,.14);color:var(--purple);border:1px solid rgba(168,85,247,.3);}
    .obs-pill.c{background:rgba(6,182,212,.14);color:var(--cyan);border:1px solid rgba(6,182,212,.3);}

    /* PROGRESS */
    .obs-prog-track{height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;}
    .obs-prog-fill{height:100%;border-radius:3px;transition:width .7s ease;}
    .obs-prog-fill.g{background:linear-gradient(90deg,var(--em),var(--em2));}
    .obs-prog-fill.r{background:linear-gradient(90deg,var(--red),#fb7185);}
    .obs-prog-fill.a{background:linear-gradient(90deg,var(--amber),#fcd34d);}
    .obs-prog-fill.b{background:linear-gradient(90deg,var(--blue),#60a5fa);}
    .obs-prog-fill.p{background:linear-gradient(90deg,var(--purple),#d8b4fe);}

    /* STAT ROW */
    .obs-stat-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--b2);}
    .obs-stat-row:last-child{border-bottom:none;}
    .obs-stat-label{font-size:12px;color:var(--t2);}
    .obs-stat-val{font-size:12px;font-weight:700;color:var(--t1);font-variant-numeric:tabular-nums;}

    /* RIGHT PANEL */
    .obs-rp-hd{padding:12px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
    .obs-rp-scroll{overflow-y:auto;flex:1;min-height:0;overscroll-behavior:contain;}
    .obs-rp-scroll::-webkit-scrollbar{width:3px;}
    .obs-rp-scroll::-webkit-scrollbar-thumb{background:var(--em);}
    .obs-alert-item{padding:9px 14px;border-bottom:1px solid var(--b2);display:flex;align-items:flex-start;gap:9px;cursor:pointer;transition:background .15s;}
    .obs-alert-item:hover{background:var(--emd);}
    .obs-alert-dot{width:7px;height:7px;border-radius:50%;margin-top:4px;flex-shrink:0;}
    .obs-alert-text{font-size:11px;color:var(--t2);line-height:1.45;}
    .obs-alert-time{font-size:10px;color:var(--t3);margin-top:2px;}

    /* INSIGHTS */
    .obs-insight{padding:11px 12px;border-radius:10px;margin-bottom:7px;border:1px solid;display:flex;gap:9px;align-items:flex-start;cursor:pointer;transition:all .15s;}
    .obs-insight:hover{transform:translateX(2px);}
    .obs-insight.pos{background:rgba(16,185,129,.07);border-color:rgba(16,185,129,.25);}
    .obs-insight.warn{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.25);}
    .obs-insight.alert{background:rgba(244,63,94,.07);border-color:rgba(244,63,94,.25);}
    .obs-insight.info{background:rgba(59,130,246,.07);border-color:rgba(59,130,246,.25);}
    .obs-insight-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
    .obs-insight-title{font-size:12px;font-weight:700;color:var(--t1);margin-bottom:3px;}
    .obs-insight-text{font-size:11px;color:var(--t2);line-height:1.5;}
    .obs-insight-meta{font-size:10px;color:var(--t3);margin-top:4px;}

    /* SCORE */
    .obs-score-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;}
    .obs-score-val{position:absolute;font-family:'Syne',sans-serif;font-weight:800;color:var(--em);}
    .obs-score-lbl{font-size:10px;color:var(--t3);}

    /* HEATMAP */
    .obs-hm-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:2.5px;}
    .obs-hm-cell{aspect-ratio:1;border-radius:3px;cursor:pointer;transition:transform .15s;}
    .obs-hm-cell:hover{transform:scale(1.4);z-index:10;position:relative;}

    /* SEGMENT BAR */
    .obs-seg-bar{height:10px;border-radius:5px;overflow:hidden;display:flex;}
    .obs-seg-piece{height:100%;transition:flex .5s ease;}

    /* COMP ROWS */
    .obs-comp-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;font-size:12px;}
    .obs-comp-label{width:120px;color:var(--t2);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .obs-comp-track{flex:1;height:7px;background:var(--bg3);border-radius:4px;overflow:hidden;}
    .obs-comp-fill{height:100%;border-radius:4px;transition:width .7s ease;}
    .obs-comp-val{width:70px;text-align:right;font-weight:700;color:var(--t1);flex-shrink:0;}

    /* GOAL CARD */
    .obs-goal{padding:11px 13px;border-radius:10px;background:var(--bg2);border:1px solid var(--b2);margin-bottom:7px;transition:border-color .2s;}
    .obs-goal:hover{border-color:var(--em);}
    .obs-goal-hd{display:flex;justify-content:space-between;margin-bottom:7px;align-items:center;}
    .obs-goal-name{font-size:12px;font-weight:700;color:var(--t1);}
    .obs-goal-pct{font-size:13px;font-weight:800;color:var(--em);}
    .obs-goal-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-top:5px;}

    /* FEED */
    .obs-feed-item{padding:9px 14px;border-bottom:1px solid var(--b2);display:flex;gap:9px;cursor:pointer;transition:background .15s;}
    .obs-feed-item:hover{background:var(--emd);}
    .obs-feed-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;background:var(--bg2);}
    .obs-feed-text{font-size:11px;color:var(--t2);line-height:1.4;flex:1;}
    .obs-feed-time{font-size:10px;color:var(--t3);margin-top:2px;}
    .obs-feed-amount{font-size:12px;font-weight:700;color:var(--em);white-space:nowrap;align-self:flex-start;}

    /* RISK */
    .obs-risk-cell{border-radius:8px;padding:9px 6px;text-align:center;font-size:10px;font-weight:700;cursor:pointer;transition:all .15s;border:1px solid transparent;}
    .obs-risk-cell:hover{transform:scale(1.05);}
    .obs-risk-cell.L{background:rgba(16,185,129,.13);color:var(--em);border-color:rgba(16,185,129,.3);}
    .obs-risk-cell.M{background:rgba(245,158,11,.13);color:var(--amber);border-color:rgba(245,158,11,.3);}
    .obs-risk-cell.H{background:rgba(244,63,94,.13);color:var(--red);border-color:rgba(244,63,94,.3);}
    .obs-risk-cell.C{background:rgba(244,63,94,.28);color:var(--red);border-color:var(--red);animation:obs-pulse 1.8s infinite;}
    @keyframes obs-pulse{0%,100%{opacity:1}50%{opacity:.55}}

    /* WATCHLIST */
    .obs-watch-item{padding:9px 14px;border-bottom:1px solid var(--b2);display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .15s;}
    .obs-watch-item:hover{background:var(--emd);}
    .obs-watch-label{font-size:11px;color:var(--t2);flex:1;}
    .obs-watch-val{font-size:12px;font-weight:700;color:var(--t1);}
    .obs-watch-chg{font-size:10px;}

    /* MATRIX CELL */
    .obs-mat-cell{aspect-ratio:1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;cursor:pointer;transition:transform .15s;}
    .obs-mat-cell:hover{transform:scale(1.15);}

    /* CALENDAR */
    .obs-cal-event{padding:7px 10px;border-radius:8px;margin-bottom:5px;border-left:3px solid;font-size:11px;}
    .obs-cal-event.payroll{border-color:var(--blue);background:rgba(59,130,246,.08);}
    .obs-cal-event.tax{border-color:var(--amber);background:rgba(245,158,11,.08);}
    .obs-cal-event.audit{border-color:var(--purple);background:rgba(168,85,247,.08);}
    .obs-cal-event.board{border-color:var(--em);background:rgba(16,185,129,.08);}
    .obs-cal-event.maturity{border-color:var(--red);background:rgba(244,63,94,.08);}
    .obs-cal-title{font-weight:700;color:var(--t1);margin-bottom:2px;}
    .obs-cal-meta{color:var(--t3);font-size:10px;}

    /* DONUT LEGEND */
    .obs-legend-item{display:flex;align-items:center;gap:8px;font-size:11px;padding:4px 0;}
    .obs-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
    .obs-legend-label{color:var(--t2);flex:1;}
    .obs-legend-val{color:var(--t1);font-weight:700;}
    .obs-legend-pct{color:var(--t3);font-size:10px;width:30px;text-align:right;}

    /* SCENARIO */
    .obs-scenario-btn{padding:5px 12px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--bg2);color:var(--t3);transition:all .15s;font-family:inherit;letter-spacing:.04em;}
    .obs-scenario-btn.act{background:var(--emd);color:var(--em);border-color:var(--em);}

    /* COHORT */
    .obs-cohort-cell{border-radius:4px;padding:5px 3px;text-align:center;font-size:9.5px;font-weight:700;cursor:pointer;transition:transform .15s;}
    .obs-cohort-cell:hover{transform:scale(1.2);z-index:5;position:relative;}

    /* RADAR LABELS */
    .obs-radar-wrap{position:relative;}

    /* ANIMATIONS */
    @keyframes obs-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .obs-fadein{animation:obs-fadein .35s ease forwards;}
    @keyframes obs-slideright{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    .obs-slideright{animation:obs-slideright .3s ease forwards;}

    /* DIVIDER */
    .obs-div{height:1px;background:var(--b2);margin:10px 0;}

    /* SCROLL AREA */
    .obs-scroll-x{overflow-x:auto;padding-bottom:4px;}
    .obs-scroll-x::-webkit-scrollbar{height:3px;}
    .obs-scroll-x::-webkit-scrollbar-thumb{background:var(--em);}

    /* FX CHIP */
    .obs-fx-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;font-size:11px;background:var(--bg2);border:1px solid var(--b2);color:var(--t2);}

    /* RESPONSIVE */
    @media(max-width:1200px){.obs-rpanel{display:none;}}
    @media(max-width:960px){.obs-kpi-grid{grid-template-columns:repeat(2,1fr);}.obs-g2,.obs-g3,.obs-g21,.obs-g12,.obs-g31,.obs-g13{grid-template-columns:1fr;}}
    @media(max-width:680px){.obs-sidebar{display:none;}}
  `;
  document.head.appendChild(s);
}