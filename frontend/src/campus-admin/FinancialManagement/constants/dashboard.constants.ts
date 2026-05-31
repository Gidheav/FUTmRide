// ─────────────────────────────────────────────────────────────────────────────
// dashboard.constants.ts
// All module-scope constants for FinancialDashboard ("The Observatory")
// ─────────────────────────────────────────────────────────────────────────────

// ─── Month labels ─────────────────────────────────────────────────────────────

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Monthly financial data ───────────────────────────────────────────────────

export const MONTHLY_DATA = [
  {m:'Jan',income:4800000,expense:3200000,giving:2100000,members:1420,attendance:890},
  {m:'Feb',income:5100000,expense:3400000,giving:2400000,members:1438,attendance:920},
  {m:'Mar',income:4700000,expense:3600000,giving:2050000,members:1445,attendance:860},
  {m:'Apr',income:6200000,expense:3100000,giving:3100000,members:1460,attendance:1050},
  {m:'May',income:5800000,expense:3500000,giving:2900000,members:1472,attendance:980},
  {m:'Jun',income:5200000,expense:3800000,giving:2500000,members:1488,attendance:930},
  {m:'Jul',income:4600000,expense:3200000,giving:2200000,members:1495,attendance:870},
  {m:'Aug',income:5500000,expense:3400000,giving:2700000,members:1510,attendance:960},
  {m:'Sep',income:6800000,expense:3700000,giving:3400000,members:1528,attendance:1120},
  {m:'Oct',income:7200000,expense:4100000,giving:3800000,members:1542,attendance:1180},
  {m:'Nov',income:6500000,expense:3900000,giving:3200000,members:1558,attendance:1090},
  {m:'Dec',income:8900000,expense:4200000,giving:5100000,members:1575,attendance:1380},
];

// ─── Weekly giving heatmap (52 weeks × 7 days) ───────────────────────────────

export const WEEKLY_HEATMAP = Array.from({length:52},(_,w)=>
  Array.from({length:7},(_,d)=>{
    const base = [2,3,2,2,3,8,6][d];
    const easter = w===13?3:1;
    const dec = w>=48?2:1;
    return Math.max(0, Math.round((base + (Math.random()-0.4)*2)*easter*dec));
  })
);

// ─── Department spending ──────────────────────────────────────────────────────

export const DEPT_SPENDING = [
  {name:'Worship & Music',budget:1800000,actual:1650000,color:'var(--em)'},
  {name:'Children Ministry',budget:1200000,actual:1380000,color:'var(--amber)'},
  {name:'Outreach & Missions',budget:2400000,actual:2210000,color:'var(--blue)'},
  {name:'Admin & Operations',budget:3600000,actual:3410000,color:'var(--purple)'},
  {name:'Youth Ministry',budget:900000,actual:870000,color:'var(--cyan)'},
  {name:'Media & Comms',budget:600000,actual:720000,color:'var(--red)'},
  {name:'Facilities',budget:2000000,actual:1890000,color:'var(--em2)'},
];

// ─── Fund allocation ──────────────────────────────────────────────────────────

export const FUND_ALLOCATION = [
  {name:'General Operations',pct:42,color:'var(--em)',val:23100000},
  {name:'Building Fund',pct:18,color:'var(--blue)',val:9900000},
  {name:'Mission Reserve',pct:15,color:'var(--purple)',val:8250000},
  {name:'Emergency Reserve',pct:12,color:'var(--amber)',val:6600000},
  {name:'Youth Programs',pct:8,color:'var(--cyan)',val:4400000},
  {name:'Media & Events',pct:5,color:'var(--red)',val:2750000},
];

// ─── Forecast scenarios ───────────────────────────────────────────────────────

export const FORECAST_SCENARIOS = {
  optimistic: [9200000,9600000,10100000,11200000,10800000,10500000,9800000,10200000,11500000,12100000,11400000,14500000],
  base:        [8400000,8700000,9000000,10200000,9700000,9300000,8600000,9100000,10300000,10800000,10100000,12800000],
  pessimistic: [7200000,7400000,7800000,8600000,8100000,7700000,7100000,7500000,8400000,8900000,8300000,10200000],
};

