/* CivMetrix — 01-core.js
 * Helpers, DB cache, session state, plan limits, Screen, Setup, GAS transport
 *
 * Part 1 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */


'use strict';
/* ═══════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════ */
const ge = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
// Recalculate reg/OT from stored entry times (corrects stale stored values)
// ── Fuel rate per BATCH OF 7 RECORDS ──────────────────────────────────
// Records (chronological) are chunked into groups of 7. Each chunk's rate =
// chunkCost / odometerRange. A chunk needs >=4 records AND a positive odometer
// range to produce a valid rate. Returns {batches:[{rate,from,to,count,cost,valid}],
// latestRate} where latestRate is the most recent VALID batch rate (used for Fuel Cost).
function calcFuelBatches(records){
  const recs = (records||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const batches = [];
  for(let i=0;i<recs.length;i+=7){
    const chunk = recs.slice(i,i+7);
    const cost  = chunk.reduce((s,f)=>s+parseFloat(String(f.cost||0)),0);
    const odos  = chunk.map(f=>parseFloat(String(f.odometer||0))).filter(v=>v>0);
    let rate=0, valid=false, from=null, to=null;
    if(chunk.length>=4 && odos.length>=2){
      from=Math.min(...odos); to=Math.max(...odos);
      const rng=to-from;
      if(rng>=0.5){ rate=cost/rng; valid=true; }
    }
    batches.push({rate, valid, from, to, count:chunk.length, cost});
  }
  // latest valid batch rate (scan from the end)
  let latestRate=0;
  for(let i=batches.length-1;i>=0;i--){ if(batches[i].valid){ latestRate=batches[i].rate; break; } }
  return {batches, latestRate};
}

const calcEntryHrs = (e) => {
  const _toM = t => { if(!t)return null; const[h,m]=String(t).split(':').map(Number); return h*60+m; };
  const _pS=_toM(e.dayStart), _pE=_toM(e.dayEnd);
  const _aS=_toM(e.activityStart||e.dayStart), _aE=_toM(e.activityEnd||e.dayEnd);
  let _wS=_aS!==null?_aS:(_pS||0), _wE=_aE!==null?_aE:(_pE||0);
  const _lateM=e.lateStart?_toM(e.lateStart):null;
  const _earlyM=e.earlyFinish?_toM(e.earlyFinish):null;
  if(_lateM!==null&&_lateM>_wS) _wS=_lateM;
  if(_earlyM!==null&&_earlyM<_wE) _wE=_earlyM;
  if(_wE<_wS) _wE=_wS;
  const _lC=!!(e.hasLunch||e.lunchChecked||+(e.lunchMins||0)>0);
  const _lS=_toM(e.lunchStart), _lE=_toM(e.lunchEnd);
  const _lMins=(_lC&&_lS!==null&&_lE!==null)?Math.max(0,_lE-_lS):+(e.lunchMins||0);
  const _dt=String(e.dateType||'normal');
  if(_dt==='ot_all') return {reg:+(e.hoursReg||0),ot:+(e.hoursOT||0)};
  if(_pS===null||_pE===null) return {reg:+(e.hoursReg||0),ot:+(e.hoursOT||0)};
  if(_dt==='half'){
    const _reg=Math.max(0,_pE-_pS)/60;
    const _ot=Math.max(0,(Math.max(0,_pS-_wS)+Math.max(0,_wE-_pE))-_lMins)/60;
    return {reg:+_reg.toFixed(2),ot:+Math.max(0,_ot).toFixed(2)};
  }
  const _earlyOt=Math.max(0,_pS-_wS);
  const _lateOt=Math.max(0,_wE-_pE);
  const _leftShort=Math.max(0,_pE-_wE);
  const _lunchBonus=_lC?0:(_lS!==null&&_lE!==null?Math.max(0,Math.min(_wE,_lE)-Math.max(_wS,_lS)):0);
  const _rawOt=_earlyOt+_lateOt+_lunchBonus;
  const _ot=Math.max(0,_rawOt-_leftShort)/60;
  const _inNorm=Math.max(0,Math.min(_wE,_pE)-Math.max(_wS,_pS));
  const _reg=Math.max(0,_inNorm-_lMins)/60;
  return {reg:+_reg.toFixed(2),ot:+_ot.toFixed(2)};
};
// Combine all of a worker's entries for ONE day into a single span, then compute reg/OT.
// This prevents double-counting OT when a worker logged multiple activities in a day.
const calcDayHrs = (entries) => {
  if(!entries || !entries.length) return {reg:0, ot:0, totalHrs:0};
  const _toM = t => { if(!t)return null; const[h,m]=String(t).split(':').map(Number); return h*60+m; };
  // Earliest start, latest end across all the day's entries
  let earliestStart=null, latestEnd=null, dayStart=null, dayEnd=null;
  let hasLunch=false, lunchMins=0, dateType='normal';
  let lunchStart=null, lunchEnd=null;
  entries.forEach(e=>{
    const s=_toM(e.lateStart||e.activityStart||e.dayStart||'');
    const f=_toM(e.earlyFinish||e.activityEnd||e.dayEnd||'');
    if(s!==null && (earliestStart===null||s<earliestStart)) earliestStart=s;
    if(f!==null && (latestEnd===null||f>latestEnd)) latestEnd=f;
    const ps=_toM(e.dayStart), pe=_toM(e.dayEnd);
    if(ps!==null) dayStart=ps;
    if(pe!==null) dayEnd=pe;
    if(e.hasLunch||e.lunchChecked||+(e.lunchMins||0)>0){ hasLunch=true; lunchMins=Math.max(lunchMins,+(e.lunchMins||0)); }
    const ls=_toM(e.lunchStart), le=_toM(e.lunchEnd);
    if(ls!==null) lunchStart=ls;
    if(le!==null) lunchEnd=le;
    if(String(e.dateType||'normal')!=='normal') dateType=String(e.dateType);
  });
  // Only deduct lunch if the worked span actually overlaps the lunch window.
  // If no explicit lunch times exist, only deduct when the day spans a typical
  // lunch period (>= ~5h worked), so short part-day shifts aren't over-deducted.
  let _effLunch = lunchMins;
  if(earliestStart!==null && latestEnd!==null){
    const _spanMin = latestEnd - earliestStart;
    if(lunchStart!==null && lunchEnd!==null){
      // Real lunch window — deduct only the overlapping portion
      const _ov = Math.max(0, Math.min(latestEnd,lunchEnd) - Math.max(earliestStart,lunchStart));
      _effLunch = _ov;
    } else if(_spanMin < 5*60){
      // Short shift, no explicit lunch — don't deduct a full lunch
      _effLunch = 0;
    }
  }
  // Build a single synthetic entry representing the whole day, then reuse calcEntryHrs
  const toT = m => m===null?'':String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const synth = {
    dayStart: toT(dayStart), dayEnd: toT(dayEnd),
    activityStart: toT(earliestStart), activityEnd: toT(latestEnd),
    hasLunch:_effLunch>0, lunchMins:_effLunch, dateType,
    hoursReg: entries.reduce((s,e)=>s+(+(e.hoursReg||0)),0),
    hoursOT:  entries.reduce((s,e)=>s+(+(e.hoursOT||0)),0)
  };
  const r = calcEntryHrs(synth);
  return {reg:r.reg, ot:r.ot, totalHrs:+(r.reg+r.ot).toFixed(2)};
};

const qsa = sel => document.querySelectorAll(sel);
const fmtR = n => isNaN(n) ? '—' : 'R ' + Number(n).toLocaleString('en-ZA');
const fmtN = n => isNaN(n) ? '—' : Number(n).toLocaleString('en-ZA');
const fmtD = d => { if(!d) return '—'; const dt=new Date(d); return isNaN(dt)?d:dt.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}); };
const fmtPct = n => isNaN(n) ? '—' : (+n).toFixed(1) + '%';
const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();

// ── Get current org ID for stamping on every record ──────────────────────────
function _orgId() {
  return S.org?.id || S.user?.orgId || '';
}

// ── Searchable combo-box ─────────────────────────────────────────────────────
// Usage: makeCombo(inputId, listId, items:[{value,label}], onSelect:fn)
function makeCombo(inputEl, items, onSelect) {
  const wrap = document.createElement('div'); wrap.className='combo-wrap';
  inputEl.parentNode.insertBefore(wrap, inputEl); wrap.appendChild(inputEl);
  const list = document.createElement('div'); list.className='combo-list'; wrap.appendChild(list);
  let focused=-1;
  function render(q=''){
    const lq=q.toLowerCase();
    const matches=items.filter(i=>i.label.toLowerCase().includes(lq)||i.value.toLowerCase().includes(lq));
    list.innerHTML=matches.map((it,idx)=>`<div class="combo-opt" data-val="${it.value}" data-idx="${idx}">${it.label}</div>`).join('');
    list.classList.toggle('open', matches.length>0 && q.length>0);
    focused=-1;
  }
  inputEl.addEventListener('input', e=>render(e.target.value));
  inputEl.addEventListener('focus', ()=>render(inputEl.value));
  inputEl.addEventListener('keydown', e=>{
    const opts=list.querySelectorAll('.combo-opt');
    if(e.key==='ArrowDown'){focused=Math.min(focused+1,opts.length-1);}
    else if(e.key==='ArrowUp'){focused=Math.max(focused-1,0);}
    else if(e.key==='Enter'&&focused>=0){e.preventDefault(); opts[focused]?.click();}
    else if(e.key==='Escape'){list.classList.remove('open');}
    opts.forEach((o,i)=>o.classList.toggle('focused',i===focused));
  });
  list.addEventListener('mousedown', e=>{
    const opt=e.target.closest('.combo-opt'); if(!opt) return;
    e.preventDefault();
    inputEl.value=opt.dataset.val;
    list.classList.remove('open');
    if(onSelect) onSelect(opt.dataset.val);
  });
  document.addEventListener('click', e=>{ if(!wrap.contains(e.target)) list.classList.remove('open'); });
}
const todayISO = () => new Date().toISOString().split('T')[0];
const clamp = (v,mn,mx) => Math.min(mx,Math.max(mn,v));

function pill(status) {
  const m = {Working:'green','In Progress':'amber',Active:'green',Approved:'green',Matched:'green',
    Closed:'green',Pending:'amber',Open:'red',Breakdown:'red',Idle:'orange',Short:'orange',
    Critical:'red',Major:'red',Minor:'orange','Low Stock':'orange'};
  const c = m[status] || 'blue';
  return `<span class="pill ${c}">${status||'—'}</span>`;
}
function pctColor(p) { return p >= 75 ? 'green' : p >= 45 ? 'amber' : 'red'; }

