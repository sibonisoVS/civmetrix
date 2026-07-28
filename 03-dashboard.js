/* CivMetrix — 03-dashboard.js
 * Dashboard
 *
 * Part 3 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */

const Dash = {
  render() {
    const body = ge('dash-body');
    if(!S.project) { body.innerHTML='<div class="empty"><div class="ico">📋</div><p>Select a project to view dashboard</p></div>'; return; }
    const proj = DB.getProject(S.project);
    if(!proj) return;
    const boq = DB.get('boq', S.project);
    const daily = DB.get('daily', S.project);
    const plant = DB.get('plant', S.project);
    const ncr = (DB.get('ncr', S.project)||[]).filter(n=>n.status==='Open');
    const inc = DB.get('incidents', S.project);
    const orgName = (S.org||DB.getOrg(S.user?.orgId))?.name||'';

    // ── Fix 3: Contract Value locked to project record ─────────────────────
    const contractValue = parseFloat(String(proj.value))||0;

    // ── Fix 4: Days Elapsed — always live against today ─────────────────────
    const start       = proj.startDate ? new Date(proj.startDate) : null;
    const today       = new Date(); today.setHours(0,0,0,0);
    const daysElapsed = start ? Math.max(0, Math.floor((today-start)/86400000)) : 0;
    const totalDays   = parseFloat(String(proj.duration))||365;

    // ── Fix 5: LTI Free Days — calculated from last LTI incident date ───────
    const ltiIncs     = inc.filter(i=>parseFloat(String(i.lostDays||0))>0);
    const lti         = ltiIncs.length;
    let ltiFree       = daysElapsed; // default: elapsed days if no LTI
    if(ltiIncs.length > 0) {
      // Find most recent LTI
      const sorted   = ltiIncs.slice().sort((a,b)=> a.date>b.date?-1:1);
      const lastLTI  = new Date(sorted[0].date); lastLTI.setHours(0,0,0,0);
      ltiFree        = Math.max(0, Math.floor((today-lastLTI)/86400000));
    }

    // ── Fix 6: Total Certified — only from prevQty (closed periods) ─────────
    // todayQty is uncommitted progress; prevQty = officially certified
    const certified   = boq.reduce((s,b)=>s+(parseFloat(String(b.prevQty))||0)*(parseFloat(String(b.rate))||0),0);
    const isPriv      = true; // All authenticated users with a project can view daily records

    const physPct = boq.length ? boq.reduce((s,b)=>s+(parseFloat(String(b.pct))||0),0)/boq.length : 0;
    const labourToday = daily.filter(d=>d.date===todayISO()).reduce((s,d)=>s+(parseFloat(String(d.total))||0),0)||0;

    // Fix 6: Close Period button visibility (Approver/Editor/Admin only in Progress tab)
    const certPct = contractValue>0?(certified/contractValue*100):0;
    const daysPct = totalDays>0?(daysElapsed/totalDays*100):0;
    const daysStatus = daysPct>physPct+5?'warn':'up';

    body.innerHTML = `
      <div class="kpi-row">
        ${this.kpi('Physical Complete', fmtPct(physPct), 'c-amber',
          `<div class="pbar"><div class="pfill amber" style="width:${clamp(physPct,0,100)}%"></div></div>`,
          physPct>=100?'✅ Complete':'In Progress', physPct>=100?'up':'warn')}
        ${this.kpi('Contract Value', fmtR(contractValue), 'c-green',
          proj.contractNo||'—',
          '🔒 Locked to project record', 'up')}
        ${this.kpi('Days Elapsed', `${daysElapsed}`, 'c-blue',
          `of ${totalDays} calendar days`,
          daysStatus==='warn'?`⚠ ${daysPct.toFixed(0)}% time elapsed`:'✅ On programme', daysStatus)}
        ${this.kpi('LTI Free Days', ltiFree, lti>0?'c-red':'c-green',
          lti>0?`🔴 ${lti} LTI Incident${lti>1?'s':''} recorded`:'Zero LTIs recorded',
          lti>0?'🔴 Last LTI: '+ltiIncs.slice().sort((a,b)=>a.date>b.date?-1:1)[0]?.date:'✅ Keep it up', lti>0?'dn':'up')}
        ${this.kpi('Open NCRs', ncr.length, ncr.length>0?'c-red':'c-green',
          'Non-Conformances',
          ncr.length>0?'⚠ Action needed':'✅ All clear', ncr.length>0?'warn':'up')}
        ${this.kpi('Total Certified', fmtR(certified), 'c-orange',
          certPct.toFixed(1)+'% of contract value',
          isPriv?'Updates when period is closed':'Requires Approver to close period',
          certPct>0?'up':'warn')}
      </div>
      <div class="dash-grid">
        <div class="chart-box">
          <div class="chart-hd">
            <span class="chart-title">📈 S-Curve Progress</span>
            <span class="badge warn" id="scurve-badge">Loading…</span>
          </div>
          <canvas id="scurve-canvas" style="max-height:220px"></canvas>
        </div>
        <div class="chart-box">
          <div class="chart-hd"><span class="chart-title">📋 BOQ Progress</span></div>
          <div class="boq-bars" id="boq-bars-dash"></div>
        </div>
      </div>
      <div class="dash-grid-3">
        <div class="chart-box">
          <div class="chart-hd">
            <span class="chart-title"><span class="material-icons-outlined" aria-hidden="true">group</span> Labour Today</span>
            <span class="badge blue">${labourToday} Workers</span>
          </div>
          ${this.labourToday(daily)}
        </div>
        <div class="chart-box">
          <div class="chart-hd"><span class="chart-title">🚜 Plant Status</span></div>
          ${this.plantStatus(plant)}
        </div>
        <div class="chart-box">
          <div class="chart-hd">
            <span class="chart-title">🚨 Active Alerts</span>
            <span class="badge red" id="alerts-badge">—</span>
          </div>
          <div class="alert-list" id="alerts-list"></div>
        </div>
      </div>
    `;

    this.renderSCurve();
    this.renderBOQ(boq);
    this.renderAlerts({ ncr, plant, boq, inc, physPct, daysPct });
    if(typeof Prod!=='undefined' && Prod._notifyFuelApprovers) Prod._notifyFuelApprovers();
  },
  kpi(label, val, color, meta, trend, trendCls) {
    return `<div class="kpi ${color}">
      <div class="kpi-lbl">${label}</div>
      <div class="kpi-val">${val}</div>
      <div class="kpi-meta">${meta}</div>
      <div class="kpi-trend ${trendCls}">${trend}</div>
    </div>`;
  },
  _chip(val, lbl, col) {
    return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 11px;text-align:center;min-width:58px">
      <div style="font-size:15px;font-weight:800;color:${col||'#e8eaf0'};line-height:1.1">${val}</div>
      <div style="font-size:9px;letter-spacing:.4px;text-transform:uppercase;color:#8b96aa;margin-top:2px">${lbl}</div></div>`;
  },
  labourToday(daily) {
    const num = v => parseFloat(String(v))||0;
    const today = (daily||[]).filter(d=>d.date===todayISO());
    if(!today.length) {
      const last = (daily||[]).slice().sort((a,b)=>a.date<b.date?1:-1)[0];
      return `<div style="text-align:center;color:var(--text3);padding:16px;font-size:12px">No labour recorded today${last?` · last entry ${fmtD(last.date)} (${num(last.total)} workers)`:''}</div>`;
    }
    const sum = f => today.reduce((s,d)=>s+num(d[f]),0);
    const workers=sum('total'), sk=sum('skilled'), semi=sum('semiSkilled'), gen=sum('general'), sub=sum('subContract');
    const cost=sum('labourCost'), ot=sum('otHours');
    const teams=new Set(today.map(d=>d.foreman).filter(Boolean)).size;
    const strip = `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">
      ${this._chip(workers,'on site','#3b82f6')}
      ${this._chip(sk,'skilled')}${this._chip(semi,'semi')}${this._chip(gen,'general')}
      ${sub>0?this._chip(sub,'subcontr.'):''}
      ${ot>0?this._chip(ot+'h','overtime','#f0a500'):''}
      ${cost>0?this._chip(fmtR(cost),'labour cost','#22c9c9'):''}
      ${this._chip(teams,'teams')}</div>`;
    const rows = today.map(d=>`<tr><td>${d.section||'—'}</td><td>${d.foreman||'—'}</td><td class="bold">${num(d.total)}</td><td>${num(d.hrsWorked)}h</td><td style="color:${num(d.otHours)>0?'var(--amber)':'var(--text3)'}">${num(d.otHours)>0?'+'+num(d.otHours)+'h':'—'}</td></tr>`).join('');
    return strip + `<table class="mini-table"><thead><tr><th>Section</th><th>Foreman</th><th>Workers</th><th>Hrs</th><th>OT</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  plantStatus(plant) {
    const num = v => parseFloat(String(v))||0;
    const today = (plant||[]).filter(p=>p.date===todayISO());
    const src = today.length ? today : (plant||[]).slice(0,6);
    if(!src.length) return `<div style="text-align:center;color:var(--text3);padding:16px;font-size:12px">No plant recorded</div>`;
    const isBD = s => /break/i.test(s||''), isWork = s => /work|oper/i.test(s||''), isIdle = s => /idle|stand/i.test(s||'');
    const working=src.filter(p=>isWork(p.status)).length, bd=src.filter(p=>isBD(p.status)).length, idle=src.filter(p=>isIdle(p.status)).length;
    const hrs=src.reduce((s,p)=>s+num(p.hrsWorked),0), idleH=src.reduce((s,p)=>s+num(p.idleHrs),0);
    const util = (hrs+idleH)>0 ? Math.round(hrs/(hrs+idleH)*100) : 0;
    const strip = `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px">
      ${this._chip(src.length,'units','#3b82f6')}
      ${this._chip(working,'working','#22c55e')}
      ${idle>0?this._chip(idle,'idle','#f0a500'):''}
      ${bd>0?this._chip(bd,'breakdown','#ef4444'):''}
      ${this._chip(hrs.toFixed(0)+'h','worked')}
      ${this._chip(util+'%','utilisation', util>=70?'#22c55e':util>=40?'#f0a500':'#ef4444')}</div>`;
    const rows = src.slice(0,6).map(p=>`<tr><td>${p.type||'—'}</td><td class="mono">${p.regId||'—'}</td><td>${num(p.hrsWorked)}h</td><td style="color:${num(p.idleHrs)>0?'var(--amber)':'var(--text3)'}">${num(p.idleHrs)>0?num(p.idleHrs)+'h':'—'}</td><td>${pill(p.status)}</td></tr>`).join('');
    return strip + `<table class="mini-table"><thead><tr><th>Equipment</th><th>ID</th><th>Hrs</th><th>Idle</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  _scurveModel(proj){
    proj = proj || S.project;
    const daily=DB.get('daily',proj)||[], ipc=DB.get('ipc',proj)||[], boq=DB.get('boq',proj)||[];
    const grn=DB.get('grn',proj)||[], fuel=DB.get('fuelIssues',proj)||[], manual=DB.get('manualCosts',proj)||[];
    const num=v=>parseFloat(String(v))||0;
    const D=x=>{ const d=new Date(x); return isNaN(d)?null:d; };
    const pad=n=>String(n).padStart(2,'0');
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const allD=[].concat(daily.map(d=>d.date),ipc.map(x=>x.date),grn.map(g=>g.date),fuel.map(f=>f.date),manual.map(m=>m.date)).map(D).filter(Boolean);
    if(!allD.length) return {empty:true};
    let minD=allD[0],maxD=allD[0]; allD.forEach(d=>{ if(d<minD)minD=d; if(d>maxD)maxD=d; });
    const days=(maxD-minD)/86400000;
    // adaptive buckets: short projects show finer detail; > ~3 months stays monthly
    const mode = days<=16?'day' : days<=45?'week' : days<=92?'biweek' : 'month';
    const weekStart=d=>{ const x=new Date(d); const w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); x.setHours(0,0,0,0); return x; };
    const anchor=weekStart(minD);
    const keyOf=dstr=>{ const d=D(dstr); if(!d) return null;
      if(mode==='month') return d.getFullYear()+'-'+pad(d.getMonth()+1);
      if(mode==='day')   return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      const s=weekStart(d);
      if(mode==='week')  return s.getFullYear()+'-'+pad(s.getMonth()+1)+'-'+pad(s.getDate());
      const per=Math.floor((s-anchor)/(14*864e5)); const bs=new Date(anchor.getTime()+per*14*864e5);
      return bs.getFullYear()+'-'+pad(bs.getMonth()+1)+'-'+pad(bs.getDate());
    };
    const labelOf=key=>{ const p=key.split('-'); return mode==='month' ? (MN[(+p[1])-1]+" '"+p[0].slice(2)) : ((+p[2])+' '+MN[(+p[1])-1]); };
    const spendBy={},valueBy={},costBy={},budgetBy={}; let haveIpc=false;
    daily.forEach(d=>{ const k=keyOf(d.date); if(k) spendBy[k]=(spendBy[k]||0)+num(d.labourCost); });
    ipc.forEach(x=>{ const k=keyOf(x.date); if(k){ const v=num(x.totalValue); valueBy[k]=(valueBy[k]||0)+v; if(v)haveIpc=true; } });
    // Costing line = ALL cost items (materials, plant, labour, fuel, manual, adjustments)
    const _cd=(typeof Prod!=='undefined' && Prod._costingData)?Prod._costingData(proj):{items:[]};
    (_cd.items||[]).forEach(it=>{ const k=keyOf(it.date); if(k) costBy[k]=(costBy[k]||0)+num(it.amount); });
    // Budget line = projected budget by month
    const _bud=(typeof Prod!=='undefined' && Prod._budgetRows)?Prod._budgetRows(proj):[];
    let haveBudget=false;
    _bud.forEach(b=>{ const k=keyOf(String(b.month||'').slice(0,7)+'-01'); if(k){ budgetBy[k]=(budgetBy[k]||0)+num(b.amount); haveBudget=true; } });
    const boqCert=boq.reduce((s,b)=>s+num(b.prevQty)*num(b.rate),0);
    const keys=Object.keys(Object.assign({},spendBy,valueBy,costBy,budgetBy)).filter(Boolean).sort();
    if(!keys.length) return {empty:true};
    let cs=0,cv=0,cc=0,cb=0; const spend=[],value=[],cost=[],budget=[];
    keys.forEach(k=>{ cs+=spendBy[k]||0; spend.push(Math.round(cs)); cv+=valueBy[k]||0; value.push(haveIpc?Math.round(cv):null); cc+=costBy[k]||0; cost.push(Math.round(cc)); cb+=budgetBy[k]||0; budget.push(haveBudget?Math.round(cb):null); });
    if(!haveIpc && boqCert>0) value[value.length-1]=Math.round(boqCert);
    const modeLabel = {day:'Daily',week:'Weekly',biweek:'2-Weekly',month:'Monthly'}[mode];
    return {empty:false, mode, modeLabel, labels:keys.map(labelOf), spend, value, cost, budget, haveIpc, haveBudget, certToDate: haveIpc?cv:boqCert};
  },

  renderSCurve() {
    if(S.chart) { S.chart.destroy(); S.chart=null; }
    const ctx = ge('scurve-canvas'); if(!ctx) return;
    const badge = ge('scurve-badge');
    const m = this._scurveModel(S.project);
    if(m.empty) {
      if(badge){ badge.textContent='No actuals yet'; badge.className='badge warn'; }
      const c=ctx.getContext('2d'); c.clearRect(0,0,ctx.width,ctx.height);
      c.fillStyle='#4d596e'; c.font='12px sans-serif'; c.textAlign='center';
      c.fillText('Capture Daily Records or an IPC to build the S-Curve', ctx.width/2||150, 90);
      return;
    }
    const shortR = v => v==null?'' : (Math.abs(v)>=1e6 ? 'R '+(v/1e6).toFixed(1)+'M' : Math.abs(v)>=1e3 ? 'R '+(v/1e3).toFixed(0)+'k' : 'R '+v);
    if(badge){ badge.textContent = (m.haveIpc?'Certified ':'BOQ ') + fmtR(m.certToDate) + ' · ' + m.modeLabel; badge.className='badge green'; }
    S.chart = new Chart(ctx.getContext('2d'), {
      type:'line',
      data:{ labels:m.labels, datasets:[
        {label:'Certified value (actual)', data:m.value, borderColor:'#f0a500', backgroundColor:'rgba(240,165,0,.08)', borderWidth:2.6, fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#f0a500', spanGaps:true},
        {label:'Total cost (all, actual)', data:m.cost, borderColor:'#a855f7', backgroundColor:'rgba(168,85,247,.06)', borderWidth:2.2, fill:false, tension:.4, pointRadius:2.5, pointBackgroundColor:'#a855f7'},
        {label:'Budget (projected)', data:m.budget, borderColor:'#3b82f6', borderDash:[5,4], borderWidth:2, fill:false, tension:.4, pointRadius:2, pointBackgroundColor:'#3b82f6', spanGaps:true}
      ]},
      options:{responsive:true,maintainAspectRatio:true,interaction:{mode:'index',intersect:false},
        plugins:{legend:{labels:{color:'#8b96aa',font:{size:11}},position:'bottom'},
          tooltip:{backgroundColor:'#1a1f2e',borderColor:'#252d3f',borderWidth:1,titleColor:'#e8eaf0',bodyColor:'#8b96aa',
            callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y!=null?fmtR(c.parsed.y):'—'}`}}},
        scales:{
          x:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#4d596e',maxRotation:45,font:{size:9}}},
          y:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#4d596e',callback:v=>shortR(v),font:{size:10}},min:0}
        }}
    });
  },
  renderBOQ(boq) {
    const el = ge('boq-bars-dash');
    if(!el) return;
    el.innerHTML = boq.map(b=>`
      <div class="boq-item">
        <div class="boq-name" title="${b.description}">${b.item} ${b.description}</div>
        <div class="boq-bg"><div class="boq-fill ${pctColor(b.pct)}" style="width:${b.pct}%"></div></div>
        <div class="boq-pct" style="color:var(--${pctColor(b.pct)})">${b.pct}%</div>
      </div>`).join('');
  },
  renderAlerts({ncr,plant,boq,inc,physPct,daysPct}) {
    const alerts=[];
    const today=new Date(); today.setHours(0,0,0,0);
    if(typeof Prod!=='undefined' && Prod._canApproveFuel && Prod._canApproveFuel()){
      const nf=(DB.fuelRequests||[]).filter(r=>(r.status||'Pending')==='Pending').length;
      if(nf>0) alerts.push({t:'critical',i:'🛎',m:`${nf} fuel request${nf===1?'':'s'} awaiting your approval`,d:'Action'});
    }
    (plant||[]).filter(p=>/break/i.test(p.status||'')).slice(0,4).forEach(p=>alerts.push({t:'critical',i:'🔴',m:`${p.type||'Plant'} (${p.regId||''}) — Breakdown`,d:p.date?fmtD(p.date):'Today'}));
    (inc||[]).filter(x=>x.due && String(x.status||'')!=='Closed' && new Date(x.due)<today).slice(0,4).forEach(x=>alerts.push({t:'critical',i:'⚠️',m:`Overdue corrective action — ${(x.type||'Incident')}`,d:'Due '+fmtD(x.due)}));
    if(typeof daysPct==='number' && typeof physPct==='number' && daysPct>physPct+8)
      alerts.push({t:'warning',i:'⏳',m:`Programme risk — ${daysPct.toFixed(0)}% time elapsed vs ${physPct.toFixed(0)}% complete`,d:'Now'});
    (ncr||[]).slice(0,4).forEach(n=>alerts.push({t:'warning',i:'📌',m:`NCR ${n.id||''}: ${String(n.description||'').slice(0,52)}`,d:(n.date||n.dateRaised)?fmtD(n.date||n.dateRaised):''}));
    (boq||[]).filter(b=>(parseFloat(String(b.pct))||0)<20 && (parseFloat(String(b.contractQty))||0)>50).slice(0,3).forEach(b=>alerts.push({t:'info',i:'📋',m:`BOQ ${b.item} — ${b.description} at ${b.pct}%`,d:'Low'}));
    if(!alerts.length) alerts.push({t:'info',i:'✅',m:'No active alerts — all systems operational',d:'Now'});
    const order={critical:0,warning:1,info:2};
    alerts.sort((a,b)=>(order[a.t]-order[b.t]));
    const badge=ge('alerts-badge');
    if(badge) { const n=alerts.filter(a=>a.t!=='info').length; badge.textContent=n+' Alert'+(n===1?'':'s'); badge.className='badge '+(n>0?'red':'green'); }
    const list=ge('alerts-list');
    if(list) list.innerHTML=alerts.map(a=>`<div class="alert-row ${a.t}"><span class="alert-ico">${a.i}</span><span class="alert-txt">${a.m}</span><span class="alert-time">${a.d}</span></div>`).join('');
  }
};

/* ═══════════════════════════════════════════════════
   PRODUCTION
═══════════════════════════════════════════════════ */