// ─── Goals ────────────────────────────────────────────────────────────────────

export const GOALS = [
  {name:'Annual Giving Target',target:85000000,raised:55200000,deadline:'Dec 2025',icon:'🎯'},
  {name:'Building Fund',target:120000000,raised:48600000,deadline:'Mar 2026',icon:'🏛️'},
  {name:'Mission 2025 Fund',target:30000000,raised:24100000,deadline:'Jun 2025',icon:'✈️'},
  {name:'Equipment Upgrade',target:8000000,raised:6400000,deadline:'Aug 2025',icon:'🎸'},
  {name:'Scholarship Fund',target:5000000,raised:2100000,deadline:'Sep 2025',icon:'🎓'},
];

// ─── AI Insights ──────────────────────────────────────────────────────────────

export const INSIGHTS = [
  {type:'pos',icon:'📈',title:'Giving Velocity Up 23%',text:'Donations accelerated this week compared to the 30-day average. Peak times: Sunday 9–11 AM and Thursday evenings.',meta:'Updated 2h ago · High confidence'},
  {type:'warn',icon:'⚠️',title:'Children Ministry Over Budget',text:'Spending is 15% above budget (₦180K over). Q4 projections suggest ₦340K overage if unaddressed.',meta:'Budget alert · Action recommended'},
  {type:'info',icon:'🔍',title:'Attendance-Giving Correlation',text:'Strong positive correlation (r=0.84) detected between service attendance and weekly giving. Each +100 attendees ≈ +₦420K.',meta:'Statistical insight · 12-month data'},
  {type:'pos',icon:'💡',title:'New Member Surge',text:'35 new members joined this month — the highest in 18 months. Historically, new members become regular givers within 4–6 weeks.',meta:'Membership analytics · Growing trend'},
  {type:'alert',icon:'🚨',title:'Top Donor Concentration Risk',text:'Top 3 donors represent 28% of monthly income. Industry best practice is <15%. Risk of significant shortfall if any one departs.',meta:'Concentration risk · Review needed'},
  {type:'info',icon:'📅',title:'Seasonal Pattern Detected',text:'April and December consistently outperform baseline by 30–45%. Pre-loading October campaigns could amplify Q4 performance.',meta:'Seasonality model · 4-year pattern'},
  {type:'pos',icon:'🌱',title:'Digital Giving Adoption +41%',text:'Online/mobile giving now represents 68% of total donations, up from 48% last year. Mobile payments driving growth.',meta:'Digital transformation · Positive trend'},
  {type:'warn',icon:'📉',title:'Mid-Week Giving Trough',text:'Tuesday–Wednesday giving averages just 4% of weekly total. Simple mid-week campaign could capture estimated ₦180K/month.',meta:'Opportunity gap · Low effort'},
];

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const ALERTS = [
  {color:'var(--red)',text:'Media & Comms dept exceeded budget by ₦120,000',time:'10 min ago'},
  {color:'var(--em)',text:'Large donation ₦2,500,000 received — Mr. Adeyemi Folake',time:'1h ago'},
  {color:'var(--amber)',text:'Payroll run due in 3 days — ₦4.2M pending approval',time:'2h ago'},
  {color:'var(--blue)',text:'Q4 Board Report ready for review',time:'5h ago'},
  {color:'var(--purple)',text:'New member batch: 12 members from Lekki Zone',time:'8h ago'},
  {color:'var(--em)',text:'Building Fund milestone: 40% of target reached',time:'1d ago'},
  {color:'var(--amber)',text:'VAT filing deadline: 21 days remaining',time:'1d ago'},
  {color:'var(--red)',text:'Investment bond mature in 14 days — ₦5M FGN Bond',time:'2d ago'},
];

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const WATCHLIST = [
  {label:'Total Church Assets',val:'₦55.2M',chg:'+4.2%',up:true},
  {label:'Cash & Bank Balance',val:'₦12.8M',chg:'+1.1%',up:true},
  {label:'Monthly Burn Rate',val:'₦3.9M',chg:'+8.4%',up:false},
  {label:'Cash Runway',val:'3.2 mo',chg:'-0.4',up:false},
  {label:'Net Giving YTD',val:'₦55.2M',chg:'+18.3%',up:true},
  {label:'Member Count',val:'1,575',chg:'+35',up:true},
  {label:'Avg Gift / Member',val:'₦35,047',chg:'+6.2%',up:true},
  {label:'Debt-to-Asset',val:'0.12',chg:'-0.02',up:true},
];