function toast(msg, type='info') {
  const t = ge('toast');
  if(!t){ console.log('[toast]',type,msg); return; }
  t.innerHTML = `<span>${type==='ok'?'✅':type==='err'?'❌':'ℹ️'}</span> ${msg}`;
  t.className = `toast ${type} show`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ═══════════════════════════════════════════════════
   DEMO DATABASE
═══════════════════════════════════════════════════ */
const DB = {
  users: [],  // populated from GAS only — no hardcoded users
  organizations: [],   // No hardcoded org — created by Admin on first setup
  projects: [
    {code:'PRJ-001',name:'N4 Road Rehabilitation — Phase 2',client:'Eswatini Roads Authority',value:45750000,startDate:'2025-02-01',endDate:'2026-01-31',pm:'',status:'In Progress',contractNo:'ERA/ROADS/N4/2025/001',duration:365,location:'Manzini–Mbabane Highway, Eswatini'},
    {code:'PRJ-002',name:'Mbabane Bypass — Phase 1',client:'ERA / Ministry of Works',value:28500000,startDate:'2025-04-01',endDate:'2026-03-31',pm:'',status:'In Progress',contractNo:'ERA/BYPASS/2025/002',duration:365,location:'Mbabane Northern Ring Road'},
  ],
  daily: [
    {id:'DR-001',project:'PRJ-001',date:'2026-03-29',weather:'Sunny',section:'Earthworks',foreman:'[Foreman]',skilled:2,semiSkilled:4,general:8,subContract:0,total:14,target:15,hrsWorked:8.5,otHours:2,activityCode:'EW-001',location:'Ch 0+000–0+500',remarks:'',createdBy:'system',createdAt:'2026-03-29T17:00:00Z'},
    {id:'DR-002',project:'PRJ-001',date:'2026-03-29',weather:'Sunny',section:'Paving – Base',foreman:'[Site Agent]',skilled:1,semiSkilled:3,general:6,subContract:2,total:12,target:12,hrsWorked:8,otHours:0,activityCode:'PV-003',location:'Ch 0+500–1+200',remarks:'Good progress',createdBy:'system',createdAt:'2026-03-29T17:00:00Z'},
    {id:'DR-003',project:'PRJ-001',date:'2026-03-28',weather:'Cloudy',section:'Structures',foreman:'[Supervisor]',skilled:3,semiSkilled:2,general:4,subContract:0,total:9,target:10,hrsWorked:8,otHours:1.5,activityCode:'ST-005',location:'Culvert @ Ch 0+750',remarks:'Rebar fixing',createdBy:'system',createdAt:'2026-03-28T17:00:00Z'},
    {id:'DR-004',project:'PRJ-001',date:'2026-03-27',weather:'Sunny',section:'Drainage',foreman:'[Supervisor]',skilled:1,semiSkilled:1,general:3,subContract:1,total:6,target:6,hrsWorked:8,otHours:0,activityCode:'DR-002',location:'Ch 1+200–1+600',remarks:'',createdBy:'system',createdAt:'2026-03-27T17:00:00Z'},
  ],
  plant: [
    {id:'PL-001',project:'PRJ-001',date:'2026-03-29',type:'Excavator 20T',regId:'EX-01',operator:'[Operator]',hrsAvailable:10,hrsWorked:9.5,idleHrs:0.5,breakdown:'No',fuel:120,activityCode:'EW-001',location:'Ch 0+000',serviceDue:'2026-04-15',status:'Working',createdBy:'system'},
    {id:'PL-002',project:'PRJ-001',date:'2026-03-29',type:'Grader 140G',regId:'GR-01',operator:'[Operator]',hrsAvailable:10,hrsWorked:8,idleHrs:2,breakdown:'No',fuel:95,activityCode:'PV-003',location:'Ch 0+500',serviceDue:'2026-04-22',status:'Working',createdBy:'system'},
    {id:'PL-003',project:'PRJ-001',date:'2026-03-29',type:'TLB (4x4)',regId:'TLB-01',operator:'[Operator]',hrsAvailable:10,hrsWorked:0,idleHrs:3,breakdown:'Yes',fuel:0,activityCode:'',location:'Workshop',serviceDue:'2026-03-30',status:'Breakdown',createdBy:'system'},
    {id:'PL-004',project:'PRJ-001',date:'2026-03-29',type:'Water Tanker 10kL',regId:'WT-01',operator:'[Driver]',hrsAvailable:10,hrsWorked:9,idleHrs:1,breakdown:'No',fuel:150,activityCode:'PV-003',location:'Site wide',serviceDue:'2026-05-05',status:'Working',createdBy:'system'},
  ],
  boq: [
    {project:'PRJ-001',item:'1.01',description:'Site Establishment & Clearing',unit:'LS',contractQty:1,rate:250000,prevQty:1,todayQty:0,total:1,pct:100},
    {project:'PRJ-001',item:'2.01',description:'Bulk Earthworks – Cut to Spoil',unit:'m³',contractQty:45000,rate:48,prevQty:30000,todayQty:800,total:30800,pct:68.4},
    {project:'PRJ-001',item:'2.02',description:'Bulk Earthworks – Import Fill',unit:'m³',contractQty:38000,rate:62,prevQty:22000,todayQty:650,total:22650,pct:59.6},
    {project:'PRJ-001',item:'3.01',description:'Sub-base G7 Compacted',unit:'m²',contractQty:25000,rate:95,prevQty:15000,todayQty:400,total:15400,pct:61.6},
    {project:'PRJ-001',item:'3.02',description:'Base Course G2 Compacted',unit:'m²',contractQty:25000,rate:145,prevQty:8000,todayQty:380,total:8380,pct:33.5},
    {project:'PRJ-001',item:'3.03',description:'Asphalt Surfacing 40mm',unit:'m²',contractQty:25000,rate:180,prevQty:0,todayQty:0,total:0,pct:0},
    {project:'PRJ-001',item:'4.01',description:'Concrete Culvert 900Ø (RCRR)',unit:'Each',contractQty:8,rate:28500,prevQty:3,todayQty:0,total:3,pct:37.5},
    {project:'PRJ-001',item:'5.01',description:'Kerb & Channel (Type A)',unit:'m',contractQty:3200,rate:285,prevQty:1200,todayQty:45,total:1245,pct:38.9},
  ],
  incidents: [
    {id:'INC-001',project:'PRJ-001',date:'2025-02-12',type:'Near Miss',description:'Excavator reversing — pedestrian in blind spot',location:'Ch 0+200',injured:'—',severity:'Near Miss',lostDays:0,investigatedBy:'[Admin]',rootCause:'Inadequate banksman',corrective:'Banksman assigned to EX-01',due:'2025-02-20',status:'Closed',createdBy:'system'},
    {id:'INC-002',project:'PRJ-001',date:'2025-03-01',type:'First Aid',description:'Cut on hand from steel rebar',location:'Culvert area',injured:'[Worker]',severity:'First Aid',lostDays:0,investigatedBy:'[Admin]',rootCause:'No cut resistant gloves',corrective:'PPE upgrade – CR gloves issued',due:'2025-03-10',status:'Closed',createdBy:'system'},
    {id:'INC-003',project:'PRJ-001',date:'2025-03-15',type:'Near Miss',description:'Diesel spill near drainage channel',location:'Fuel storage',injured:'—',severity:'Environmental',lostDays:0,investigatedBy:'[SHEQ Officer]',rootCause:'Overfill during refuelling',corrective:'Drip tray installed',due:'2025-03-25',status:'Open',createdBy:'system'},
  ],
  ncr: [
    {id:'NCR-007',project:'PRJ-001',dateRaised:'2025-03-10',description:'Subbase compaction test failed (93% vs 98% spec)',raisedBy:'[QC Inspector]',activity:'3.01',severity:'Major',corrective:'Re-compact and retest',due:'2025-03-20',closedDate:'2025-04-01',verifiedBy:'[Admin]',status:'Closed',createdBy:'system'},
    {id:'NCR-008',project:'PRJ-001',dateRaised:'2025-03-22',description:'Concrete slump exceeding 75mm spec at culvert',raisedBy:'[QC Inspector]',activity:'4.01',severity:'Major',corrective:'Reject & replace batch',due:'2025-03-30',closedDate:'2025-03-25',verifiedBy:'[Admin]',status:'Closed',createdBy:'system'},
    {id:'NCR-009',project:'PRJ-001',dateRaised:'2025-03-28',description:'Missing test certificates for G2 material',raisedBy:'[Resident Eng]',activity:'3.02',severity:'Minor',corrective:'Obtain certificates from supplier',due:'2025-04-10',closedDate:'',verifiedBy:'',status:'Open',createdBy:'system'},
    {id:'NCR-010',project:'PRJ-001',dateRaised:'2025-03-28',description:'Formwork alignment out of tolerance >5mm',raisedBy:'[QC Inspector]',activity:'4.01',severity:'Minor',corrective:'Rectify formwork before pour',due:'2025-04-05',closedDate:'',verifiedBy:'',status:'Open',createdBy:'system'},
  ],
  tbt: [
    {id:'TBT-022',project:'PRJ-001',date:'2026-03-28',topic:'Working at Heights – Fall Prevention',presenter:'[Admin]',attendees:23,location:'Site Office',duration:30,createdBy:'system'},
    {id:'TBT-021',project:'PRJ-001',date:'2026-03-27',topic:'Excavation Safety & Permit to Dig',presenter:'[SHEQ Officer]',attendees:18,location:'Excavation area',duration:20,createdBy:'system'},
    {id:'TBT-020',project:'PRJ-001',date:'2026-03-26',topic:'PPE Compliance & Inspection',presenter:'[Foreman]',attendees:15,location:'Site camp',duration:15,createdBy:'system'},
  ],
  grn: [
    {id:'GRN-001',project:'PRJ-001',date:'2025-01-05',supplier:'Swazi Cement Ltd',deliveryNote:'DN-4521',material:'OPC Cement 50kg',unit:'Bags',qtyOrdered:500,qtyReceived:500,unitCost:62,total:31000,boqCode:'3.02',receivedBy:'[Driver]',invoiceNo:'INV-7821',status:'Matched',createdBy:'system'},
    {id:'GRN-002',project:'PRJ-001',date:'2025-01-10',supplier:'SA Steel Pty',deliveryNote:'DN-0891',material:'Y16 Rebar 12m',unit:'Ton',qtyOrdered:8,qtyReceived:7.8,unitCost:11500,total:89700,boqCode:'4.01',receivedBy:'[Driver]',invoiceNo:'INV-0312',status:'Short',createdBy:'system'},
    {id:'GRN-003',project:'PRJ-001',date:'2025-01-12',supplier:'Aggregate Suppliers',deliveryNote:'DN-2210',material:'G2 Crushed Stone',unit:'m³',qtyOrdered:400,qtyReceived:400,unitCost:285,total:114000,boqCode:'3.02',receivedBy:'[Foreman]',invoiceNo:'INV-5544',status:'Matched',createdBy:'system'},
  ],
  issues: [
    {id:'ISS-045',project:'PRJ-001',date:'2026-03-27',material:'OPC Cement 50kg',unit:'Bags',qty:25,issuedTo:'Concrete Gang',activity:'ST-005',boqItem:'4.01',foreman:'[Supervisor]',location:'Culvert Ch 0+750',authorisedBy:'[Admin]',createdBy:'system'},
    {id:'ISS-046',project:'PRJ-001',date:'2026-03-27',material:'Y16 Rebar',unit:'Ton',qty:0.8,issuedTo:'Rebar Gang',activity:'ST-005',boqItem:'4.01',foreman:'[Supervisor]',location:'Culvert Ch 0+750',authorisedBy:'[Admin]',createdBy:'system'},
    {id:'ISS-047',project:'PRJ-001',date:'2026-03-27',material:'G2 Crushed Stone',unit:'m³',qty:80,issuedTo:'Paving Team',activity:'PV-003',boqItem:'3.02',foreman:'[Site Agent]',location:'Ch 0+800',authorisedBy:'[Admin]',createdBy:'system'},
  ],
  timesheets: [
    {id:'TS-001',project:'PRJ-001',date:'2026-03-29',employee:'[Foreman]',employeeId:'EMP-012',trade:'Foreman',hoursReg:8,hoursOT:2,activity:'EW-001',approvedBy:'[Admin]',status:'Approved',createdBy:'system'},
    {id:'TS-002',project:'PRJ-001',date:'2026-03-29',employee:'[Operator]',employeeId:'EMP-023',trade:'Operator',hoursReg:9.5,hoursOT:0,activity:'EW-001',approvedBy:'[Admin]',status:'Approved',createdBy:'system'},
    {id:'TS-003',project:'PRJ-001',date:'2026-03-28',employee:'[Supervisor]',employeeId:'EMP-031',trade:'Foreman',hoursReg:8,hoursOT:1.5,activity:'ST-005',approvedBy:'',status:'Pending',createdBy:'system'},
  ],
  dailyMeasurements: [],
  fuelIssues: [],
  fuelRecons: [],
  costingApprovals: [],
  documentArchive: [],
  userPreferences: [],
  drawingQtys: [],
  drawingTemplates: [],
  rateOverrides: [],
  transfers: [],        // inter-project transfers (worker/plant/fuel/material)
  manualCosts: [],
  fuelRequests: [],
  activityCodes: [],   // construction programme activities (per project)
  workers: [],          // site staff register (all workers, per project)
  foremenTeams: [],     // foreman → worker assignments (per project)
  timesheetEntries: [], // individual employee timesheet rows (per project)
  timesheetPeriods:  [], // open/close periods per project
  payrollPeriods:    [], // submitted payroll periods (persistent, loaded from GAS)
  payrollSettings:   [], // HR rate settings per project
  accRecords:        [], // records sent from Payroll to Accounting
  rolePermissions:   [], // custom role permission overrides
  ganttTasks: [],       // imported from MS Project / Gantt CSV
  costcodeTemplates: [
    {id:'CCT-001',code:'EW',description:'Earthworks',category:'Civil',standard:true},
    {id:'CCT-002',code:'PAVE',description:'Paving',category:'Civil',standard:true},
    {id:'CCT-003',code:'STRUCT',description:'Structures',category:'Civil',standard:true},
    {id:'CCT-004',code:'DRAIN',description:'Drainage',category:'Civil',standard:true},
    {id:'CCT-005',code:'PRELIM',description:'Preliminaries',category:'Preliminaries',standard:true},
    {id:'CCT-006',code:'PLANT',description:'Plant & Equipment',category:'Plant',standard:true},
    {id:'CCT-007',code:'SHEQ',description:'Safety & Health',category:'SHEQ',standard:true},
    {id:'CCT-008',code:'LABOUR',description:'Direct Labour',category:'Labour',standard:true},
  ],
  plantInventory: [
    {id:'PI-001',project:'PRJ-001',plantType:'Excavator',regId:'EX-01',description:'Caterpillar 320D Hydraulic Excavator 20T',ownerSupplier:'ConSite Pty',contactPerson:'J. Dlamini',contactPhone:'+268 7600 1111',minHours:8,minHoursRainy:4,minRate:1500,minRateRainy:600,fuelConsumption:18,fuelUnit:'L/hr',status:'Active',notes:'Service every 250hrs',createdBy:'system'},
    {id:'PI-002',project:'PRJ-001',plantType:'Grader',regId:'GR-01',description:'Caterpillar 140G Motor Grader',ownerSupplier:'ConSite Pty',contactPerson:'J. Dlamini',contactPhone:'+268 7600 1111',minHours:8,minHoursRainy:4,minRate:1200,minRateRainy:500,fuelConsumption:18,fuelUnit:'L/hr',status:'Active',notes:'',createdBy:'system'},
    {id:'PI-003',project:'PRJ-001',plantType:'TLB',regId:'TLB-01',description:'JCB 4CX Backhoe Loader',ownerSupplier:'ConSite Pty',contactPerson:'J. Dlamini',contactPhone:'+268 7600 1111',minHours:8,minHoursRainy:4,minRate:800,minRateRainy:400,fuelConsumption:8,fuelUnit:'L/hr',status:'Active',notes:'',createdBy:'system'},
  ],
  documents: [
    {id:'DOC-001',project:'PRJ-001',type:'BOQ',name:'BOQ_Rev3_Roads_2025.xlsx',dateImported:'2025-01-15',importedBy:'[Admin]',rev:'Rev 3',status:'Active',notes:'Approved BOQ',createdBy:'system'},
    {id:'DOC-002',project:'PRJ-001',type:'Drawings – Civil',name:'Civil_Drawings_Set_A.pdf',dateImported:'2025-01-15',importedBy:'[QS]',rev:'Rev 2',status:'Active',notes:'Full set',createdBy:'system'},
    {id:'DOC-003',project:'PRJ-001',type:'Specifications',name:'Project_Specs_v2.pdf',dateImported:'2025-01-16',importedBy:'[Admin]',rev:'v2',status:'Active',notes:'',createdBy:'system'},
  ],
  scurve: [
    {m:'Jan 25',p:2.5,a:2.8},{m:'Feb 25',p:6,a:6.2},{m:'Mar 25',p:11,a:10.8},
    {m:'Apr 25',p:18,a:17.5},{m:'May 25',p:26,a:25},{m:'Jun 25',p:33,a:32},
    {m:'Jul 25',p:40,a:38},{m:'Aug 25',p:47,a:45.5},{m:'Sep 25',p:52,a:51},
    {m:'Oct 25',p:59,a:58},{m:'Nov 25',p:67.5,a:null},{m:'Dec 25',p:75,a:null},
    {m:'Jan 26',p:82.5,a:null},{m:'Feb 26',p:89,a:null},
    {m:'Mar 26',p:94.5,a:null},{m:'Apr 26',p:100,a:null},
  ],
  // Collections that contain per-project transactional data
  _transactional: ['daily','plant','boq','incidents','ncr','tbt','grn','issues','timesheets','documents','costcodes','dailyMeasurements','plantInventory','fuelIssues','costcodeTemplates','fuelRecons','fuelRequests','activityCodes','ganttTasks','workers','foremenTeams','timesheetEntries','timesheetPeriods','payrollPeriods','payrollSettings','payrollPeriods','payrollSettings','accRecords','ipc','boqMeasurements','transfers'],

  // Called on login when NOT in demo mode — wipes all seeded demo records
  // so new projects start blank and only real GAS data is used
  clearForLive() {
    this._transactional.forEach(col => { this[col] = []; });
    this.projects = [];
    this.users = [];          // CRITICAL: wipe demo users — never push hardcoded users to GAS
    this.organizations = [];  // wipe demo orgs too
  },

  get(collection, project) {
    return (this[collection]||[]).filter(r => !project || r.project === project);
  },
  getOrg(id) { return (this.organizations||[]).find(o=>o.id===id)||null; },
  find(collection, id) {
    return (this[collection]||[]).find(r => r.id === id);
  },
  save(collection, record) {
    // Always stamp orgId — derived from current project's org or active org
    if(!record.orgId) {
      const proj = S.project ? DB.projects.find(p=>p.code===S.project) : null;
      record.orgId = proj?.orgId || _orgId();
    }
    const arr = this[collection] || (this[collection]=[]);
    const key = (collection==='projects') ? 'code' : 'id';
    const i = arr.findIndex(r => r[key] === record[key]);
    if(i >= 0) arr[i] = record; else arr.unshift(record);
    // Sync to GAS if live — NEVER push hardcoded demo records
    const _demoGuard = ['u1','u2','u3','PRJ-001','PRJ-002'];
    const _recId = record.id || record.code || '';
    if(!S.isDemo && S.scriptUrl && !_demoGuard.includes(_recId)) {
      const sheetMap = {
        daily:'DailyRecords', plant:'Plant', plantInventory:'PlantInventory', grn:'GRN', issues:'Issues',
        incidents:'Incidents', ncr:'NCR', tbt:'TBT', timesheets:'Timesheets', timesheetEntries:'TimesheetEntries',
        timesheetPeriods:'TimesheetPeriods', documents:'Documents', materialUsage:'MaterialUsage',
        boq:'BOQ', boqMeasurements:'BOQMeasurements', dailyMeasurements:'DailyMeasurements', ipc:'IPC',
        budgets:'Budgets', manualCosts:'ManualCosts', fuelIssues:'FuelIssues', fuelRequests:'FuelRequests',
        fuelRecons:'FuelRecons', costingApprovals:'CostingApprovals', documentArchive:'DocumentArchive',
        subContractors:'SubContractors', subContractorBOQ:'SubContractorBOQ', subContractorCosts:'SubContractorCosts',
        foremenTeams:'ForemenTeams', suppliers:'Suppliers', workers:'Workers', projects:'Projects',
        transfers:'Transfers', pendingTransfers:'PendingTransfers', purchaseOrders:'PurchaseOrders',
        payrollPeriods:'PayrollPeriods', payrollSettings:'PayrollSettings', costcodes:'CostCodes', costCodes:'CostCodes',
        costCodeTemplates:'CostCodeTemplates', activityCodes:'ActivityCodes', complexActivities:'ComplexActivities',
        rolePermissions:'RolePermissions', users:'Users', organizations:'Organizations', accRecords:'AccRecords',
        reports:'Reports', management:'Management', rateOverrides:'RateOverrides', userPreferences:'UserPreferences', drawingQtys:'DrawingQuantities', drawingTemplates:'DrawingTemplates',
        ganttTasks:'GanttTasks', appSettings:'AppSettings'
      };
      const sheet = sheetMap[collection];
      if(sheet) GAS.post({action:'save', sheet, record}).catch(()=>{});
      else console.warn('Save not synced — no sheet mapping for collection:', collection);
    }
    // ── localStorage — persists SC + key collections across reloads ──────
    try{
      const _lsCols=['subContractors','subContractorBOQ','subContractorCosts',
        'boqMeasurements','complexActivities','ipc'];
      const _pr=record.project||'';
      if(_pr&&record.id&&_lsCols.includes(collection)){
        const _k='cm_ls_'+collection+'_'+_pr;
        const _arr=JSON.parse(localStorage.getItem(_k)||'[]');
        const _i=_arr.findIndex(x=>x.id===record.id);
        if(_i>=0) _arr[_i]=record; else _arr.push(record);
        localStorage.setItem(_k,JSON.stringify(_arr));
      }
    }catch(_e){}
  },
  // ── Restore localStorage-persisted collections on project load ─────────
  _applyOverrides(project){
    if(!project) return;
    const _cols=['subContractors','subContractorBOQ','subContractorCosts',
      'boqMeasurements','complexActivities','ipc'];
    _cols.forEach(col=>{
      try{
        const _arr=JSON.parse(localStorage.getItem('cm_ls_'+col+'_'+project)||'[]');
        if(!this[col]) this[col]=[];
        _arr.forEach(r=>{
          const idx=this[col].findIndex(e=>e.id===r.id);
          if(idx>=0) this[col][idx]=r; else this[col].push(r);
        });
      }catch(_e){}
    });
  },
  remove(collection, id) {
    const _removedRec=this[collection]?.find(r=>r.id===id);
    if(this[collection]) this[collection] = this[collection].filter(r => r.id !== id);
    try{
      const _pr=_removedRec?.project||'';
      if(_pr){
        const _k='cm_ls_'+collection+'_'+_pr;
        const _a=JSON.parse(localStorage.getItem(_k)||'[]').filter(r=>r.id!==id);
        localStorage.setItem(_k,JSON.stringify(_a));
      }
    }catch(_e){}
    // Sync delete to GAS if live
    if(!S.isDemo && S.scriptUrl) {
      const sheetMap = {
        daily:'DailyRecords', plant:'Plant', plantInventory:'PlantInventory', grn:'GRN', issues:'Issues',
        incidents:'Incidents', ncr:'NCR', tbt:'TBT', timesheets:'Timesheets', timesheetEntries:'TimesheetEntries',
        timesheetPeriods:'TimesheetPeriods', documents:'Documents', materialUsage:'MaterialUsage',
        boq:'BOQ', boqMeasurements:'BOQMeasurements', dailyMeasurements:'DailyMeasurements', ipc:'IPC',
        budgets:'Budgets', manualCosts:'ManualCosts', fuelIssues:'FuelIssues', fuelRequests:'FuelRequests',
        fuelRecons:'FuelRecons', costingApprovals:'CostingApprovals', documentArchive:'DocumentArchive', userPreferences:'UserPreferences', rateOverrides:'RateOverrides', drawingQtys:'DrawingQuantities', drawingTemplates:'DrawingTemplates', subContractors:'SubContractors', subContractorCosts:'SubContractorCosts',
        subContractorBOQ:'SubContractorBOQ', foremenTeams:'ForemenTeams', suppliers:'Suppliers', workers:'Workers',
        projects:'Projects', transfers:'Transfers', pendingTransfers:'PendingTransfers', purchaseOrders:'PurchaseOrders',
        payrollPeriods:'PayrollPeriods', payrollSettings:'PayrollSettings', costCodes:'CostCodes',
        costCodeTemplates:'CostCodeTemplates', activityCodes:'ActivityCodes', complexActivities:'ComplexActivities',
        rolePermissions:'RolePermissions', users:'Users', organizations:'Organizations', accRecords:'AccRecords',
        reports:'Reports', management:'Management', rateOverrides:'RateOverrides', userPreferences:'UserPreferences', drawingQtys:'DrawingQuantities', drawingTemplates:'DrawingTemplates',
        ganttTasks:'GanttTasks', appSettings:'AppSettings'
      };
      const sheet = sheetMap[collection];
      if(sheet) GAS.post({action:'delete', sheet, id}).catch(e=>toast('Sync error: '+e.message,'err'));
      else console.warn('Delete not synced — no sheet mapping for collection:', collection);
    }
  },
  getProject(code) { return this.projects.find(p => p.code === code) || null; },
  getUserProjects(userId) {
    // Use S.user directly for the logged-in user — DB.users may not be loaded yet
    const u = (userId === S.user?.id) ? S.user : this.users.find(u => u.id === userId);
    if(!u) return [];
    if(u.role === 'Admin') return this.projects;
    // Normalise: projects may be a comma-sep string OR an array
    const codes = Array.isArray(u.projects)
      ? u.projects
      : (String(u.projects||'')).split(',').map(s=>s.trim()).filter(Boolean);
    if(!codes.length) return [];
    return this.projects.filter(p => codes.includes(p.code));
  },
};

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
const S = { user:null, project:null, org:null, mainTab:'dashboard', subTab:'input', isDemo:true, scriptUrl:'', chart:null };

/* Plan tier limits — fail-open: unknown plan (GAS / no subscription) never restricts. */
var PLAN = {
  _rank:{trial:0,starter:1,pro:2,max:3},
  // ── Subscription standing (loaded at login) ──────────────────────────────
  // Warn the tenant BEFORE the subscription lapses: once it does, org_active()
  // blocks every write at the database and the app appears broken with no notice.
  sub:function(){ try{ return window._subInfo||{}; }catch(e){ return {}; } },
  daysLeft:function(){
    var s=this.sub(); var d=s.activeUntil||s.trialEnds||'';
    if(!d) return null;
    try{
      var end=new Date(String(d).slice(0,10)+'T23:59:59');
      if(isNaN(end)) return null;
      return Math.ceil((end - new Date())/86400000);
    }catch(e){ return null; }
  },
  renderBanner:function(){
    var el=document.getElementById('cm-sub-banner'); if(!el) return;
    var s=this.sub(), st=String(s.status||'').toLowerCase(), d=this.daysLeft();
    var msg='', bg='', bd='', col='';
    if(st && st!=='active' && st!=='trial'){
      msg='⛔ <b>Subscription '+st+'</b> — saving is disabled until it is reactivated. Please contact your provider.';
      bg='rgba(239,68,68,.10)'; bd='rgba(239,68,68,.35)'; col='var(--red)';
    } else if(d!==null && d<=0){
      msg='⛔ <b>Subscription expired</b> — saving is disabled. Please renew to continue.';
      bg='rgba(239,68,68,.10)'; bd='rgba(239,68,68,.35)'; col='var(--red)';
    } else if(d!==null && d<=14){
      var lbl=(st==='trial')?'Trial':'Subscription';
      msg='⚠ <b>'+lbl+' ends in '+d+' day'+(d===1?'':'s')+'</b>'+(d<=3?' — renew now to avoid interruption.':' — please arrange renewal.');
      bg='rgba(249,115,22,.10)'; bd='rgba(249,115,22,.35)'; col='var(--orange)';
    }
    if(!msg){ el.style.display='none'; el.innerHTML=''; return; }
    el.style.cssText='display:block;background:'+bg+';border:1px solid '+bd+';color:'+col
      +';padding:8px 14px;font-size:12px;font-weight:600;line-height:1.5';
    el.innerHTML=msg;
  },
  cur:function(){ return (S.user&&S.user.plan)||''; },
  known:function(){ return this._rank[this.cur()]!==undefined; },
  level:function(){ var r=this._rank[this.cur()]; return r===undefined?99:r; },
  maxProjects:function(){ var c=this.cur(); if(c==='trial')return 1; if(c==='starter')return 2; if(c==='pro')return 10; return Infinity; },
  has:function(mod){ var need={payroll:2,accounting:2}[mod]; if(need===undefined)return true; if(!this.known())return true; return this.level()>=need; },
  projectsFull:function(){ if(!this.known())return false; return (DB.projects||[]).length >= this.maxProjects(); },
  _keyGates:{ suppliers:1, orders:1, stores:1, plant:1, subcontractors:2, costing:2 },
  keyBlocked:function(key){ var need=this._keyGates[key]; if(need===undefined) return false; if(!this.known()) return false; return this.level() < need; },
  isProPlus:function(){ var c=this.cur(); return c==='pro'||c==='max'; }
};

/* ═══════════════════════════════════════════════════
   SCREEN ROUTER
═══════════════════════════════════════════════════ */
const Screen = {
  show(id) {
    qsa('.screen').forEach(s => s.classList.remove('active'));
    ge('screen-' + id).classList.add('active');
  }
};

/* ═══════════════════════════════════════════════════
   SETUP
═══════════════════════════════════════════════════ */
/* ─── APPS SCRIPT CODE (embedded) ─────────────────── */
const GAS_SCRIPT = `// CivMetrix v4.0 — Google Apps Script (JSONP)
// ─────────────────────────────────────────────────────────────
// SETUP: Paste ALL of this into Extensions → Apps Script
//        Replace any existing code. Save (Ctrl+S).
//        Deploy → New Deployment → Web App
//          Execute as: Me
//          Who has access: Anyone
//        Copy the /exec URL (NOT /dev).
// ─────────────────────────────────────────────────────────────

// !! No SpreadsheetApp calls at global scope !!
// All spreadsheet access is inside functions so GAS errors are
// caught and returned as JSON instead of crashing silently.

var SHEET_HEADERS = {
  Users:             'id|name|username|email|password|role|company|projects|orgId',
  RolePermissions:    'id|orgId|feature|Admin|Editor|Approver|DataEntry|Foreman|StoresAssistant|Viewer|updatedBy|updatedAt',
  Projects:          'code|name|client|value|startDate|endDate|pm|status|contractNo|contractType|duration|workingDays|location|orgId|schedule|userAssignments|notes|createdBy|createdAt',
  DailyRecords:      'id|orgId|project|date|weather|section|foreman|skilled|semiSkilled|general|subContract|total|target|hrsWorked|otHours|activityCode|location|remarks|labourCost|actStartTime|actEndTime|actHrs|labourApproved|labourBoqItem|labourActCode|labourApprovedBy|labourApprovedAt|createdBy|createdAt',
  Plant:             'id|orgId|project|date|type|regId|ownerSupplier|hrOpening|hrClosing|hrsWorked|activityStart|activityEnd|activityHrs|idleHrs|incWeather|breakdown|bdStartTime|bdEndTime|bdDescription|weather|rateType|status|activityCode|location|boqItem|serviceType|approved|approvedBy|approvedAt|createdBy|remarks',
  BOQ:               'id|orgId|project|item|description|unit|contractQty|rate|prevQty|todayQty|manualPrevQty|total|pct|targetPct|costCodes|activityCodes|section|subSection',
  CostCodes:         'id|orgId|project|code|description|category|budget|budgetLines|status',
  CostCodeTemplates: 'id|orgId|code|description|category|standard|budgetLines',
  ActivityCodes:     'id|orgId|project|code|name|discipline|startDate|finishDate|duration|predecessors|notes|createdBy',
  GanttTasks:        'id|orgId|project|taskName|duration|start|finish|activityCode|wbs|level|predecessors|resourceNames|percentComplete|isMilestone|notes|importedAt',
  Organizations:     'id|name|type|country|currency|regNo|address|postal|phone|email|website|logo|createdBy|createdAt',
  AppSettings:       'id|key|value|updatedBy|updatedAt',
  Incidents:         'id|orgId|project|date|type|description|location|injured|severity|lostDays|investigatedBy|rootCause|corrective|due|status|createdBy',
  NCR:               'id|orgId|project|date|type|material|unit|raisedBy|raisedAgainst|returnedBy|relatedReturnId|qtyClaimedByForeman|actualQtyReceived|qtyShortage|claimedCondition|actualCondition|description|foremanExplanationRequired|foremanResponse|respondedBy|responseDate|correctiveAction|resolution|closedBy|closedDate|status|createdBy',
  TBT:               'id|orgId|project|date|topic|presenter|attendees|location|duration|createdBy',
  GRN:               'id|orgId|project|date|dateRequested|dateRequired|lostDays|supplier|deliveryNote|invoiceNo|material|unit|qtyOrdered|qtyReceived|unitCost|total|orderId|orderNumber|receivedBy|status|notes|createdBy',
  Issues:            'id|orgId|project|date|type|parentIssueId|material|unit|qty|rate|amount|issuedTo|foreman|condition|returnReason|returnedBy|addToStock|storesStatus|storesConfirmedBy|storesConfirmedDate|storesActualQty|storesActualCondition|storesNotes|deductFromBalance|ncrId|notes|activity|boqItem|location|authorisedBy|approved|approvedBy|approvedAt|createdBy',

  Management:         'id|orgId|project|name|idNumber|employeeId|gender|phone|email|address|nextOfKin|nextOfKinPhone|role|discipline|qualifications|experience|contractType|startDate|endDate|status|notes|hourlyRate|rateUnit|payMethod|bankName|accountNumber|branchCode|reportsTo|createdBy|createdAt|updatedAt|hourlyRate|rateUnit|payMethod|bankName|accountNumber|branchCode|reportsTo|createdBy|createdAt|updatedAt',
  Workers:           'id|orgId|project|name|employeeId|idNumber|trade|skillLevel|contractType|hourlyRate|startDate|endDate|status|phone|address|nextOfKin|nextOfKinPhone|payMethod|bankName|branchCode|accountNumber|mobileMoneyNumber|helmetSize|vestSize|bootSize|gloveSize|overallSize|attachments|notes|createdBy',
  ForemenTeams:      'id|orgId|project|foremanName|foremanEmployeeId|foremanTrade|foremanSkillLevel|foremanHourlyRate|foremanPhone|foremanIdNumber|workerIds|teamName|teamActivity|teamLocation|teamStatus|notes|createdBy|createdAt|updatedAt',
  TimesheetEntries:  'id|orgId|project|date|foremanId|foremanName|workerId|workerName|skillLevel|description|activities|dayStart|dayEnd|activityStart|activityEnd|lunchStart|lunchEnd|lunchMins|totalHrs|hoursReg|hoursOT|present|lateStart|lateStartReason|earlyFinish|earlyFinishReason|absentReason|dateType|hasLunch|notes|createdBy|labourBoqItem|labourActCode|labourIpcNo|labourComplexId',
  TimesheetPeriods:   'id|orgId|project|openDate|closeDate|status|createdBy|closedBy|closedAt',
  Timesheets:        'id|orgId|project|date|employee|employeeId|trade|hoursReg|hoursOT|activity|approvedBy|status|createdBy',
  Documents:         'id|orgId|project|type|name|dateImported|importedBy|rev|status|notes|createdBy',
  DailyMeasurements: 'id|orgId|project|date|boqItem|costCode|activityDescription|activityCode|unit|location|d1|d2|d3|totalQty|foreman|foremanId|status|submittedBy|createdBy|createdAt',
  PlantInventory:    'id|orgId|project|plantType|regId|description|capacity|year|ownerSupplier|contactPerson|contactPhone|contactEmail|minHours|minRate|minRateRainy|standbyRate|rateType|fuelType|tankCapacity|fuelConsumption|fuelUnit|serviceInterval|status|notes|createdBy|minHoursRainy',
  FuelIssues:        'id|orgId|project|date|startTime|endTime|regId|plantType|ownerSupplier|bowserOpen|bowserClose|bowserTotal|litres|costPerLitre|cost|odometer|issuedBy|reconStatus|notes|createdBy',
  ManualCosts:       'id|orgId|project|date|category|description|vendor|amount|items|invoiceRef|approvedBy|createdBy|updatedAt',
  FuelRecons:        'id|project|orgId|dateFrom|dateTo|broughtForward|received|totalAvailable|consumed|carriedForward|docType|docRef|linkedRequestId|attachment|attachmentName|notes|createdBy|createdAt',
  FuelRequests:      'id|project|orgId|reconId|dateRequested|qtyRequested|rate|urgency|leadTime|dateRequired|status|supplierName|poNumber|dateReceived|qtyReceived|checkedBy1Name|checkedBy1Date|checkedBy1Sig|checkedBy2Name|checkedBy2Date|checkedBy2Sig|docType|docRef|notes|createdBy',
  Suppliers:         'id|orgId|code|name|contactPerson|phone|email|address|taxNumber|category|materials|status|notes|createdBy|updatedAt',
  PurchaseOrders:    'id|orgId|project|orderHeaderId|orderNumber|orderDate|requiredDate|supplier|supplierId|material|unit|qtyOrdered|unitCost|totalValue|status|notes|createdBy|updatedAt',
  MaterialUsage:     'id|orgId|project|issueId|date|foreman|material|unit|activityCode|activityDesc|usedQty|rate|cost|createdBy',
  PendingTransfers:  'id|orgId|project|date|workerId|workerName|fromTeamId|fromForemanName|toTeamId|toForemanName|transferTime|transferType|reason|status|createdBy',
  Transfers:         'id|orgId|project|resourceType|fromProject|toProject|date|effectiveDate|resourceId|resourceRef|resourceName|qty|unit|value|hourMeter|odometer|status|initiatedBy|initiatedAt|receivedBy|receivedAt|rejectReason|notes|createdBy|snapshot',
  PayrollPeriods:    'id|orgId|project|contractNo|periodRef|openDate|closeDate|submittedBy|submittedAt|status|attachmentRef|hrNotes|settingsSnapshot|workerBreakdown|deductions|workers|entries|totalReg|totalOT|totalGross|totalNet',
  PayrollSettings:   'id|project|wknorm|wkot|sat12am|sat12pm|sun|holWork|holRest|stdDayHrs|snpfPct|payePct|gradedTax|holidayPayable|holidayShifts',
  AccRecords:        'id|periodId|project|contractNo|periodRef|openDate|closeDate|submittedBy|submittedAt|totalGross|totalNet|workers|status|payrollSnapshot|workerBreakdown|deductions',
  ComplexActivities: 'id|orgId|project|name|boqId|actCode|status|_count|createdBy|createdAt|completedAt',
  Reports:           'id|orgId|project|title|type|dateRange|createdAt|createdBy',
  SubContractors:    'id|orgId|project|company|contactPerson|phone|email|trade|contractNo|contractValue|startDate|endDate|status|notes|createdBy',
  SubContractorBOQ:  'id|orgId|project|subContractorId|itemNo|description|key|unit|quantity|rate',
  SubContractorCosts:'id|orgId|project|date|foremanId|foremanName|subContractorId|scBoqId|key|description|company|unit|rate|qty|cost|location|notes|createdBy',
  IPC:               'id|orgId|project|ipcNo|date|items|totalValue|status|createdBy',
  BOQMeasurements:   'id|orgId|project|boqId|boqItemNo|boqDescription|date|description|location|d1|d2|d3|gpsPhoto|qty|unit|foremanName|syncKey|ipcNo|complexComponents|createdBy',
  TimesheetEntries:  'id|orgId|project|date|foremanId|foremanName|workerId|workerName|skillLevel|description|activities|dayStart|dayEnd|activityStart|activityEnd|lunchStart|lunchEnd|lunchMins|totalHrs|hoursReg|hoursOT|present|lateStart|lateStartReason|earlyFinish|earlyFinishReason|absentReason|dateType|hasLunch|notes|createdBy|labourBoqItem|labourActCode|labourIpcNo|labourComplexId',
  ComplexActivities: 'id|orgId|project|name|boqId|boqItemNo|status|_count|createdBy|createdAt|completedAt',
  SubContractors:    'id|orgId|project|company|contactPerson|phone|email|trade|contractNo|contractValue|startDate|endDate|status|notes|createdBy',
  SubContractorBOQ:  'id|orgId|project|subContractorId|itemNo|description|key|unit|quantity|rate|company',
  SubContractorCosts:'id|orgId|project|date|foremanId|foremanName|subContractorId|scBoqId|key|description|activity|company|unit|rate|qty|cost|location|notes|createdBy',
};

// ── Safe spreadsheet access (never at global scope) ───────────────────────────
function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ── JSONP response ─────────────────────────────────────────────────────────────
function respond(e, data) {
  var cb  = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : 'callback';
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ── Lazy sheet creator ─────────────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (s) return s;
  var hdrs = (SHEET_HEADERS[name] || 'id').split('|');
  s = ss.insertSheet(name);
  var r = s.getRange(1, 1, 1, hdrs.length);
  r.setValues([hdrs]);
  r.setFontWeight('bold').setBackground('#1a1f2e').setFontColor('#f0a500');
  s.setFrozenRows(1);
  return s;
}

// ── initSheets: create all missing sheets (called once after ping) ─────────────
function initSheets(ss) {
  if(!ss) ss = getSS();
  var existing = {};
  ss.getSheets().forEach(function(s) { existing[s.getName()] = true; });
  var created = 0, updated = 0;
  Object.keys(SHEET_HEADERS).forEach(function(name) {
    if (!existing[name]) {
      getOrCreateSheet(ss, name);
      created++;
    } else {
      // Add any missing columns to existing sheets (safe migration)
      var sh = ss.getSheetByName(name);
      var headers = SHEET_HEADERS[name].split('|');
      var cur = sh.getLastColumn() > 0
        ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String)
        : [];
      var added = 0;
      headers.forEach(function(h) {
        if(h && cur.indexOf(h) < 0) {
          sh.getRange(1, sh.getLastColumn()+1).setValue(h);
          added++;
        }
      });
      if(added > 0) updated++;
    }
  });
  return { ok: true, created: created, updated: updated, total: Object.keys(SHEET_HEADERS).length };
}

// ── Main entry point ───────────────────────────────────────────────────────────
function verifyEmployee(ss, empNo, organization) {
  if(!empNo || !organization) return {found:false};
  // Check Management sheet first
  var sheets = ['Management','Workers'];
  for(var si=0; si<sheets.length; si++) {
    var sh = ss.getSheetByName(sheets[si]);
    if(!sh || sh.getLastRow() < 2) continue;
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(function(h){return String(h).trim().toLowerCase();});
    var empIdCol = headers.indexOf('employeeid');
    var nameCol  = headers.indexOf('name');
    var roleCol  = headers.indexOf('role');
    var tradeCol = headers.indexOf('trade');
    var orgIdCol = headers.indexOf('orgid');
    if(empIdCol < 0) continue;
    for(var i=1; i<data.length; i++) {
      var rowEmpNo = String(data[i][empIdCol]||'').trim().toLowerCase();
      if(rowEmpNo === String(empNo).trim().toLowerCase()) {
        // Verify organization by checking Organizations sheet
        var orgSh = ss.getSheetByName('Organizations');
        var orgMatch = false;
        if(orgSh && orgSh.getLastRow() > 1) {
          var orgData = orgSh.getDataRange().getValues();
          var oHeaders = orgData[0].map(function(h){return String(h).trim().toLowerCase();});
          var oNameCol = oHeaders.indexOf('name');
          var oIdCol   = oHeaders.indexOf('id');
          if(orgIdCol >= 0 && oIdCol >= 0 && oNameCol >= 0) {
            var rowOrgId = String(data[i][orgIdCol]||'').trim();
            for(var oi=1; oi<orgData.length; oi++) {
              var oName = String(orgData[oi][oNameCol]||'').trim().toLowerCase();
              var oId   = String(orgData[oi][oIdCol]||'').trim();
              if(oName === String(organization).trim().toLowerCase() && (!rowOrgId || oId === rowOrgId)) {
                orgMatch = true; break;
              }
            }
          }
        }
        if(!orgMatch && orgSh) {
          // Fallback: org not found — still allow if empNo matches (org may not be stored yet)
          orgMatch = true;
        }
        if(orgMatch) {
          return {
            found: true,
            employeeId: String(data[i][empIdCol]||''),
            name: nameCol >= 0 ? String(data[i][nameCol]||'') : '',
            role: roleCol >= 0 ? String(data[i][roleCol]||'') : (tradeCol >= 0 ? String(data[i][tradeCol]||'') : '')
          };
        }
      }
    }
  }
  return {found:false};
}

function doGet(e) {
  try {
    var ss     = getSS();                              // inside try — errors become JSON
    var action = (e.parameter.action || '').trim();
    var cb     = e.parameter.callback || 'callback';

    // Write path (POST encoded as GET)
    if (e.parameter.method === 'POST') {
      var data = JSON.parse(e.parameter.payload || '{}');
      var act  = data.action || '';
      var res;
      if      (act === 'register')      res = register(ss, data);
      else if (act === 'save')          res = saveRecord(ss, data.sheet, data.record);
      else if (act === 'batchSave')     res = batchSaveRecords(ss, data.sheet, data.records);
      else if (act === 'batchSaveBOQ')  res = batchSaveBOQ(ss, data.project, data.records);
      else if (act === 'saveIPC')       res = saveRecord(ss, 'IPC', data.record);
      else if (act === 'saveMeas')      res = saveRecord(ss, 'BOQMeasurements', data.record);
      else if (act === 'delete')        res = deleteRecord(ss, data.sheet, data.id);
      else if (act === 'clearBOQ')      res = clearBOQ(ss, data.project);
      else if (act === 'deleteBOQItem') res = deleteBOQItem(ss, data.project, data.item);
      else if (act === 'initSheets')    res = initSheets(ss);
      else                              res = { error: 'Unknown action: ' + act };
      return respond(e, res);
    }

    // Read path
    if (action === 'ping') {
      // Ultra-fast: just check if Users sheet exists and has rows
      var us    = ss.getSheetByName('Users');
      var first = !us || us.getLastRow() <= 1;
      return respond(e, { ok: true, v: '5.2', firstRun: first });
    }
    if (action === 'initSheets')  return respond(e, initSheets(ss));
    if (action === 'login')       return respond(e, login(ss, e.parameter.email, e.parameter.password));
    if (action === 'checkOrgs')   return respond(e, checkOrgs(ss, e.parameter.name));
    if (action === 'getProjects') return respond(e, getProjects(ss, e.parameter.userId));
    if (action === 'getData')        return respond(e, getData(ss, e.parameter.sheet, e.parameter.project || ''));
    if (action === 'getPermissions') return respond(e, getPermissions(ss, e.parameter.orgId || ''));

    if (action === 'verifyEmployee') return respond(e, verifyEmployee(ss, e.parameter.empNo, e.parameter.organization));
    return respond(e, { error: 'Unknown action: ' + action });

  } catch (err) {
    // Always return JSON — never let GAS return an HTML error page
    try {
      return respond(e, { error: err.message || String(err) });
    } catch(e2) {
      return ContentService.createTextOutput('callback({"error":"fatal: ' + String(err) + '"});')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
  }
}

function doPost(e) {
  try {
    var ss   = getSS();
    var data = JSON.parse((e.postData && e.postData.contents) || '{}');
    var act  = data.action || '';
    if (act === 'save')        return respond(e, saveRecord(ss, data.sheet, data.record));
    if (act === 'register')    return respond(e, register(ss, data));
    if (act === 'delete')      return respond(e, deleteRecord(ss, data.sheet, data.id));
    if (act === 'initSheets')  return respond(e, initSheets(ss));
    return respond(e, { error: 'Unknown: ' + act });
  } catch(err) { return respond(e, { error: err.message }); }
}

// ── Default permission matrix (server-side source of truth) ──────────────────
// Columns: Admin | Editor | Approver | DataEntry | Foreman | Viewer
var DEFAULT_PERMISSIONS = [
  {cat:'Tabs',       feature:'<span class="material-icons-outlined" aria-hidden="true">dashboard</span> Dashboard',         Admin:'full', Editor:'full', Approver:'full', DataEntry:'full', Foreman:'full', StoresAsst:'none', Viewer:'full'},
  {cat:'Tabs',       feature:'<span class="material-icons-outlined" aria-hidden="true">factory</span> Production',         Admin:'full', Editor:'full', Approver:'full', DataEntry:'full', Foreman:'full', StoresAsst:'full', Viewer:'view'},
  {cat:'Tabs',       feature:'<span class="material-icons-outlined" aria-hidden="true">business</span> Organization',       Admin:'full', Editor:'full', Approver:'none', DataEntry:'none', Foreman:'none', StoresAsst:'none', Viewer:'none'},
  {cat:'Tabs',       feature:'<span class="material-icons-outlined" aria-hidden="true">settings</span> Settings',            Admin:'full', Editor:'view', Approver:'none', DataEntry:'none', Foreman:'none', Viewer:'none'},
  {cat:'Tabs',       feature:'<span class="material-icons-outlined" aria-hidden="true">lock</span> Role Permissions',   Admin:'full', Editor:'none', Approver:'none', DataEntry:'none', Foreman:'none', Viewer:'none'},
  {cat:'Production', feature:'Daily Records',          Admin:'full', Editor:'full', Approver:'view', DataEntry:'full', Foreman:'full', Viewer:'view'},
  {cat:'Production', feature:'Measurement Sheets',     Admin:'full', Editor:'full', Approver:'full', DataEntry:'full', Foreman:'none', Viewer:'view'},
  {cat:'Production', feature:'Stores (GRN/Issues)',    Admin:'full', Editor:'full', Approver:'view', DataEntry:'full', Foreman:'none', Viewer:'view'},
  {cat:'Production', feature:'SHEQ',                   Admin:'full', Editor:'full', Approver:'full', DataEntry:'full', Foreman:'view', Viewer:'view'},
  {cat:'Production', feature:'👷 Team Management',    Admin:'full', Editor:'full', Approver:'view', DataEntry:'full', Foreman:'full', Viewer:'none'},
  {cat:'Production', feature:'<span class="material-icons-outlined" aria-hidden="true">precision_manufacturing</span> Plant Inventory',    Admin:'full', Editor:'full', Approver:'view', DataEntry:'full', Foreman:'view', Viewer:'view'},
  {cat:'Production', feature:'⛽ Fuel Management',    Admin:'full', Editor:'full', Approver:'view', DataEntry:'full', Foreman:'view', Viewer:'view'},
  {cat:'Production', feature:'<span class="material-icons-outlined" aria-hidden="true">list</span> Activity Codes',     Admin:'full', Editor:'full', Approver:'view', DataEntry:'none', Foreman:'view', Viewer:'view'},
  {cat:'Team Mgmt',  feature:'<span class="material-icons-outlined" aria-hidden="true">schedule</span> Timesheet Records',  Admin:'full', Editor:'full', Approver:'full', DataEntry:'view', Foreman:'full', Viewer:'none'},
  {cat:'Team Mgmt',  feature:'<span class="material-icons-outlined" aria-hidden="true">groups</span> Foremen &amp; Teams',   Admin:'full', Editor:'full', Approver:'view', DataEntry:'view', Foreman:'full', Viewer:'none'},
  {cat:'Team Mgmt',  feature:'<span class="material-icons-outlined" aria-hidden="true">engineering</span> Workers Register',  Admin:'full', Editor:'full', Approver:'view', DataEntry:'view', Foreman:'full', Viewer:'none'},
  {cat:'Actions',    feature:'＋ Recruit Labour',      Admin:'full', Editor:'full', Approver:'none', DataEntry:'none', Foreman:'none', StoresAsst:'none', Viewer:'none'},
  {cat:'Actions',    feature:'＋ Configure Team',      Admin:'full', Editor:'full', Approver:'none', DataEntry:'none', Foreman:'none', StoresAsst:'none', Viewer:'none'},
  {cat:'Actions',    feature:'⏱ New Timesheet Entry', Admin:'full', Editor:'full', Approver:'full', DataEntry:'full', Foreman:'full', Viewer:'none'},
  {cat:'Actions',    feature:'🖨 Print Timesheets',   Admin:'full', Editor:'full', Approver:'full', DataEntry:'view', Foreman:'full', Viewer:'none'},
  {cat:'Actions',    feature:'＋ Add Daily Record',    Admin:'full', Editor:'full', Approver:'none', DataEntry:'full', Foreman:'full', Viewer:'none'},
  {cat:'Actions',    feature:'⊞ Close BOQ Period',    Admin:'full', Editor:'full', Approver:'full', DataEntry:'none', Foreman:'none', Viewer:'none'},
  {cat:'Actions',    feature:'＋ New Project',         Admin:'full', Editor:'none', Approver:'none', DataEntry:'none', Foreman:'none', Viewer:'none'},
  {cat:'Actions',    feature:'Manage Users / Roles',   Admin:'full', Editor:'view', Approver:'none', DataEntry:'none', Foreman:'none', Viewer:'none'},
  {cat:'Actions',    feature:'Import BOQ / Gantt',     Admin:'full', Editor:'full', Approver:'none', DataEntry:'none', Foreman:'none', StoresAsst:'none', Viewer:'none'},
  {cat:'Actions',    feature:'Delete Records',         Admin:'full', Editor:'none', Approver:'none', DataEntry:'none', Foreman:'none', Viewer:'none'},
];

// ── Get permissions for org (seeds from defaults if sheet is empty) ────────────
function getPermissions(ss, orgId) {
  var s = getOrCreateSheet(ss, 'RolePermissions');
  var rows = sheetToArray(s);
  var orgRows = rows.filter(function(r) { return !r.orgId || r.orgId === orgId; });
  if (orgRows.length > 0) return orgRows; // return what's in the sheet

  // Sheet is empty for this org — seed from defaults and save
  var now = new Date().toISOString();
  var seeded = DEFAULT_PERMISSIONS.map(function(p) {
    return {
      id:         'RP-' + p.feature.replace(/[^a-zA-Z0-9]/g,'').slice(0,20) + '-' + orgId.slice(0,8),
      orgId:      orgId,
      cat:        p.cat,
      feature:    p.feature,
      Admin:      p.Admin,
      Editor:     p.Editor,
      Approver:   p.Approver,
      DataEntry:  p.DataEntry,
      Foreman:    p.Foreman,
      Viewer:     p.Viewer,
      updatedBy:  'system',
      updatedAt:  now
    };
  });
  // Ensure all columns exist then write rows
  if (seeded.length > 0) {
    Object.keys(seeded[0]).forEach(function(col) { ensureColumn(s, col); });
    var h = s.getDataRange().getValues()[0];
    var dataRows = seeded.map(function(r) {
      return h.map(function(col) { return r[col] !== undefined ? r[col] : ''; });
    });
    s.getRange(s.getLastRow() + 1, 1, dataRows.length, h.length).setValues(dataRows);
  }
  return seeded;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function login(ss, email, password) {
  var s = ss.getSheetByName('Users');
  if (!s || s.getLastRow() <= 1) return { error: 'FIRST_RUN' };
  var rows = sheetToArray(s);
  var input = String(email||'').toLowerCase().trim();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    // Match by username OR email, plus password
    var usernameMatch = row.username && String(row.username).toLowerCase() === input;
    var emailMatch    = row.email    && String(row.email).toLowerCase()    === input;
    if ((usernameMatch || emailMatch) && String(row.password) === String(password)) return row;
  }
  return { error: 'Invalid credentials' };
}

function register(ss, data) {
  var s    = getOrCreateSheet(ss, 'Users');
  var rows = sheetToArray(s);
  // Check duplicate username
  var uname = String(data.username||'').toLowerCase().trim();
  if(!uname) return { error: 'Username is required' };
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].username||'').toLowerCase() === uname)
      return { error: 'Username already taken' };
    // Only check email collision when both emails are non-empty
    var rowEmail = String(rows[i].email||'').toLowerCase().trim();
    var newEmail  = String(data.email||'').toLowerCase().trim();
    if (rowEmail && newEmail && rowEmail === newEmail)
      return { error: 'Username already taken (email conflict)' };
  }
  // Validate organization
  var orgName = String(data.organization||'').trim();
  var orgSheet = ss.getSheetByName('Organizations');
  var orgId = '';
  if (orgName && orgSheet) {
    var orgRows = sheetToArray(orgSheet);
    var found = null;
    for (var j = 0; j < orgRows.length; j++) {
      if (String(orgRows[j].name||'').toLowerCase() === orgName.toLowerCase()) {
        found = orgRows[j]; break;
      }
    }
    if (!found) return { error: 'Organization "'+orgName+'" not found. Check spelling or ask your Admin.' };
    orgId = found.id;
  }
  // First user becomes Admin; all others default to Viewer (role set by Admin later)
  var isFirst = rows.length === 0;
  var user = { id: 'u' + Date.now(), name: data.name || '',
    username: data.username || '', email: data.email || '',
    password: data.password || '',
    role: isFirst ? 'Admin' : 'Viewer',
    company: orgName, projects: '', orgId: orgId };
  // Ensure every column from the user record exists in the sheet
  // (handles old sheets created before username/orgId columns were added)
  Object.keys(user).forEach(function(col) { ensureColumn(s, col); });
  // Now append (headers are up to date)
  appendToSheet(s, user);
  return user;
}

// ── Orgs checker (for register autocomplete) ─────────────────────────────────
function checkOrgs(ss, name) {
  var s = ss.getSheetByName('Organizations'); if(!s) return [];
  var rows = sheetToArray(s);
  if(!name) return rows.map(function(r){return r.name;});
  var q = String(name).toLowerCase();
  return rows.filter(function(r){return String(r.name||'').toLowerCase().includes(q);}).map(function(r){return r.name;});
}

// ── Projects ───────────────────────────────────────────────────────────────────
function getProjects(ss, userId) {
  var us = ss.getSheetByName('Users'); if (!us) return [];
  var users = sheetToArray(us), user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === userId) { user = users[i]; break; }
  }
  if (!user) return [];
  var ps = ss.getSheetByName('Projects'); if (!ps) return [];
  var projs = sheetToArray(ps);
  if (user.role === 'Admin') return projs;
  var ok = (user.projects || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  return projs.filter(function(p) { return ok.indexOf(p.code) >= 0; });
}

// ── Data ───────────────────────────────────────────────────────────────────────
function getData(ss, sheetName, project) {
  var s = ss.getSheetByName(sheetName); if (!s) return [];
  var rows = sheetToArray(s);
  // Org-level sheets — no project filter
  var orgLevel = ['Users','Organizations','RolePermissions','CostCodeTemplates'];
  for(var x=0;x<orgLevel.length;x++){if(orgLevel[x]===sheetName)return rows;}
  if (!project) rows = rows;
  else rows = rows.filter(function(r) { return !r.project || r.project === project; });
  // Deduplicate by id — last save wins (guards against network-retry duplicates)
  var seen = {}, deduped = [], noId = [];
  rows.forEach(function(r) {
    if (r.id) seen[String(r.id)] = r;
    else noId.push(r);
  });
  Object.keys(seen).forEach(function(k) { deduped.push(seen[k]); });
  return deduped.concat(noId);
}

// ── Save (lazy sheet creation) ─────────────────────────────────────────────────
function saveRecord(ss, sheetName, record) {
  var s = getOrCreateSheet(ss, sheetName);
  var key = sheetName === 'Projects' ? 'code' : 'id';
  if (sheetName === 'IPC' && !record.id)
    record.id = 'IPC-' + record.project + '_' + (record.ipcNo||Date.now());
  if (sheetName === 'BOQMeasurements' && !record.id)
    record.id = 'MS-' + record.project + '_' + Date.now();
  if (sheetName === 'BOQ' && !record.id && record.project && record.item)
    record.id = record.project + '_' + record.item;
  return upsert(s, record, key);
}

function ensureColumn(sheet, colName) {
  // Add a missing column to an existing sheet (migration)
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (h.indexOf(colName) >= 0) return; // already exists
  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue(colName);
  sheet.getRange(1, newCol).setFontWeight('bold').setBackground('#1a1f2e').setFontColor('#f0a500');
}

function upsert(sheet, record, keyField) {
  // Ensure all columns from the record exist (migration-safe)
  Object.keys(record).forEach(function(col) { ensureColumn(sheet, col); });

  var data = sheet.getDataRange().getValues();
  var h = data[0], ki = h.indexOf(keyField);
  if (ki === -1) { appendToSheet(sheet, record); return { saved: true, inserted: true }; }
  var kv = String(record[keyField] || '');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][ki]) === kv) {
      // Re-read headers after possible migration
      var h2 = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row = h2.map(function(x, j) { return record[x] !== undefined ? record[x] : (data[i][j] !== undefined ? data[i][j] : ''); });
      sheet.getRange(i + 1, 1, 1, h2.length).setValues([row]);
      SpreadsheetApp.flush();
      return { saved: true, updated: true };
    }
  }
  appendToSheet(sheet, record);
  SpreadsheetApp.flush();
  return { saved: true, inserted: true };
}

function appendToSheet(sheet, record) {
  var h   = sheet.getDataRange().getValues()[0];
  var row = h.map(function(x) { return record[x] !== undefined ? record[x] : ''; });
  sheet.appendRow(row);
}

// ── Batch save multiple records (fast — single round-trip) ──────────────────────
function batchSaveRecords(ss, sheetName, records) {
  if(!records || !records.length) return {saved:0};
  var s = getOrCreateSheet(ss, sheetName);
  var saved = 0;
  for(var i=0; i<records.length; i++){
    upsert(s, records[i], sheetName==='Projects'?'code':'id');
    saved++;
  }
  return {saved:saved};
}

// ── Batch save multiple records in one call (fast) ──────────────────────────────

// ── Delete ─────────────────────────────────────────────────────────────────────
// uploadPhotoToDrive: not used — photos stay in-app only for privacy

function deleteRecord(ss, sheetName, id) {
  var s = ss.getSheetByName(sheetName);
  if (!s) return { error: 'Sheet not found: ' + sheetName };
  var d = s.getDataRange().getValues(), h = d[0];
  var ki = h.indexOf('id'); if (ki === -1) ki = h.indexOf('code');
  if (ki === -1) return { error: 'No key column in ' + sheetName };
  var deleted = 0;
  for (var i = d.length - 1; i >= 1; i--) {
    if (String(d[i][ki]) === String(id)) { s.deleteRow(i + 1); deleted++; }
  }
  if (deleted > 0) return { deleted: true, count: deleted };
  return { error: 'Not found: ' + id };
}

// ── BOQ ────────────────────────────────────────────────────────────────────────
function batchSaveBOQ(ss, project, records) {
  var s = getOrCreateSheet(ss, 'BOQ');
  var d = s.getDataRange().getValues(), h = d[0], pi = h.indexOf('project');
  for (var i = d.length - 1; i >= 1; i--)
    if (String(d[i][pi]) === String(project)) s.deleteRow(i + 1);
  if (!records || !records.length) return { saved: 0 };
  var h2 = ss.getSheetByName('BOQ').getDataRange().getValues()[0];
  var rows = records.map(function(r) {
    if (!r.id) r.id = r.project + '_' + r.item;
    return h2.map(function(x) { return r[x] !== undefined ? r[x] : ''; });
  });
  s.getRange(s.getLastRow() + 1, 1, rows.length, h2.length).setValues(rows);
  return { saved: rows.length };
}

function clearBOQ(ss, project) {
  var s = ss.getSheetByName('BOQ'); if (!s) return { cleared: true };
  var d = s.getDataRange().getValues(), h = d[0], pi = h.indexOf('project');
  for (var i = d.length - 1; i >= 1; i--)
    if (String(d[i][pi]) === String(project)) s.deleteRow(i + 1);
  return { cleared: true };
}

function deleteBOQItem(ss, project, item) {
  var s = ss.getSheetByName('BOQ'); if (!s) return { error: 'BOQ sheet not found' };
  var d = s.getDataRange().getValues(), h = d[0];
  var pi = h.indexOf('project'), ii = h.indexOf('item');
  for (var i = d.length - 1; i >= 1; i--)
    if (String(d[i][pi]) === String(project) && String(d[i][ii]) === String(item)) {
      s.deleteRow(i + 1); return { deleted: true };
    }
  return { error: 'BOQ item not found' };
}

// ── Core helper ────────────────────────────────────────────────────────────────
function sheetToArray(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var h = data[0];
  return data.slice(1)
    .filter(function(r) { return r[0] !== '' && r[0] !== null && r[0] !== undefined; })
    .map(function(r) {
      var obj = {};
      h.forEach(function(x, i) {
        var v = r[i];
        // Google Sheets auto-converts both dates AND times to Date objects
        if (v instanceof Date) {
          var yr = v.getFullYear();
          // Time values: GAS stores them as 1899-12-30 (the Lotus 1-2-3 epoch)
          // Detect: year is 1899 or full datetime where the date portion is irrelevant
          // Time-only cells have year=1899 in GAS
          if (yr === 1899 || yr === 1900) {
            // Format as HH:MM
            var hh = String(v.getHours()).padStart(2,'0');
            var mm = String(v.getMinutes()).padStart(2,'0');
            v = hh + ':' + mm;
          } else {
            // Regular date — format as YYYY-MM-DD
            var mo = String(v.getMonth()+1).padStart(2,'0');
            var dy = String(v.getDate()).padStart(2,'0');
            v = yr + '-' + mo + '-' + dy;
          }
        }
        obj[x] = (v !== undefined && v !== null) ? v : '';
      });
      return obj;
    });
}
`;

/* ═══════════════════════════════════════════════════
   SETUPUP
═══════════════════════════════════════════════════ */
const Setup = {
  init() {
    // Inject script code into textarea
    const ta = ge('script-code');
    if(ta) ta.value = GAS_SCRIPT;
    // Wire steps toggle
    const sb = ge('steps-btn');
    if(sb) sb.addEventListener('click', () => Setup.toggleSteps());
    // Wire copy button
    const cb = ge('btn-copy-script');
    if(cb) cb.addEventListener('click', () => Setup.copyScript());
    // === Supabase mode: skip the Google-Sheets setup screen; restore session or show login ===
    if(window.USE_SUPABASE){
      S.scriptUrl='supabase'; S.isDemo=false;
      Auth.mode('login'); Screen.show('auth');
      // Shared-device policy: NEVER auto-restore a session. Any token left in this browser
      // is cleared on load so the next person must sign in with their own credentials.
      (async function(){
        try{
          S.user = null;
          try{ sessionStorage.removeItem('civmetrix_session'); }catch(e){}
          if(window.SB && SB.signOut) await SB.signOut();
        }catch(e){ console.warn('sign-out on load:', e.message); }
      })();
      return;
    }
    // Auto-fill saved URL
    const stored = localStorage.getItem('civmetrix_url');
    const demo   = localStorage.getItem('civmetrix_demo');
    if(stored) { ge('setup-url').value = stored; this.onUrlInput(ge('setup-url')); }

    // Shared-device policy: no auto-restore — always require a fresh sign-in.
    if(S.user) { try{ sessionStorage.removeItem('civmetrix_session'); }catch(e){} S.user = null; }
    // No session — if URL saved, go to auth login (no need to reconnect)
    if(stored) {
      S.scriptUrl = stored; S.isDemo = false;
      this.proceed(stored, false);
      return;
    }
    if(demo === '1') {
      S.scriptUrl = ''; S.isDemo = true;
      this.proceed('', true);
      return;
    }
    // Nothing saved — show setup screen
    Screen.show('setup');
  },
  toggleSteps() {
    const p = ge('steps-panel'), b = ge('steps-btn');
    const open = p.classList.toggle('open');
    b.textContent = (open ? '▼ ' : '▶ ') + 'Show Apps Script setup steps & code';
  },
  copyScript() {
    const ta = ge('script-code');
    ta.select(); ta.setSelectionRange(0,99999);
    try { document.execCommand('copy'); toast('Script copied to clipboard!','ok'); }
    catch { navigator.clipboard?.writeText(GAS_SCRIPT).then(()=>toast('Copied!','ok')); }
  },
  onUrlInput(el) {
    const v = el.value.trim();
    const valid = v.startsWith('https://script.google.com/macros/s/') && v.endsWith('/exec');
    ge('btn-connect').disabled = !valid;
    el.classList.toggle('has-val', valid);
    const st = ge('setup-status');
    if(v.length > 10 && !valid) {
      st.textContent = '⚠ URL should start with https://script.google.com/macros/s/ and end with /exec';
      st.className = 'setup-status warn show';
    } else {
      st.className = 'setup-status';
    }
  },
  async connect() {
    const url = ge('setup-url').value.trim();
    if(!url) return;
    const st   = ge('setup-status');
    const btn  = ge('btn-connect');
    btn.disabled = true;
    btn.textContent = '⏳ Connecting…';
    st.textContent = '⏳ Reaching your Google Sheet…';
    st.className = 'setup-status warn show';
    S.scriptUrl = url; S.isDemo = false; // needed before GAS.call()
    localStorage.setItem('civmetrix_url', url);
    localStorage.removeItem('civmetrix_demo');
    try {
      // Step 1: fast ping with auto-retry (3 attempts built into GAS.call)
      st.innerHTML = '⏳ Connecting to your Google Sheet… <span style="font-size:10px;color:var(--text3)">(up to 90s on first connect)</span>';
      const ping = await GAS.get({action:'ping'});

      // Step 2: if first run, initialise sheets (this takes time — do it separately)
      if(ping.firstRun) {
        st.textContent = '⏳ First run detected — creating database sheets… (may take 15-20s)';
        try { await GAS.post({action:'initSheets'}); } catch(e) { /* sheets may already exist */ }
      }

      st.className = 'setup-status ok show';
      st.textContent = ping.firstRun
        ? '✅ Sheets created! Setting up your Admin account…'
        : '✅ Connected to your database!';
      setTimeout(() => this.proceed(url, false, ping.firstRun), 800);
    } catch(err) {
      st.className = 'setup-status err show';
      const isTimeout = err.message.includes('timed out') || err.message.includes('GAS is not responding');
      const isFailed  = err.message.includes('Script failed') || err.message.includes('load');
      // Build test URL so user can open it directly in a tab
      const testUrl = url + '?action=ping&callback=test';
      st.innerHTML =
        `<div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:10px">❌ ${isTimeout?'Connection timed out after 3 attempts':isFailed?'Script URL failed to load':err.message}</div>`
        + `<div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:10px 12px;margin-bottom:10px">`
        + `<div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:6px">🔍 Quick Diagnosis — open this URL in a new tab:</div>`
        + `<code style="font-size:10px;word-break:break-all;color:var(--text2)">${testUrl}</code><br>`
        + `<div style="font-size:11px;color:var(--text2);margin-top:6px">`
        + `If you see <b>test({"ok":true...})</b> → script is working, try connecting again.<br>`
        + `If you see a <b>Google login page</b> → set <em>Who has access: Anyone</em> and redeploy.<br>`
        + `If you see <b>Error 404</b> → URL is wrong, copy a fresh /exec URL from Manage Deployments.`
        + `</div>`
        + `<button onclick="window.open('${testUrl}','_blank')" class="btn ghost sm" style="margin-top:8px;font-size:11px">🔗 Open test URL in new tab</button>`
        + `</div>`
        + `<details><summary style="cursor:pointer;font-size:12px;color:var(--text2);margin-bottom:6px">Step-by-step fix</summary>`
        + `<div style="font-size:11px;color:var(--text2);line-height:2;margin-top:6px">`
        + `① In your Google Sheet → <b>Extensions → Apps Script</b><br>`
        + `② Paste the script (📋 Copy button above) and press <b>Ctrl+S</b> to save<br>`
        + `③ Click <b>Deploy → Manage Deployments</b><br>`
        + `④ Click the ✏ pencil on your deployment → <b>Version: New version</b> → <b>Deploy</b><br>`
        + `⑤ Confirm: <b>Execute as: Me</b> and <b>Who has access: Anyone</b><br>`
        + `⑥ The URL does not change — just click 🔗 Save & Sign In again<br>`
        + `</div></details>`;
      btn.disabled = false;
      btn.textContent = '🔗 Save & Sign In';
    }
  },
  useDemo() {
    localStorage.setItem('civmetrix_demo','1');
    localStorage.removeItem('civmetrix_url');
    this.proceed('', true);
  },
  proceed(url, isDemo, firstRun) {
    S.scriptUrl = url;
    S.isDemo    = isDemo;
    const lbl=ge('auth-db-label');
    if(lbl) lbl.textContent = isDemo ? 'Demo Mode · No backend connected' : 'Connected to Google Sheets database';
    const demo=ge('demo-banner');
    if(demo) demo.style.display = isDemo ? 'block' : 'none';
    // First run — prompt register; otherwise go to login
    if(firstRun && !isDemo) {
      const fb=ge('first-run-banner'); if(fb) fb.style.display='block';
      Auth.mode('register');
    } else {
      const fb=ge('first-run-banner'); if(fb) fb.style.display='none';
      Auth.mode('login');
    }
    Screen.show('auth');
  },
  goBack() { Screen.show('setup'); },
};

/* ═══════════════════════════════════════════════════
   GAS API LAYER — JSONP transport
   WHY JSONP and not fetch():
     Opening an HTML file directly (file://) causes browsers to treat the
     origin as "null". fetch() cross-origin from null origin is blocked by
     most browsers regardless of CORS headers. <script> tags are NEVER
     subject to CORS — they work from file://, http://, https:// equally.
   HOW IT WORKS:
     1. We create a random global callback name (e.g. __gas_a3f2)
     2. Append ?callback=__gas_a3f2 to the GAS URL
     3. Inject a <script> tag — browser loads the URL
     4. GAS returns: __gas_a3f2({"ok":true,...})
     5. JS engine executes that, calling our callback → promise resolves
   POST-like writes go via GET too — encoded as ?method=POST&payload=...
   GAS URL query string limit is ~8KB; typical records are <1KB.
═══════════════════════════════════════════════════ */
// ── Global safety net: prevent full app crash on uncaught errors ───────
window.addEventListener('error', function(ev){
  console.error('Global error:', ev.error||ev.message);
  // Don't crash on script-load errors from JSONP (handled by GAS retry)
  if(ev.filename && ev.filename.indexOf('script.google.com')>=0){ ev.preventDefault(); return; }
});
window.addEventListener('unhandledrejection', function(ev){
  console.warn('Unhandled promise:', ev.reason);
  ev.preventDefault(); // keep app alive — individual calls handle their own errors
});

const GAS = {
  _n: 0,

  // Single JSONP call
  _call(params, ms) {
    return new Promise((resolve, reject) => {
      const cb  = '__gas_' + (++this._n) + '_' + Math.random().toString(36).slice(2,6);
      const url = new URL(S.scriptUrl);
      Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v)));
      url.searchParams.set('callback', cb);
      const script = document.createElement('script');
      const timer  = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, ms||45000);
      function cleanup() {
        clearTimeout(timer); delete window[cb];
        if(script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = (data) => { cleanup(); if(data&&data.error) reject(new Error(data.error)); else resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('load_error')); };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  },

  // Auto-retry up to 3 times
  async call(params, ms) {
    const timeout = ms || 45000; // raised for slow Sheets
    let lastErr;
    for(let i = 1; i <= 3; i++) {
      try { return await this._call(params, timeout); }
      catch(e) {
        lastErr = e;
        const retryable = e.message === 'timeout' || e.message === 'load_error';
        if(!retryable || i === 3) break;
        await new Promise(r => setTimeout(r, 1500 * i));
      }
    }
    if(lastErr.message === 'timeout')    throw new Error('Request timed out — GAS is not responding');
    if(lastErr.message === 'load_error') throw new Error('Script failed to load — check the /exec URL');
    throw lastErr;
  },

  async get(params)  { if(window.USE_SUPABASE) return SB.route(params); return this.call(params); },
  async post(data)   { if(window.USE_SUPABASE) return SB.route(data); return this.call({ method:'POST', payload: JSON.stringify(data) }); },

  async postBig(data) {
    if(window.USE_SUPABASE) return SB.route(data);
    if(!S.scriptUrl || S.scriptUrl==='supabase') return null;
    try {
      await fetch(S.scriptUrl, { method:'POST', mode:'no-cors',
        headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(data) });
      return true;
    } catch(e){ console.warn('postBig failed, JSONP fallback:', e); return this.post(data).catch(()=>null); }
  },

  syncCollection(collection, rows) {
    if(!Array.isArray(rows)) return;
    const jsonFields = { manualCosts:['items'], ipc:['items'], budgets:['worksheet'], rateOverrides:['worksheet'], drawingTemplates:['items'], fuelRecons:['lineItems'] };
    const jf = jsonFields[collection] || [];
    DB[collection] = rows.map(r => {
      if(collection==='users' && typeof r.projects==='string')
        r.projects = r.projects ? r.projects.split(',').map(s=>s.trim()) : [];
      jf.forEach(f => { if(typeof r[f]==='string' && r[f]) { try{ r[f]=JSON.parse(r[f]); }catch(_){} } });
      return r;
    });
  }
}
/* ═══════════════════════════════════════════════════
   APP — navigation, project selector, org crumb
═══════════════════════════════════════════════════ */
const CivMetrix = {
  splash() {
    const el = document.getElementById('cm-splash');
    if(!el) return;
    el.classList.add('show');
    // Animate progress bar
    setTimeout(()=>{
      const bar = document.getElementById('cm-splash-progress');
      if(bar) bar.style.width = '100%';
    }, 50);
    // After animation: hide splash and re-render the app in-page
    setTimeout(()=>{
      el.classList.add('hide');
      setTimeout(()=>{
        el.classList.remove('show','hide');
        // Re-render without page reload — session stays intact
        if(S.user) {
          S._isRestore = true;
          Auth.onLogin(S.user);
          S._isRestore = false;
        } else {
          location.reload();
        }
      }, 400);
    }, 2800);
  },

  // Logo click → genuine refresh: shows the splash, then fully reloads the app
  // so all data is re-fetched from the backend (and the local cache re-applied).
  refresh() {
    const el = document.getElementById('cm-splash');
    if(el){
      el.classList.remove('hide');
      el.classList.add('show');
      const bar = document.getElementById('cm-splash-progress');
      if(bar){ bar.style.width = '0'; setTimeout(()=>{ bar.style.width = '100%'; }, 50); }
    }
    setTimeout(()=>{ location.reload(); }, 650);
  },
};