// ─── Activity feed ────────────────────────────────────────────────────────────

export const ACTIVITY_FEED = [
  {icon:'💚',text:'Online tithe — Olamide Adeyemi',amount:'₦150,000',time:'2 min ago',type:'giving'},
  {icon:'🏦',text:'Paystack transfer received — 42 transactions',amount:'₦890,000',time:'8 min ago',type:'batch'},
  {icon:'📤',text:'Vendor payment — Faithhouse AV Services',amount:'-₦240,000',time:'15 min ago',type:'expense'},
  {icon:'💚',text:'Sunday offertory (digital) counted',amount:'₦1,420,000',time:'32 min ago',type:'giving'},
  {icon:'👤',text:'New member registered — Covenant Zone',amount:'',time:'1h ago',type:'member'},
  {icon:'📤',text:'Salary advance approved — Music Director',amount:'-₦80,000',time:'2h ago',type:'expense'},
  {icon:'💚',text:'Building fund pledge — Adaeze Okonkwo',amount:'₦500,000',time:'3h ago',type:'giving'},
  {icon:'📋',text:'Budget reallocation approved by board',amount:'',time:'4h ago',type:'admin'},
  {icon:'💚',text:'Bank transfer — Folake Emmanuel',amount:'₦2,500,000',time:'5h ago',type:'giving'},
  {icon:'📤',text:'Utility bills — Electricity IKEDC',amount:'-₦185,000',time:'6h ago',type:'expense'},
];

// ─── Risk matrix ──────────────────────────────────────────────────────────────

export const RISK_MATRIX = [
  {risk:'Donor Concentration',likelihood:4,impact:4,level:'C',owner:'Finance Team'},
  {risk:'Cash Flow Shortfall',likelihood:3,impact:4,level:'H',owner:'Treasurer'},
  {risk:'Cyber/Fraud Exposure',likelihood:2,impact:5,level:'H',owner:'IT & Finance'},
  {risk:'Regulatory Non-Compliance',likelihood:2,impact:4,level:'M',owner:'Legal'},
  {risk:'Staff Turnover',likelihood:3,impact:3,level:'M',owner:'HR'},
  {risk:'Venue/Infrastructure',likelihood:2,impact:3,level:'M',owner:'Operations'},
  {risk:'Investment Loss',likelihood:2,impact:3,level:'M',owner:'Treasury'},
  {risk:'Currency Devaluation',likelihood:3,impact:2,level:'M',owner:'Finance'},
  {risk:'Data Loss',likelihood:1,impact:4,level:'L',owner:'IT'},
  {risk:'Minor Budget Overrun',likelihood:4,impact:2,level:'M',owner:'Finance'},
];

// ─── Radar scores ─────────────────────────────────────────────────────────────

export const RADAR_SCORES = [
  {label:'Liquidity',score:72},
  {label:'Giving Growth',score:88},
  {label:'Compliance',score:94},
  {label:'Reserves',score:61},
  {label:'Transparency',score:89},
  {label:'Digital',score:84},
  {label:'Budget Mgmt',score:76},
  {label:'Risk Ctrl',score:68},
];

// ─── Cohort retention data ────────────────────────────────────────────────────

export const COHORT_DATA = [
  {year:'2020',Jan:100,Feb:92,Mar:88,Apr:85,May:82,Jun:79,Jul:78,Aug:76,Sep:74,Oct:72,Nov:71,Dec:70},
  {year:'2021',Jan:100,Feb:94,Mar:90,Apr:87,May:85,Jun:83,Jul:80,Aug:79,Sep:77,Oct:75,Nov:73,Dec:72},
  {year:'2022',Jan:100,Feb:95,Mar:91,Apr:88,May:87,Jun:85,Jul:83,Aug:82,Sep:80,Oct:78,Nov:76,Dec:74},
  {year:'2023',Jan:100,Feb:96,Mar:92,Apr:91,May:89,Jun:88,Jul:86,Aug:85,Sep:83,Oct:81,Nov:80,Dec:79},
  {year:'2024',Jan:100,Feb:97,Mar:94,Apr:93,May:92,Jun:90,Jul:89,Aug:88,Sep:87,Oct:85,Nov:84,Dec:83},
];

// ─── Upcoming events ──────────────────────────────────────────────────────────

export const UPCOMING_EVENTS = [
  {type:'payroll',title:'Staff Payroll Run',date:'Mar 28, 2025',amount:'₦4.2M',days:3},
  {type:'tax',title:'VAT Filing Deadline',date:'Apr 21, 2025',amount:'₦380K',days:27},
  {type:'maturity',title:'FGN Bond Maturity',date:'Apr 5, 2025',amount:'₦5M',days:11},
  {type:'board',title:'Q1 Board Meeting',date:'Apr 2, 2025',amount:'',days:8},
  {type:'audit',title:'Internal Audit Review',date:'Apr 15, 2025',amount:'',days:21},
  {type:'tax',title:'PAYE Remittance',date:'Mar 31, 2025',amount:'₦920K',days:6},
];

// ─── Benchmark data ───────────────────────────────────────────────────────────

export const BENCHMARK_DATA = [
  {metric:'Giving per Member',church:35047,peer:28200,unit:'₦'},
  {metric:'Admin Expense %',church:18,peer:22,unit:'%'},
  {metric:'Program Expense %',church:62,peer:58,unit:'%'},
  {metric:'Reserve Months',church:3.2,peer:4.1,unit:'mo'},
  {metric:'Digital Giving %',church:68,peer:51,unit:'%'},
  {metric:'New Member Retention',church:74,peer:62,unit:'%'},
];

// ─── Top donors ───────────────────────────────────────────────────────────────

export const TOP_DONORS = [
  {rank:1,name:'Adeyemi Holdings',ytd:8500000,pct:15.4,mom:'+12%',type:'Corporate'},
  {rank:2,name:'Folake Emmanuel Trust',ytd:5200000,pct:9.4,mom:'+8%',type:'Individual'},
  {rank:3,name:'Okonkwo Foundation',ytd:3800000,pct:6.9,mom:'+0%',type:'Foundation'},
  {rank:4,name:'Dr. Chukwuemeka Obi',ytd:2100000,pct:3.8,mom:'+22%',type:'Individual'},
  {rank:5,name:'Covenant Biz Network',ytd:1900000,pct:3.4,mom:'+5%',type:'Corporate'},
  {rank:6,name:'Mama Bisi Legacy Fund',ytd:1600000,pct:2.9,mom:'-4%',type:'Memorial'},
  {rank:7,name:'Adaeze & Kelechi Okonkwo',ytd:1400000,pct:2.5,mom:'+15%',type:'Individual'},
  {rank:8,name:'Lekki Zone Council',ytd:1100000,pct:2.0,mom:'+0%',type:'Zone'},
];

// ─── Ticker items ─────────────────────────────────────────────────────────────

export const TICKER_ITEMS_REAL = [
  {label:'Net Assets',val:'₦55.2M',change:'+4.2%',up:true},
  {label:'YTD Giving',val:'₦55.2M',change:'+18.3%',up:true},
  {label:'Cash Balance',val:'₦12.8M',change:'+1.1%',up:true},
  {label:'Members',val:'1,575',change:'+35',up:true},
  {label:'Monthly Burn',val:'₦3.9M',change:'+8.4%',up:false},
  {label:'Building Fund',val:'40.5%',change:'of goal',up:true},
  {label:'Cash Runway',val:'3.2 mo',change:'-0.4',up:false},
  {label:'Investment Port.',val:'₦18.4M',change:'+2.1%',up:true},
  {label:"Today's Giving",val:'₦4.28M',change:'Live',up:true},
  {label:'Compliance',val:'94%',change:'+2%',up:true},
  {label:'Avg Gift',val:'₦35,047',change:'+6.2%',up:true},
  {label:'Risk Score',val:'78/100',change:'+3',up:true},
];