/* CivMetrix — 06-payroll.js
 * Payroll, fuel & purchase pages, daily progress reports
 *
 * Part 6 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */

const Payroll = {

  // ── Settings ────────────────────────────────────────────────────────
  getSettings() {
    const stored=(DB.payrollSettings||[]).find(s=>s.project===S.project)||{};
    const projSched=(()=>{try{return JSON.parse(DB.getProject(S.project)?.schedule||'{}');}catch{return {};}})();
    const projHols=(projSched.holidays||[]);
    const defHolPay={};
    projHols.forEach(h=>{ defHolPay[h]=stored.holidayPayable?.[h]??true; });
    const shifts=stored.holidayShifts||{};
    // Build effective holiday list: original → shifted date if shifted
    const effectiveHols=projHols.map(h=>shifts[h]?shifts[h]:h);
    return {
      wknorm:    parseFloat(String(stored.wknorm   ??1.0)),
      wkot:      parseFloat(String(stored.wkot     ??1.5)),
      sat12am:   parseFloat(String(stored.sat12am  ??1.0)),
      sat12pm:   parseFloat(String(stored.sat12pm  ??2.0)),
      sun:       parseFloat(String(stored.sun      ??2.0)),
      holWork:   parseFloat(String(stored.holWork  ??2.0)),
      holRest:   parseFloat(String(stored.holRest  ??1.0)),
      stdDayHrs: parseFloat(String(stored.stdDayHrs??10)),
      snpfPct:   parseFloat(String(stored.snpfPct  ??5.0)),
      payePct:   parseFloat(String(stored.payePct  ??0)),
      gradedTax: stored.gradedTax||{Foreman:50,Operator:40,Skilled:30,'Semi-Skilled':20,General:10},
      holidayPayable: defHolPay,
      holidayShifts:  shifts,
      projHols, effectiveHols,
    };
  },

  saveSettings(vals) {
    if(!DB.payrollSettings) DB.payrollSettings=[];
    const idx=DB.payrollSettings.findIndex(s=>s.project===S.project);
    const rec={id:'PS-'+S.project,project:S.project,...vals,orgId:_orgId()};
    if(idx>=0) DB.payrollSettings[idx]=rec; else DB.payrollSettings.push(rec);
    if(!S.isDemo&&S.scriptUrl)
      GAS.post({action:'save',sheet:'PayrollSettings',record:rec}).catch(()=>{});
    toast('HR settings saved ✅','ok');
  },

  wInfo(workerId) {
    const workers=DB.get('workers',S.project);
    const regular=workers.find(w=>w.id===workerId);
    if(regular) return regular;
    if(String(workerId).endsWith('_foreman')) {
      const teamId=String(workerId).replace('_foreman','');
      const team=(DB.foremenTeams||[]).find(t=>t.id===teamId&&t.project===S.project);
      if(team) return {id:workerId,name:team.foremanName||'?',trade:'Foreman',
        skillLevel:'Foreman',hourlyRate:team.foremanHourlyRate||0,
        payMethod:team.payMethod||'Cash',bankName:team.bankName||'',
        accountNumber:team.accountNumber||''};
    }
    return {};
  },

  // ── All payroll periods (DB + queue merged, deduped) ─────────────────
  getAllPeriods() {
    const fromDB=(DB.payrollPeriods||[]).filter(p=>p.project===S.project);
    const fromQ =(DB.payrollQueue  ||[]).filter(p=>p.project===S.project);
    // Merge: DB records take precedence, queue fills gaps
    const ids=new Set(fromDB.map(p=>p.id||p.periodId));
    const all=[...fromDB];
    fromQ.forEach(q=>{
      const id=q.id||q.periodId;
      if(!ids.has(id)) all.push(q);
    });
    return all.sort((a,b)=>(b.openDate||'')>(a.openDate||'')?1:-1);
  },

  // ── MAIN RENDER ──────────────────────────────────────────────────────
  render() {
    const el=ge('payroll-body'); if(!el) return;
    const rs=this.getSettings();
    const all=this.getAllPeriods();
    const proj=DB.getProject(S.project)||{};
    const contractNo=proj.contractNo||proj.code||S.project;

    const pending=all.filter(p=>p.status==='pending');
    const processed=all.filter(p=>p.status==='processed'||p.status==='approved');
    const paid=all.filter(p=>p.status==='paid');

    const isProcessed=p=>(p.status==='processed'||p.status==='approved'||p.status==='paid');
    const periodCard=(p)=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div>
            <div style="font-size:16px;font-weight:900;font-family:var(--fh);color:var(--amber);letter-spacing:.5px">${p.contractNo||contractNo}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">${p.periodRef||p.id||''} · ${fmtD(p.openDate)} → ${fmtD(p.closeDate)}</div>
            <div style="font-size:11px;color:var(--text3)">Submitted by ${p.submittedBy||'—'} · ${p.submittedAt?new Date(p.submittedAt).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'}):''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span style="font-size:11px;padding:3px 10px;border-radius:4px;font-weight:600;
              background:${p.status==='paid'?'rgba(34,197,94,.12)':isProcessed(p)?'rgba(59,130,246,.12)':'rgba(240,165,0,.12)'};
              color:${p.status==='paid'?'var(--green)':isProcessed(p)?'var(--blue)':'var(--amber)'}">
              ${p.status==='paid'?'✅ Paid':isProcessed(p)?'✔ Processed':'⏳ Pending'}
            </span>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              ${isProcessed(p)
                ? `<button class="btn ghost sm" onclick="Payroll.processPeriod('${p.id||p.periodId}')"><span class="material-icons-outlined" aria-hidden="true">visibility</span> View</button>
                   <button class="btn amber sm" onclick="Payroll.printPaySlips('${p.id||p.periodId}')">🖨 Pay Slips</button>
                   <button class="btn ghost sm" onclick="Payroll._sendToAcc('${p.id||p.periodId}')">📤 Send to Accounting</button>`
                : `<button class="btn amber sm" onclick="Payroll.processPeriod('${p.id||p.periodId}')">📋 Process</button>`}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:5px">
          <div class="stat-mini"><div class="stat-v">${p.workers||0}</div><div class="stat-l">Workers</div></div>
          <div class="stat-mini"><div class="stat-v">${p.entries||0}</div><div class="stat-l">Entries</div></div>
          <div class="stat-mini"><div class="stat-v" style="color:var(--green)">${(p.totalReg||0).toFixed(1)}</div><div class="stat-l">Reg Hrs</div></div>
          <div class="stat-mini"><div class="stat-v" style="color:var(--orange)">${(p.totalOT||0).toFixed(1)}</div><div class="stat-l">OT Hrs</div></div>
          <div class="stat-mini"><div class="stat-v" style="color:var(--green)">E ${(p.totalGross||0).toFixed(2)}</div><div class="stat-l">Gross</div></div>
          <div class="stat-mini"><div class="stat-v" style="color:var(--amber)">E ${(p.totalNet||0).toFixed(2)}</div><div class="stat-l">Net Pay</div></div>
        </div>
      </div>`;

    el.innerHTML = `
      <!-- ── HR Settings (collapsible) ──────────────────────────── -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer"
          onclick="(function(h){const b=h.nextElementSibling;const o=b.style.display!=='none';b.style.display=o?'none':'block';h.querySelector('.rs-chev').textContent=o?'▶':'▼';})(this)">
          <span style="font-size:13px;font-weight:700">⚙ HR Rate & Deduction Settings <span class="rs-chev">▶</span></span>
          <span style="font-size:11px;color:var(--text3)">Tap to expand</span>
        </div>
        <div id="rs-body" style="display:none;padding:0 14px 14px">
          <!-- Rate multipliers -->
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin:8px 0">Pay Rate Multipliers</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:7px;margin-bottom:12px">
            ${[
              {key:'wknorm',  label:'WKNORM',          desc:'Weekday regular'},
              {key:'wkot',    label:'WKOT',            desc:'Weekday overtime'},
              {key:'sat12am', label:'SAT before noon', desc:'Saturday morning'},
              {key:'sat12pm', label:'SAT after noon',  desc:'Saturday afternoon'},
              {key:'sun',     label:'SUN',             desc:'Sunday all hours'},
              {key:'holWork', label:'HOLIDAY worked',  desc:'On-site holiday hrs'},
              {key:'holRest', label:'HOLIDAY rest',    desc:'Holiday unworked hrs (payable)'},
            ].map(f=>`
              <div style="background:rgba(240,165,0,.04);border:1px solid var(--border);border-radius:6px;padding:7px 9px">
                <div style="font-size:11px;font-weight:700;color:var(--amber)">${f.label}</div>
                <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${f.desc}</div>
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="font-size:10px;color:var(--text2)">Rate ×</span>
                  <input type="number" class="finput rs-val" data-key="${f.key}" value="${rs[f.key]}" min="0" step="0.25"
                    style="width:60px;font-size:14px;font-weight:700;text-align:center;padding:2px 4px">
                </div>
              </div>`).join('')}
            <div style="background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:7px 9px">
              <div style="font-size:11px;font-weight:700;color:var(--blue)">Std Day Hours</div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Holiday rest basis</div>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" class="finput rs-val" data-key="stdDayHrs" value="${rs.stdDayHrs}" min="1" max="24" step="0.5"
                  style="width:60px;font-size:14px;font-weight:700;text-align:center;padding:2px 4px">
                <span style="font-size:10px;color:var(--text2)">hrs</span>
              </div>
            </div>
          </div>

          <!-- Deductions -->
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--blue);margin:8px 0">Deductions</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:7px;margin-bottom:12px">
            <div style="background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:7px 9px">
              <div style="font-size:11px;font-weight:700;color:var(--blue)">SNPF Employee %</div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Auto: Gross × %</div>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" class="finput rs-val" data-key="snpfPct" value="${rs.snpfPct}" min="0" max="100" step="0.5"
                  style="width:60px;font-size:14px;font-weight:700;text-align:center;padding:2px 4px">
                <span style="font-size:10px;color:var(--text2)">%</span>
              </div>
            </div>
            <div style="background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:7px 9px">
              <div style="font-size:11px;font-weight:700;color:var(--blue)">PAYE %</div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:4px">0 = manual per worker</div>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" class="finput rs-val" data-key="payePct" value="${rs.payePct}" min="0" max="100" step="0.5"
                  style="width:60px;font-size:14px;font-weight:700;text-align:center;padding:2px 4px">
                <span style="font-size:10px;color:var(--text2)">%</span>
              </div>
            </div>
          </div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin:6px 0">Graded Tax — Fixed E per skill</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px;margin-bottom:12px">
            ${['Foreman','Operator','Skilled','Semi-Skilled','General','Other'].map(sk=>`
              <div style="display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:5px 8px">
                <span style="font-size:11px;flex:1">${sk}</span>
                <span style="font-size:11px;color:var(--text2)">E</span>
                <input type="number" class="finput rs-gt" data-sk="${sk}" value="${rs.gradedTax?.[sk]??0}" min="0" step="1"
                  style="width:55px;font-size:13px;font-weight:700;text-align:right;padding:2px 4px">
              </div>`).join('')}
          </div>

          <!-- Holidays -->
          ${rs.projHols.length?`
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--red);margin:8px 0">
            Project Holidays — Payability & Shifting
          </div>
          <div style="background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.15);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--text2);margin-bottom:8px">
            ℹ If a holiday falls on a non-working day (e.g. Sunday) it can be shifted to the next working day.
            When shifted, the system will treat the <em>new date</em> as the holiday for pay purposes.
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:6px;margin-bottom:12px">
            ${rs.projHols.map(hd=>{
              const shifted=rs.holidayShifts[hd]||'';
              const d=new Date(hd+'T00:00:00');
              const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const dayName=DOW[d.getDay()];
              const projSched=(()=>{try{return JSON.parse(DB.getProject(S.project)?.schedule||'{}');}catch{return {};}})();
              const workDays=projSched.workDays||['Mon','Tue','Wed','Thu','Fri'];
              const onNonWork=!workDays.some(wd=>wd.slice(0,3)===dayName);
              return `<div style="background:var(--surface);border:1px solid ${onNonWork?'rgba(239,68,68,.2)':'var(--border)'};border-radius:6px;padding:8px 12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                  <div>
                    <span style="font-size:12px;font-weight:700">${fmtD(hd)}</span>
                    <span style="font-size:10px;color:${onNonWork?'var(--red)':'var(--text3)'};margin-left:6px">${dayName}${onNonWork?' — non-working day ⚠':''}${shifted?' → shifted to '+fmtD(shifted):''}</span>
                  </div>
                  <label style="display:flex;align-items:center;gap:5px;cursor:pointer;margin-left:auto">
                    <input type="checkbox" class="rs-hol" data-hdate="${hd}" ${rs.holidayPayable[hd]!==false?'checked':''}
                      style="accent-color:var(--amber);width:14px;height:14px">
                    <span style="font-size:11px">${rs.holidayPayable[hd]!==false?'✅ Payable':'❌ Not payable'}</span>
                  </label>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:10px;color:var(--text3)">Shift to:</span>
                  <input type="date" class="finput rs-shift" data-hdate="${hd}" value="${shifted}"
                    style="font-size:11px;padding:3px 6px;flex:1"
                    placeholder="leave blank = no shift">
                  ${shifted?`<button class="btn danger sm" style="font-size:10px;padding:2px 8px"
                    onclick="this.previousElementSibling.value='';this.previousElementSibling.dispatchEvent(new Event('change'))">✕ Clear</button>`:''}
                </div>
              </div>`;
            }).join('')}
          </div>`:
          '<p style="font-size:11px;color:var(--text3);margin-bottom:12px">No project holidays configured. Add them in Project Settings → Schedule → Public Holidays.</p>'}

          <button class="btn amber sm" id="btn-save-rs">💾 Save HR Settings</button>
        </div>
      </div>

      <!-- ── Period cards grouped by status ──────────────────────── -->
      ${!all.length?`
        <div class="empty" style="padding:32px 0">
          <div class="ico">💰</div>
          <p>No payroll periods yet.</p>
          <p style="font-size:12px;color:var(--text3);margin-top:4px">Close a Timesheet Period from ⏱ <b>Timesheet Records</b> to submit a period here.</p>
        </div>`:

        `${(()=>{
          // Group pending by contractNo, processed separate on right
          const byContract={};
          pending.forEach(p=>{const k=p.contractNo||contractNo;if(!byContract[k])byContract[k]=[];byContract[k].push(p);});
          const contractGroups=Object.entries(byContract);
          return contractGroups.length?`
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin-bottom:10px">⏳ Pending — Awaiting Processing</div>
            ${contractGroups.map(([cn,periods])=>`
              <div style="margin-bottom:14px">
                <div style="font-size:12px;font-weight:700;color:var(--amber);padding:5px 10px;background:rgba(240,165,0,.06);border-radius:4px;margin-bottom:6px;border-left:3px solid var(--amber)">${cn}</div>
                ${periods.map(p=>periodCard(p)).join('')}
              </div>`).join('')}`:'';
        })()}
        ${(()=>{
          const byContract={};
          [...processed,...paid].forEach(p=>{const k=p.contractNo||contractNo;if(!byContract[k])byContract[k]=[];byContract[k].push(p);});
          const contractGroups=Object.entries(byContract);
          return contractGroups.length?`
            <div style="display:flex;align-items:center;gap:10px;margin:16px 0 10px">
              <div style="flex:1;height:1px;background:var(--border)"></div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--blue)">✔ Processed — Ready for New Period</div>
              <div style="flex:1;height:1px;background:var(--border)"></div>
            </div>
            ${contractGroups.map(([cn,periods])=>`
              <div style="margin-bottom:14px;opacity:.85">
                <div style="font-size:12px;font-weight:700;color:var(--blue);padding:5px 10px;background:rgba(59,130,246,.06);border-radius:4px;margin-bottom:6px;border-left:3px solid var(--blue)">${cn}</div>
                ${periods.map(p=>periodCard(p)).join('')}
              </div>`).join('')}`:'';
        })()}
      `}

      <!-- ── Right-side HR Cards ─────────────────────────────── -->
      </div><!-- close left column -->
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">

        <!-- Management Team card -->
        <div style="background:var(--surface);border:1px solid rgba(240,165,0,.3);border-radius:8px;overflow:hidden;cursor:pointer" onclick="Prod._openFullPanel('mgmt')">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(240,165,0,.05)">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--amber)">👔 Site Management Team</div>
              <div id="mgmt-card-count" style="font-size:10px;color:var(--text3);margin-top:2px">Click to expand</div>
            </div>
            <span style="color:var(--amber);font-size:16px">›</span>
          </div>
        </div>

        <!-- Labour Force Report card -->
        <div style="background:var(--surface);border:1px solid rgba(59,130,246,.3);border-radius:8px;overflow:hidden;cursor:pointer" onclick="Prod._openFullPanel('report')">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(59,130,246,.05)">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--blue)">📊 Labour Force Report</div>
              <div id="lf-card-count" style="font-size:10px;color:var(--text3);margin-top:2px">Click to view</div>
            </div>
            <span style="color:var(--blue);font-size:16px">›</span>
          </div>
        </div>

        <!-- Recruit buttons -->
        <button class="btn amber sm" id="btn-recruit-mgmt" style="width:100%">＋ Recruit Management Staff</button>
        <button class="btn ghost sm" id="btn-new-worker" style="width:100%">＋ Recruit Labour</button>

      </div><!-- close right column -->

    `;

    // Wire recruit buttons
    ge('btn-recruit-mgmt')?.addEventListener('click',()=>{
      Prod.openManagementForm({},()=>{ Prod._updateMgmtCard(); });
    });
    ge('btn-new-worker')?.addEventListener('click',()=>Prod.openWorkerForm({},()=>Payroll.render()));
    Prod._updateMgmtCard();

        ge('btn-save-rs')?.addEventListener('click',()=>{
      const vals={};
      el.querySelectorAll('.rs-val').forEach(inp=>{ vals[inp.dataset.key]=parseFloat(inp.value)||0; });
      const gradedTax={};
      el.querySelectorAll('.rs-gt').forEach(inp=>{ gradedTax[inp.dataset.sk]=parseFloat(inp.value)||0; });
      vals.gradedTax=gradedTax;
      const holidayPayable={}, holidayShifts={};
      el.querySelectorAll('.rs-hol').forEach(inp=>{ holidayPayable[inp.dataset.hdate]=inp.checked; });
      el.querySelectorAll('.rs-shift').forEach(inp=>{ if(inp.value) holidayShifts[inp.dataset.hdate]=inp.value; });
      vals.holidayPayable=holidayPayable; vals.holidayShifts=holidayShifts;
      Payroll.saveSettings(vals);
    });
  },




  // ── PROCESS PERIOD — compute totals from TimesheetEntries ─────────────
  processPeriod(periodId) {
    const period = this.getAllPeriods().find(p=>(p.id||p.periodId)===periodId);
    if(!period){ toast('Period not found','err'); return; }
    const rs = this.getSettings();
    const workers = DB.get('workers', S.project);
    const proj = DB.getProject(S.project)||{};

    // ── Compute rows ──────────────────────────────────────────────────
    let rows;
    if(period.workerBreakdown){try{rows=JSON.parse(period.workerBreakdown);}catch(e){rows=null;}}
    if(!rows||!rows.length){
      const ents=(DB.get('timesheetEntries',S.project)||[]).filter(e=>{
        const d=String(e.date||'').slice(0,10);
        return d>=String(period.openDate||'').slice(0,10)&&d<=String(period.closeDate||'').slice(0,10);
      });
      const bw={};
      ents.forEach(e=>{
        if(!e.workerId||e.isForeman) return;
        if(!bw[e.workerId]) bw[e.workerId]={workerId:e.workerId,name:e.workerName||'',foremanName:e.foremanName||'',skillLevel:e.skillLevel||'',wkNorm:0,wkOT:0,sat12am:0,sat12pm:0,sun:0,hol:0};
        const w=bw[e.workerId], d=new Date(String(e.date||'').slice(0,10)+'T00:00:00'), dow=d.getDay(), dt=e.dateType||'normal', h=+(e.hoursReg||0), o=+(e.hoursOT||0);
        if(dt==='ot_all'){w.hol+=h+o;} else if(dow===6){w.sat12am+=h;w.sat12pm+=o;} else if(dow===0){w.sun+=h+o;} else{w.wkNorm+=h;w.wkOT+=o;}
      });
      rows=Object.values(bw);
    }
    // Re-apply current HR settings
    const gradedObj=rs.gradedTax||{};
    rows=rows.map(w=>{
      const info=workers.find(x=>x.id===w.workerId)||{};
      const rate=+(info.hourlyRate||w.rate||0);
      const wkNormAmt =(w.wkNorm||0)*rate*(rs.wknorm||1);
      const wkOTAmt   =(w.wkOT||0)*rate*(rs.wkot||1.5);
      const sat12amAmt=(w.sat12am||0)*rate*(rs.sat12am||1);
      const sat12pmAmt=(w.sat12pm||0)*rate*(rs.sat12pm||2);
      const sunAmt    =(w.sun||0)*rate*(rs.sun||2);
      const holAmt    =(w.hol||0)*rate*(rs.holWork||2);
      const gross=wkNormAmt+wkOTAmt+sat12amAmt+sat12pmAmt+sunAmt+holAmt;
      const snpf  =+(gross*(+(rs.snpfPct||0)/100)).toFixed(2);
      const adv   =+(info.advanceDeduction||0);
      const paye  =+(gross*(+(rs.payePct||0)/100)).toFixed(2);
      const graded=+(gradedObj[(w.skillLevel||'')]||gradedObj['General']||0);
      const net   =+(gross-snpf-adv-paye-graded).toFixed(2);
      const total =(w.wkNorm||0)+(w.wkOT||0)+(w.sat12am||0)+(w.sat12pm||0)+(w.sun||0)+(w.hol||0);
      return {...w,rate,wkNormAmt,wkOTAmt,sat12amAmt,sat12pmAmt,sunAmt,holAmt,
        gross:+gross.toFixed(2),snpf,advance:adv,paye,graded,net,total,
        payMethod:info.payMethod||w.payMethod||''};
    });

    const isProc=(period.status==='processed'||period.status==='approved'||period.status==='paid');
    const fe=v=>'E '+(+v||0).toFixed(2);
    const fh=v=>(+v||0).toFixed(1)+' h';
    const totGross=rows.reduce((s,r)=>s+(r.gross||0),0);
    const totSnpf =rows.reduce((s,r)=>s+(r.snpf||0),0);
    const totAdv  =rows.reduce((s,r)=>s+(r.advance||0),0);
    const totPaye =rows.reduce((s,r)=>s+(r.paye||0),0);
    const totGrad =rows.reduce((s,r)=>s+(r.graded||0),0);
    const totNet  =rows.reduce((s,r)=>s+(r.net||0),0);
    const totHrs  =rows.reduce((s,r)=>s+(r.total||0),0);

    // ── Build popup HTML as plain string (no nested template literals) ─
    const cell=(big,small,color)=>'<td style="padding:10px 8px;text-align:right;vertical-align:middle">'
      +'<div style="font-size:14px;font-weight:700;color:'+color+'">'+big+'</div>'
      +(small?'<div style="font-size:9px;color:#9ca3af;margin-top:1px">'+small+'</div>':'')
      +'</td>';
    const redCell=(v,h)=>v>0?cell(fe(v),h,'#ef4444'):cell('—','','#9ca3af');
    const bkCard=(label,color,hrs,amt,mult)=>{
      const hasHrs=hrs>0;
      return '<div style="background:#fff;border-radius:6px;padding:10px;border-left:3px solid '+color+';min-width:170px">'
        +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:6px">'+label+'</div>'
        +(hasHrs
          ?'<div style="font-size:18px;font-weight:900;color:'+color+'">'+fe(amt)+'</div>'
           +'<div style="font-size:10px;color:#6b7280;margin-top:3px">'+fh(hrs)+' x '+fe(+rate_)+' x '+mult+'</div>'
          :'<div style="font-size:11px;color:#9ca3af">No hours</div>')
        +'</div>';
    };

    const rowsHTML = rows.map(function(r,ri){
      // rate is accessible via r.rate
      const bk=(label,color,hrs,amt,mult)=>'<div style="background:#fff;border-radius:6px;padding:10px;border-left:3px solid '+color+'">'
        +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:6px">'+label+'</div>'
        +(hrs>0
          ?'<div style="font-size:18px;font-weight:900;color:'+color+'">'+fe(amt)+'</div>'
           +'<div style="font-size:10px;color:#6b7280;margin-top:3px">'+fh(hrs)+' x E'+r.rate.toFixed(2)+'/h x '+mult+'</div>'
          :'<div style="font-size:11px;color:#9ca3af">No hours</div>')
        +'</div>';
      const ded=(label,val)=>val>0?'<div style="font-size:11px;color:#6b7280;margin-bottom:3px"><span style="color:#ef4444;font-weight:700">E'+val.toFixed(2)+'</span> '+label+'</div>':'';
      const breakdown='<tr id="bd-'+ri+'" style="display:none;background:#f0f4ff"><td colspan="15" style="padding:8px 12px 16px">'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;margin-top:4px">'
        +bk('WKNORM','#f59e0b',r.wkNorm,r.wkNormAmt,rs.wknorm||1)
        +bk('WKOT','#f97316',r.wkOT,r.wkOTAmt,rs.wkot||1.5)
        +bk('SAT 12am','#8b5cf6',r.sat12am,r.sat12amAmt,rs.sat12am||1)
        +bk('SAT 12pm','#7c3aed',r.sat12pm,r.sat12pmAmt,rs.sat12pm||2)
        +bk('SUNDAY','#0ea5e9',r.sun,r.sunAmt,rs.sun||2)
        +bk('HOLIDAY','#f43f5e',r.hol,r.holAmt,rs.holWork||2)
        +'<div style="background:#fff;border-radius:6px;padding:10px;border-left:3px solid #ef4444">'
          +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:6px">DEDUCTIONS</div>'
          +ded('SNPF ('+((rs.snpfPct||0).toFixed(1))+'%)',r.snpf)
          +ded('Advance',r.advance)
          +ded('PAYE ('+((rs.payePct||0).toFixed(1))+'%)',r.paye)
          +ded('Graded Tax',r.graded)
          +(r.snpf+r.advance+r.paye+r.graded===0?'<div style="font-size:11px;color:#9ca3af">None</div>':'')
        +'</div>'
        +'<div style="background:#fff;border-radius:6px;padding:10px;border-left:3px solid #22c55e">'
          +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:6px">NET PAY</div>'
          +'<div style="font-size:22px;font-weight:900;color:#22c55e">'+fe(r.net)+'</div>'
          +(r.payMethod?'<div style="font-size:10px;color:#6b7280;margin-top:3px">via '+r.payMethod+'</div>':'')
        +'</div>'
        +'</div></td></tr>';
      return '<tr onclick="tr('+ri+')" style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" class="pr">'
        +'<td style="padding:10px 8px"><div style="font-weight:700">'+r.name+'</div><div style="font-size:10px;color:#9ca3af">'+r.skillLevel+'</div></td>'
        +'<td style="padding:10px 8px;text-align:right;font-size:12px">E '+r.rate.toFixed(2)+'</td>'
        +cell(r.wkNorm>0?fe(r.wkNormAmt):'—',r.wkNorm>0?fh(r.wkNorm):null,'#f59e0b')
        +cell(r.wkOT>0?fe(r.wkOTAmt):'—',r.wkOT>0?fh(r.wkOT):null,'#f97316')
        +cell(r.sat12am>0?fe(r.sat12amAmt):'—',r.sat12am>0?fh(r.sat12am):null,'#8b5cf6')
        +cell(r.sat12pm>0?fe(r.sat12pmAmt):'—',r.sat12pm>0?fh(r.sat12pm):null,'#7c3aed')
        +cell(r.sun>0?fe(r.sunAmt):'—',r.sun>0?fh(r.sun):null,'#0ea5e9')
        +cell(r.hol>0?fe(r.holAmt):'—',r.hol>0?fh(r.hol):null,'#f43f5e')
        +'<td style="padding:10px 8px;text-align:right"><div style="font-size:14px;font-weight:900;color:#22c55e">'+fe(r.gross)+'</div><div style="font-size:9px;color:#9ca3af">'+fh(r.total)+'</div></td>'
        +redCell(r.snpf,null)
        +redCell(r.advance,null)
        +redCell(r.paye,null)
        +redCell(r.graded,null)
        +'<td style="padding:10px 8px;text-align:right"><div style="font-size:16px;font-weight:900;color:#22c55e">'+fe(r.net)+'</div></td>'
        +'<td style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280">'+r.payMethod+'</td>'
        +'</tr>'+breakdown;
    }).join('');

    const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payroll</title>'
      +'<style>'
      +'*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:Segoe UI,Arial,sans-serif;background:#f3f4f6;color:#111}'
      +'.bar{background:#1f2937;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:100}'
      +'.bar h1{font-size:15px;font-weight:700;flex:1}'
      +'.bar .sub{font-size:10px;color:#9ca3af;margin-top:2px}'
      +'.btn{padding:7px 14px;border:none;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px}'
      +'.g{background:#22c55e;color:#fff}.a{background:#f59e0b;color:#fff}.d{background:#374151;color:#fff}.r{background:#ef4444;color:#fff}'
      +'.kpi-row{display:flex;flex-wrap:wrap;gap:12px;padding:16px}'
      +'.kpi{background:#fff;border-radius:8px;padding:14px 18px;flex:1;min-width:130px;box-shadow:0 1px 3px rgba(0,0,0,.07);border-top:3px solid}'
      +'.kv{font-size:20px;font-weight:900;margin-bottom:2px}'
      +'.kl{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px}'
      +'table.m{width:calc(100% - 32px);margin:0 16px 16px;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}'
      +'.m th{padding:10px 8px;font-size:9px;font-weight:700;text-transform:uppercase;background:#1f2937;color:#fff;text-align:right;white-space:nowrap;position:sticky;top:53px;z-index:1}'
      +'.m th:first-child,.m th:nth-child(2){text-align:left}'
      +'.m tfoot td{background:#111;color:#fff;padding:10px 8px;text-align:right;font-weight:700}'
      +'.m tfoot td:first-child{text-align:left}'
      +'.pr:hover{background:#f9fafb}'
      +'</style></head><body>'
      +'<div class="bar"><div><h1>Payroll — '+proj.name+'</h1>'
      +'<div class="sub">'+period.openDate+' to '+period.closeDate+' &nbsp;·&nbsp; By '+period.submittedBy+' &nbsp;·&nbsp; '+(isProc?'Processed':'Pending')+'</div></div>'
      +'<button class="btn d" onclick="window.print()">Print</button>'
      +'<button class="btn a" onclick="ps()">Pay Slips</button>'
      +(isProc?'<button class="btn g" onclick="acc()">Send to Accounting</button>'
              :'<button class="btn g" onclick="pro()">Process &amp; Send to Accounting</button>')
      +'<button class="btn d" onclick="window.close()">Close</button>'
      +'</div>'
      +'<div class="kpi-row">'
      +'<div class="kpi" style="border-color:#3b82f6"><div class="kv">'+rows.length+'</div><div class="kl">Workers</div></div>'
      +'<div class="kpi" style="border-color:#f59e0b"><div class="kv">'+totHrs.toFixed(1)+' h</div><div class="kl">Total Hours</div></div>'
      +'<div class="kpi" style="border-color:#22c55e"><div class="kv">'+fe(totGross)+'</div><div class="kl">Gross Payroll</div></div>'
      +'<div class="kpi" style="border-color:#ef4444"><div class="kv">'+fe(totSnpf+totAdv+totPaye+totGrad)+'</div><div class="kl">Total Deductions</div></div>'
      +'<div class="kpi" style="border-color:#22c55e;background:#f0fdf4"><div class="kv" style="color:#22c55e">'+fe(totNet)+'</div><div class="kl">Net Pay</div></div>'
      +'</div>'
      +'<div style="overflow-x:auto"><table class="m"><thead><tr>'
      +'<th style="text-align:left;min-width:150px">Worker</th><th style="text-align:left">Rate</th>'
      +'<th style="color:#fde68a">WKNORM</th><th style="color:#fed7aa">WKOT</th>'
      +'<th style="color:#ddd6fe">SAT 12am</th><th style="color:#ddd6fe">SAT 12pm</th>'
      +'<th style="color:#bae6fd">SUN</th><th style="color:#fecaca">HOL</th>'
      +'<th style="color:#86efac">GROSS</th>'
      +'<th style="color:#fca5a5">SNPF</th><th style="color:#fca5a5">Advance</th>'
      +'<th style="color:#fca5a5">PAYE</th><th style="color:#fca5a5">Graded Tax</th>'
      +'<th style="color:#86efac">NET PAY</th><th>Method</th>'
      +'</tr></thead><tbody>'+rowsHTML+'</tbody>'
      +'<tfoot><tr><td>TOTALS — '+rows.length+' workers</td><td></td>'
      +'<td colspan="6" style="color:#fbbf24;text-align:right">'+totHrs.toFixed(1)+' h</td>'
      +'<td style="color:#4ade80">'+fe(totGross)+'</td>'
      +'<td style="color:#fca5a5">'+fe(totSnpf)+'</td>'
      +'<td style="color:#fca5a5">'+fe(totAdv)+'</td>'
      +'<td style="color:#fca5a5">'+fe(totPaye)+'</td>'
      +'<td style="color:#fca5a5">'+fe(totGrad)+'</td>'
      +'<td style="color:#4ade80;font-size:14px">'+fe(totNet)+'</td>'
      +'<td></td></tr></tfoot></table></div>'
      +(!isProc?'<div style="text-align:center;padding:20px">'
        +'<button class="btn g" onclick="pro()" style="font-size:13px;padding:12px 28px">Confirm &amp; Process — Submit '+fe(totNet)+' to Accounting</button>'
        +'<p style="font-size:11px;color:#9ca3af;margin-top:6px">Marks period as Processed and sends to Accounting.</p>'
        +'</div>':'')
      +'</body></html>';

    const win = window.open('','_blank','width=1200,height=800');
    if(!win){ toast('Allow pop-ups to open Payroll view','err'); return; }
    win.document.write(html);
    win.document.close();
    win.tr = function(i){
      const bd=win.document.getElementById('bd-'+i);
      if(!bd) return;
      const open=bd.style.display!=='none';
      bd.style.display=open?'none':'table-row';
    };
    win.ps  = function(){ if(win.opener&&win.opener.Payroll) win.opener.Payroll.printPaySlips(periodId); win.close(); };
    win.acc = function(){ if(win.opener&&win.opener.Payroll) win.opener.Payroll._sendToAcc(periodId); win.close(); };
    win.pro = function(){ if(win.opener&&win.opener.Payroll) win.opener.Payroll._confirmProcess(periodId); win.close(); };

    if(!isProc){
      const updated={...period,status:'processed',processedBy:S.user?.name||'',processedAt:new Date().toISOString()};
      const ix=(DB.payrollPeriods||[]).findIndex(p=>(p.id||p.periodId)===periodId);
      if(ix>=0) DB.payrollPeriods[ix]=updated; else { if(!DB.payrollPeriods) DB.payrollPeriods=[]; DB.payrollPeriods.push(updated); }
      if(!S.isDemo&&S.scriptUrl) GAS.post({action:'save',sheet:'PayrollPeriods',record:updated}).catch(()=>{});
    }
    this.render();
  },

  _confirmProcess(periodId) {
    const period=(DB.payrollPeriods||[]).find(p=>(p.id||p.periodId)===periodId);
    if(!period) return;
    const updated={...period, status:'processed', processedBy:S.user?.name||'', processedAt:new Date().toISOString()};
    const ix=(DB.payrollPeriods||[]).findIndex(p=>(p.id||p.periodId)===periodId);
    if(ix>=0) DB.payrollPeriods[ix]=updated;
    else { if(!DB.payrollPeriods) DB.payrollPeriods=[]; DB.payrollPeriods.push(updated); }
    if(!S.isDemo&&S.scriptUrl) GAS.post({action:'save',sheet:'PayrollPeriods',record:updated}).catch(()=>{});
    toast('✅ Period processed — opening Accounting','ok');
    this.render();
    setTimeout(()=>App.setMainTab('accounting'), 400);
  },

  printPaySlips(periodId) {
    const period = this.getAllPeriods().find(p=>(p.id||p.periodId)===periodId);
    if(!period){ toast('Period not found','err'); return; }
    const rs      = this.getSettings();
    const workers = DB.get('workers', S.project);
    const proj    = DB.getProject(S.project)||{};
    const org     = S.org||DB.getOrg(S.user?.orgId)||{};
    let rows;
    if(period.workerBreakdown){try{rows=JSON.parse(period.workerBreakdown);}catch(e){rows=null;}}
    if(!rows||!rows.length){ toast('No payroll data — open Process first','info'); return; }
    const gradedObj=rs.gradedTax||{};
    rows=rows.map(w=>{
      const info=workers.find(x=>x.id===w.workerId)||{};
      const rate=+(info.hourlyRate||w.rate||0);
      const wkNormAmt =(w.wkNorm||0)*rate*(rs.wknorm||1);
      const wkOTAmt   =(w.wkOT||0)*rate*(rs.wkot||1.5);
      const sat12amAmt=(w.sat12am||0)*rate*(rs.sat12am||1);
      const sat12pmAmt=(w.sat12pm||0)*rate*(rs.sat12pm||2);
      const sunAmt    =(w.sun||0)*rate*(rs.sun||2);
      const holAmt    =(w.hol||0)*rate*(rs.holWork||2);
      const gross=wkNormAmt+wkOTAmt+sat12amAmt+sat12pmAmt+sunAmt+holAmt;
      const snpf  =+(gross*(+(rs.snpfPct||0)/100)).toFixed(2);
      const adv   =+(info.advanceDeduction||0);
      const paye  =+(gross*(+(rs.payePct||0)/100)).toFixed(2);
      const graded=+(gradedObj[(w.skillLevel||'')]||gradedObj['General']||0);
      const net   =+(gross-snpf-adv-paye-graded).toFixed(2);
      const total =(w.wkNorm||0)+(w.wkOT||0)+(w.sat12am||0)+(w.sat12pm||0)+(w.sun||0)+(w.hol||0);
      return {...w,rate,wkNormAmt,wkOTAmt,sat12amAmt,sat12pmAmt,sunAmt,holAmt,
        gross:+gross.toFixed(2),snpf,advance:adv,paye,graded,net,total,
        payMethod:info.payMethod||w.payMethod||'',bankName:info.bankName||'',
        accountNumber:info.accountNumber||'',branchCode:info.branchCode||'',
        employeeId:info.employeeId||w.workerId||''};
    }).filter(r=>!r.isForeman);
    const fe=v=>v>0?'E '+(+v).toFixed(2):'—';
    const orgName=org.name||proj.name||'AFRI CIVILS';
    const orgAddr=org.address||'P.O Box C1983 Manzini';
    const orgTel =org.phone||'Tel/Fax 25058150';
    const slipHTML = rows.map(r=>{
      const earningsRows=[
        r.wkNorm>0?'<tr><td>WKNORM ('+r.wkNorm.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.wknorm||1)+')</td><td>'+fe(r.wkNormAmt)+'</td></tr>':'',
        r.wkOT>0?'<tr><td>WKOT ('+r.wkOT.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.wkot||1.5)+')</td><td>'+fe(r.wkOTAmt)+'</td></tr>':'',
        r.sat12am>0?'<tr><td>SAT 12am ('+r.sat12am.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.sat12am||1)+')</td><td>'+fe(r.sat12amAmt)+'</td></tr>':'',
        r.sat12pm>0?'<tr><td>SAT 12pm ('+r.sat12pm.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.sat12pm||2)+')</td><td>'+fe(r.sat12pmAmt)+'</td></tr>':'',
        r.sun>0?'<tr><td>Sunday ('+r.sun.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.sun||2)+')</td><td>'+fe(r.sunAmt)+'</td></tr>':'',
        r.hol>0?'<tr><td>Holiday ('+r.hol.toFixed(2)+'h x E'+r.rate.toFixed(2)+' x '+(rs.holWork||2)+')</td><td>'+fe(r.holAmt)+'</td></tr>':'',
      ].filter(Boolean).join('');
      const totalDed=+(r.snpf+r.paye+r.advance+r.graded).toFixed(2);
      return '<div class="slip">'
        +'<table class="hdr-tbl"><tr>'
        +'<td class="logo-cell"><div class="co-name">'+orgName+'</div><div class="co-sub">Irrigation for Africa</div></td>'
        +'<td class="title-cell"><span class="slip-title">Salary Slip</span></td>'
        +'<td class="addr-cell"><div>'+orgAddr+'</div><div>'+orgTel+'</div></td>'
        +'</tr></table>'
        +'<div class="divider"></div>'
        +'<table class="info-tbl"><tr>'
        +'<td><span class="lbl">Employee Name:</span> <span class="val">'+r.name+'</span></td>'
        +'<td><span class="lbl">Pay Period End Date:</span> <span class="val">'+period.closeDate+'</span></td>'
        +'</tr><tr>'
        +'<td><span class="lbl">Employee ID:</span> <span class="val">'+r.employeeId+'</span></td>'
        +'<td><span class="lbl">Hours/Days:</span> <span class="val">'+r.total.toFixed(2)+'</span></td>'
        +'</tr><tr>'
        +'<td><span class="lbl">Job Type:</span> <span class="val">'+r.skillLevel+'</span></td>'
        +'<td><span class="lbl">Rate:</span> <span class="val">E '+r.rate.toFixed(2)+'/hr</span></td>'
        +'</tr></table>'
        +'<div class="divider"></div>'
        +'<table class="two-col"><tr><td class="half">'
        +'<div class="sec-hdr">Earnings</div><table class="lines">'+earningsRows+'</table>'
        +'</td><td class="half">'
        +'<div class="sec-hdr">Deductions</div><table class="lines">'
        +(r.snpf>0?'<tr><td>SNPF ('+(rs.snpfPct||0).toFixed(1)+'%)</td><td>'+fe(r.snpf)+'</td></tr>':'')
        +(r.paye>0?'<tr><td>PAYE ('+(rs.payePct||0).toFixed(1)+'%)</td><td>'+fe(r.paye)+'</td></tr>':'')
        +(r.advance>0?'<tr><td>Advance</td><td>'+fe(r.advance)+'</td></tr>':'')
        +(r.graded>0?'<tr><td>Graded Tax</td><td>'+fe(r.graded)+'</td></tr>':'')
        +(totalDed===0?'<tr><td colspan="2" style="color:#9ca3af">None</td></tr>':'')
        +'</table></td></tr></table>'
        +'<div class="divider"></div>'
        +'<table class="totals-tbl"><tr>'
        +'<td><span class="lbl">Total Earnings</span><span class="tot-v">'+fe(r.gross)+'</span></td>'
        +'<td><span class="lbl">Total Deductions</span><span class="tot-v red">-'+fe(totalDed)+'</span></td>'
        +'</tr></table>'
        +'<table class="net-tbl"><tr>'
        +'<td class="net-lbl">Current NET Salary</td><td class="net-val">'+fe(r.net)+'</td>'
        +'</tr></table>'
        +'<div class="divider"></div>'
        +'<table class="two-col"><tr><td class="half">'
        +'<div class="sec-hdr">Payment Information</div><table class="lines">'
        +'<tr><td>Check Date:</td><td>'+period.closeDate+'</td></tr>'
        +'<tr><td>Payment Method:</td><td>'+r.payMethod+'</td></tr>'
        +'<tr><td>Name of Bank:</td><td>'+r.bankName+'</td></tr>'
        +(r.accountNumber?'<tr><td>Account Number:</td><td>'+r.accountNumber+'</td></tr>':'')
        +'</table></td><td class="half">'
        +'<div class="sec-hdr">Time Off Balance</div><table class="lines">'
        +'<tr><td>Paid Time Off:</td><td>0</td></tr>'
        +'<tr><td>Sick Time:</td><td>0</td></tr>'
        +'<tr><td>Total:</td><td>0</td></tr>'
        +'</table></td></tr></table>'
        +'<div class="divider"></div>'
        +'<table class="sig-tbl"><tr>'
        +'<td>Employee Signature: ___________________________________</td>'
        +'<td>Director Signature: ___________________________________</td>'
        +'</tr></table>'
        +'</div>';
    }).join('');
    const css=(()=>{const _ds=typeof DocumentControl!=='undefined'?DocumentControl._getDocSettings('monthly_timesheet'):{};const _s=Object.assign({},ReportSettings.get(),Object.fromEntries(Object.entries(_ds).filter(([k,v])=>v&&v!=='')));const hc=_s.headerColor||'#1a6b3a',ff=_s.fontFamily||'Arial',fs=_s.fontSize||9.5;return '*{box-sizing:border-box;margin:0;padding:0}'+'body{font-family:'+ff+',sans-serif;font-size:'+fs+'pt;background:#fff;color:#000}'+'th{background:'+hc+';color:#fff}td,th{border:1px solid #ccc}';})()
    const win=window.open('','_blank','width=850,height=1000');
    if(!win){toast('Allow pop-ups','err');return;}
    const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Slips</title><style>'+css+'</style></head><body>'
      +'<div class="toolbar">'
      +'<span style="color:#fff;font-size:13px;flex:1">Pay Slips — '+period.closeDate+' &nbsp;('+rows.length+' workers)</span>'
      +'<button onclick="window.print()" style="background:#f59e0b;color:#fff">Print All</button>'
      +'<button onclick="window.close()" style="background:#6b7280;color:#fff">Close</button>'
      +'</div><div class="spacer"></div>'+slipHTML+'</body></html>';
    win.document.write(html);
    win.document.close();
    setTimeout(function(){win.print();},800);
  },

  _sendToAcc(periodId) {
    const period = this.getAllPeriods().find(p=>(p.id||p.periodId)===periodId);
    if(!period){ toast('Period not found','err'); return; }
    const accRec = {
      id:'ACC-'+uid(), project:S.project, orgId:_orgId(),
      periodId, periodRef:period.periodRef||periodId,
      openDate:period.openDate, closeDate:period.closeDate,
      totalGross:period.totalGross||0, totalNet:period.totalNet||0,
      workers:period.workers||0, entries:period.entries||0,
      submittedBy:S.user?.name||'', submittedAt:new Date().toISOString(),
      status:'pending', payrollSnapshot:period.workerBreakdown||'[]',
      createdBy:S.user?.id||''
    };
    if(!DB.accRecords) DB.accRecords=[];
    DB.accRecords.push(accRec);
    if(!S.isDemo&&S.scriptUrl)
      GAS.post({action:'save',sheet:'AccRecords',record:accRec}).catch(()=>{});
    const updPeriod={...period,status:'paid',sentToAccAt:new Date().toISOString(),sentToAccBy:S.user?.name||''};
    const ix=(DB.payrollPeriods||[]).findIndex(p=>(p.id||p.periodId)===periodId);
    if(ix>=0) DB.payrollPeriods[ix]=updPeriod;
    if(!S.isDemo&&S.scriptUrl)
      GAS.post({action:'save',sheet:'PayrollPeriods',record:updPeriod}).catch(()=>{});
    toast('📤 Submitted to Accounting','ok');
    this.render();
    setTimeout(()=>App.setMainTab('accounting'), 400);
  },

};


(function() {
  const saved = sessionStorage.getItem('civmetrix_session');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      if (u && u.id) {
        S.user = u;
        const stored = localStorage.getItem('civmetrix_url');
        if (stored) { S.scriptUrl = stored; S.isDemo = false; }
        else if (localStorage.getItem('civmetrix_demo') === '1') { S.isDemo = true; }
      }
    } catch(e) {}
  }
  Setup.init();
window.fgCalcBal = function(){
      // Balance = Still to Deliver for current PO item (or Ordered-Received for cash)
      var el=ge('fg-qbal'); if(!el) return;
      var ordId=(ge('fg-order')||{}).value||'';
      var bal=0;
      if(ordId){
        var po=(DB.purchaseOrders||[]).find(function(x){return x.id===ordId;});
        if(po){
          var prevRec=(DB.get('grn',S.project)||[])
            .filter(function(g){return g.orderNumber&&g.orderNumber===po.orderNumber&&g.material===po.material&&(!po.unit||!g.unit||g.unit===po.unit);})
            .reduce(function(s,g){return s+(+(g.qtyReceived||0));},0);
          bal=Math.max(0,+(po.qtyOrdered||0)-prevRec);
        }
      } else {
        var ord=parseFloat((ge('fg-qord')||{}).value)||0;
        var rec=parseFloat((ge('fg-qrec')||{}).value)||0;
        bal=Math.max(0,ord-rec);
      }
      el.textContent=bal.toFixed(2)+(bal>0?' ⚠':' ✅');
      el.style.color=bal>0?'var(--orange)':'var(--green)';
    };

    window._grnPoFilter = function(q){
      q=(q||'').toLowerCase();
      var list=ge('fg-order-list'); if(!list) return;
      var orders=(DB.purchaseOrders||[]).filter(function(o){return !o.project||o.project===S.project;});
      if(!q){
        list.style.display='none';
        var hid=ge('fg-order'); if(hid&&!q){
          hid.value='';
          ['fg-wrap-datereq2','fg-wrap-datereq','fg-wrap-lostdays'].forEach(function(id){var w=ge(id);if(w)w.style.display='none';});
        }
        return;
      }
      var filtered=orders.filter(function(o){
        return (o.orderNumber||'').toLowerCase().includes(q)
          ||(o.material||'').toLowerCase().includes(q)
          ||(o.supplier||'').toLowerCase().includes(q);
      });
      // Group by orderNumber
      var byNo={};
      filtered.forEach(function(o){
        if(!byNo[o.orderNumber]) byNo[o.orderNumber]=[];
        byNo[o.orderNumber].push(o);
      });
      if(!Object.keys(byNo).length){
        list.innerHTML='<div style="padding:10px 14px;font-size:11px;color:var(--text3)">No matching orders found.</div>';
        list.style.display=''; return;
      }
      list.innerHTML=Object.keys(byNo).map(function(no){
        var items=byNo[no];
        var sup=items[0].supplier;
        var totalOrdered=items.reduce(function(s,o){return s+(+(o.qtyOrdered||0));},0);
        var totalRec=items.reduce(function(s,o){
          var g=(DB.get('grn',S.project)||[]).filter(function(g){return g.orderId===o.id||g.orderNumber===o.orderNumber;});
          return s+g.reduce(function(s2,gr){return s2+(+(gr.qtyReceived||0));},0);
        },0);
        var out=Math.max(0,totalOrdered-totalRec);
        return '<div data-onum="'+no.replace(/"/g,'&quot;')+'" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border)" '
          +'onmouseenter="this.style.background=\'var(--surface)\'" onmouseleave="this.style.background=\'\'" '
          +'onclick="window._grnOrderSel(this.dataset.onum)">'
          +'<div style="font-weight:700;color:var(--blue)">'+no+'</div>'
          +'<div style="font-size:11px;color:var(--text2)">'+sup+' &middot; '+items.length+' item'+(items.length!==1?'s':'')+'</div>'
          +'<div style="display:flex;gap:12px;margin-top:3px;font-size:10px;color:var(--text3)">'
          +'<span>Total Ordered: <b>'+totalOrdered.toFixed(2)+'</b></span>'
          +'<span>Received: <b style="color:var(--blue)">'+totalRec.toFixed(2)+'</b></span>'
          +'<span>Outstanding: <b style="color:'+(out>0?'var(--orange)':'var(--green)')+'">'+out.toFixed(2)+'</b></span>'
          +'</div></div>';
      }).join('');
      list.style.display='';
    };

    window._grnOrderSel = function(orderNumber){
      if(!orderNumber) return;
      // Find ALL items with this order number
      var allItems=(DB.purchaseOrders||[]).filter(function(o){
        return o.orderNumber===orderNumber&&(!o.project||o.project===S.project);
      });
      if(!allItems.length) return;
      var o0=allItems[0]; // representative for dates/supplier

      // Close dropdown + update display
      var list=ge('fg-order-list'); if(list) list.style.display='none';
      var srch=ge('fg-order-search');
      if(srch) srch.value=orderNumber+' ('+allItems.length+' item'+(allItems.length!==1?'s':'')+')';
      var hid=ge('fg-order'); if(hid) hid.value=o0.orderHeaderId||o0.id; // store headerid
      var chosen=ge('fg-order-chosen');
      if(chosen) chosen.textContent='✔ '+orderNumber+' selected — '+allItems.length+' item'+(allItems.length!==1?'s':'');

      // Auto-fill dates
      var dReq2=ge('fg-datereq2'); if(dReq2) dReq2.value=o0.orderDate||'';
      var dReq=ge('fg-datereq');   if(dReq) dReq.value=o0.requiredDate||'';
      if(ge('fg-lostdays')&&ge('fg-date')&&o0.requiredDate){
        var rcvd=ge('fg-date').value;
        var diff=rcvd?Math.round((new Date(rcvd)-new Date(o0.requiredDate))/(86400000)):0;
        ge('fg-lostdays').value=diff>0?diff:0;
        ge('fg-lostdays').style.color=diff>0?'var(--red)':'var(--green)';
      }

      // Auto-fill supplier
      var supInp=ge('fg-sup'); if(supInp&&o0.supplier) supInp.value=o0.supplier;

      // Show PO-only header fields
      ['fg-wrap-datereq2','fg-wrap-datereq','fg-wrap-lostdays'].forEach(function(id){
        var w=ge(id); if(w) w.style.display='';
      });

      // Show PO columns in items table header
      document.querySelectorAll('#fg-wrap-qord-h,#fg-wrap-prev-h,#fg-wrap-qbal-h').forEach(function(el){
        if(el) el.style.display='';
      });

      // Clear existing rows + add one row per PO item
      var tbody=ge('fg-items-body');
      if(tbody){
        tbody.innerHTML='';
        allItems.forEach(function(o){
          var prevGrn=(DB.get('grn',S.project)||[]).filter(function(g){
            return g.orderNumber&&g.orderNumber===o.orderNumber
              &&g.material===o.material&&(!o.unit||!g.unit||g.unit===o.unit);
          });
          var prevRec=prevGrn.reduce(function(s,g){return s+(+(g.qtyReceived||0));},0);
          var outstanding=Math.max(0,+(o.qtyOrdered||0)-prevRec);
          // Get last known unit cost
          var lastCost=o.unitCost;
          if(!lastCost){
            var lg=prevGrn.sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));})[0];
            if(lg) lastCost=lg.unitCost||'';
          }
          // Build row with per-item PO context
          window._grnAddRow&&window._grnAddRow(
            o.material, o.unit, '', lastCost||'', // mat, unit, qtyRec, cost
            o.id, o.qtyOrdered, prevRec, outstanding // poItemId, poQtyOrd, prevRec, outstanding
          );
        });
      }

            // Per-item context strips shown inline below each row }
    };

    
    })();

(new MutationObserver(()=>{
  const t=document.getElementById('pur-tbl');
  if(t&&!t.dataset.pi){t.dataset.pi='1';setTimeout(()=>{_purPage(1);_fdPage(1);},60);}
})).observe(document.body,{childList:true,subtree:true});
function _fdPage(pg){
  const pp=document.getElementById('fd-pages');
  if(!pp) return;
  const gs=Array.from(document.querySelectorAll('[data-fd-group]'));
  const tot=gs.length; if(!tot) return;
  const ps=5,pages=Math.max(1,Math.ceil(tot/ps));
  pg=Math.max(1,Math.min(pg,pages));
  gs.forEach((g,i)=>{
    const vis = (i>=(pg-1)*ps&&i<pg*ps);
    g.style.display = vis?'':'none';
    // Also hide this group's detail rows-tr (the next sibling row), and
    // re-collapse it so it never bleeds under another group when paginated
    const rowsTr = g.nextElementSibling;
    if(rowsTr && rowsTr.id && rowsTr.id.endsWith('-rows')){
      if(!vis){ rowsTr.style.display='none'; }
      // when visible, keep whatever collapsed/expanded state it had (default none)
    }
  });
  pp.innerHTML='';
  if(pages<=1) return;
  const mk=(l,a,d,fn)=>{const b=document.createElement('button');b.textContent=l;b.onclick=fn;b.disabled=d;b.style.cssText='padding:2px 7px;font-size:10px;border-radius:4px;border:1px solid '+(a?'var(--orange)':'var(--border)')+';background:'+(a?'var(--orange)':'var(--surface)')+';color:'+(a?'#000':'var(--text)');return b;};
  pp.appendChild(mk('<',0,pg===1,()=>_fdPage(pg-1)));
  for(let i=1;i<=pages;i++) pp.appendChild(mk(i,i===pg,0,((x)=>()=>_fdPage(x))(i)));
  pp.appendChild(mk('>',0,pg===pages,()=>_fdPage(pg+1)));
}
function _purPage(pg){
  const tbl=document.getElementById('pur-tbl');
  if(!tbl) return;
  const rows=Array.from(tbl.querySelectorAll('tbody tr'));
  const ps=parseInt(document.getElementById('pur-ps')?.value||10);
  const tot=rows.length;
  const pages=Math.max(1,Math.ceil(tot/ps));
  pg=Math.max(1,Math.min(pg,pages));
  rows.forEach((r,i)=>{r.style.display=(i>=(pg-1)*ps&&i<pg*ps)?'':'none';});
  const info=document.getElementById('pur-info');
  if(info) info.textContent=tot===0?'No records':'Showing '+(Math.min((pg-1)*ps+1,tot))+'–'+(Math.min(pg*ps,tot))+' of '+tot+' records';
  const pp=document.getElementById('pur-pages');
  if(!pp) return;
  pp.innerHTML='';
  const mk=(lbl,act,dis,fn)=>{const b=document.createElement('button');b.textContent=lbl;b.onclick=fn;b.disabled=dis;b.style.cssText='padding:3px 9px;font-size:11px;border-radius:4px;border:1px solid '+(act?'var(--amber)':'var(--border)')+';background:'+(act?'var(--amber)':'var(--surface)')+';color:'+(act?'#000':'var(--text)')+';cursor:'+(dis?'default':'pointer')+';opacity:'+(dis?.4:1);return b;};
  pp.appendChild(mk('<',false,pg===1,()=>_purPage(pg-1)));
  const s=Math.max(1,pg-2),e=Math.min(pages,s+4);
  for(let i=s;i<=e;i++) pp.appendChild(mk(i,i===pg,false,((x)=>()=>_purPage(x))(i)));
  pp.appendChild(mk('>',false,pg===pages,()=>_purPage(pg+1)));
}


// ════════════════════════════════════════════════════════════════
// 🚜 PLANT USAGE RECORDS — REPORTS
// ════════════════════════════════════════════════════════════════



const DailyProgressReports = {
  open() {
    const daily = DB.get('daily',S.project)||[];
    const normD = v=>v?String(v).slice(0,10):'';
    const dates = daily.map(d=>normD(d.date)).filter(Boolean).sort();
    const minD  = dates[0]||'', maxD = dates[dates.length-1]||'';
    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;align-items:flex-end;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">FROM</label>
          <input type="date" id="dp-from" value="${minD}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">TO</label>
          <input type="date" id="dp-to" value="${maxD}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <button onclick="DailyProgressReports.run()" style="background:var(--amber);color:#000;border:none;border-radius:4px;padding:5px 16px;font-size:11px;font-weight:700;cursor:pointer;align-self:flex-end">Generate</button>
      </div>
      <div id="dp-output" style="max-height:65vh;overflow:auto"></div>`;
    Modal.open('Daily Progress Report', html,
      [{label:'Print',        cls:'amber', fn:()=>DailyProgressReports.print()},
       {label:'Export CSV',   cls:'ghost', fn:()=>DailyProgressReports.exportCSV()},
       {label:'Export Excel', cls:'ghost', fn:()=>DailyProgressReports.exportExcel()},
       {label:'Close',        cls:'ghost', fn:Modal.close.bind(Modal)}],
      {fullscreen:true});
    setTimeout(()=>DailyProgressReports.run(), 50);
  },


  _filter(){
    const daily=DB.get('daily',S.project)||[];
    const normD=v=>v?String(v).slice(0,10):'';
    const from=document.getElementById('dp-from')?.value||'';
    const to=document.getElementById('dp-to')?.value||'';
    return daily.filter(d=>{const dd=normD(d.date);return(!from||dd>=from)&&(!to||dd<=to);}).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  },
  _row(d,tsE,matUsage,msRecs,normD){
    const dd=normD(d.date);
    const dayTs=tsE.filter(e=>normD(e.date)===dd);
    const dayMt=matUsage.filter(m=>normD(m.date)===dd);
    const dayMs=msRecs.filter(m=>normD(m.date)===dd);
    const wkrs=new Set(dayTs.map(e=>e.workerId).filter(Boolean)).size;
    const labC=parseFloat(d.labourCost||0);
    const matC=dayMt.reduce((s,m)=>s+parseFloat(m.cost||0),0);
    const acts=[...new Set(dayTs.flatMap(e=>{try{return JSON.parse(e.activities||'[]').map(a=>a.d||a.c||'');}catch{return[e.description||''];}}).filter(Boolean))].join(' | ')||d.section||'—';
    const fmns=[...new Set(dayTs.map(e=>e.foremanName).filter(Boolean))].join(', ')||'—';
    return {dd,wkrs,labC,matC,acts,fmns,remarks:d.remarks||'',weather:d.weather||'',dayMs};
  },  run(){
    const el = document.getElementById('dp-output'); if(!el) return;
    // Grab the Daily Activity Log by Foreman table as shown
    const srcTbl = document.querySelector('#inn-progress .tbl');
    if(!srcTbl || !srcTbl.querySelector('tbody tr')){
      el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">Click the Daily Progress sub-tab first to load data, then generate.</div>';
      return;
    }
    const from = document.getElementById('dp-from')?.value||'';
    const to   = document.getElementById('dp-to')?.value||'';
    const clone = srcTbl.cloneNode(true);
    // Strip interactive controls so they never reach the report/printout
    // (e.g. the 📊 Rate Worksheet button in the Rate column).
    clone.querySelectorAll('button, input, select, textarea').forEach(n=>n.remove());
    // Honour the FROM / TO dates. Each activity row carries data-row-key = date||foreman||activity.
    if(from || to){
      clone.querySelectorAll('tbody tr[data-row-key]').forEach(tr=>{
        let dt='';
        try{ dt = decodeURIComponent(tr.getAttribute('data-row-key')||'').split('||')[0]||''; }catch(e){}
        if(dt && ((from && dt < from) || (to && dt > to))) tr.remove();
      });
    }
    const remaining = clone.querySelectorAll('tbody tr[data-row-key]').length;
    el.innerHTML = remaining
      ? '<div style="overflow-x:auto">'+clone.outerHTML+'</div>'
      : '<div style="padding:24px;text-align:center;color:var(--text3)">No activity records between the selected dates.</div>';
  },

  print(){
    // Regenerate first so the printout always matches the FROM / TO dates currently
    // in the form — even if Generate wasn't pressed after changing them.
    try{ this.run(); }catch(e){}
    const tbl = document.querySelector('#dp-output .tbl');
    if(!tbl){ alert('No data to print. Please view the Daily Progress tab first.'); return; }
    const _proj = DB.getProject(S.project)||{};
    const s = Object.assign({}, ReportSettings.get());
    const hc = s.headerColor||'#2d6a2d';
    const ff = s.fontFamily||'Arial';
    const from = document.getElementById('dp-from')?.value||'';
    const to   = document.getElementById('dp-to')?.value||'';
    const fmtD = v => v ? new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';
    const dateRange = (from||to) ? (fmtD(from)||'…')+' – '+(fmtD(to)||'…') : 'All Dates';
    // Document Control header (Header Type — QMS Control Header by default)
    const cfg = (typeof Prod!=='undefined' && Prod._docSettings) ? Prod._docSettings('daily_progress')
                                                                 : {headerType:'qms', headerColor:hc, fontFamily:ff};
    const _hc = cfg.headerColor||hc, _ff = cfg.fontFamily||ff;
    const hdrBlock = (typeof Prod!=='undefined' && Prod._reportHeader)
      ? Prod._reportHeader(cfg,{title:'DAILY PROGRESS REPORT',
          defaultDocId:'PROD-DPR-01 · Daily Progress Report',
          contractName:(_proj.name||S.project||'—'), period:dateRange})
      : '<div style="font-size:15px;font-weight:700;color:'+_hc+'">DAILY PROGRESS REPORT</div>';
    const css='body{font-family:'+_ff+',sans-serif;font-size:11px;color:#000;background:#fff}'
      +'table{width:100%;border-collapse:collapse}'
      +((typeof Prod!=='undefined'&&Prod._dcHeaderCSS)?Prod._dcHeaderCSS(_hc):'')
      +' .tbl th{background:'+_hc+';color:#fff;padding:5px 8px;font-size:10px;text-align:left;white-space:nowrap}'
      +' .tbl td{padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:10px;vertical-align:middle}'
      +' .tbl tr:nth-child(even) td{background:#f9fafb}';
    const inner = hdrBlock + tbl.outerHTML
      + '<div style="margin-top:16px;font-size:9px;color:#777">Printed '+new Date().toLocaleString('en-GB')+'</div>';
    if(typeof Prod!=='undefined' && Prod._reportWindow){ Prod._reportWindow('Daily Progress Report', css, inner, _hc); return; }
    const w = window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Daily Progress Report</title><style>'+css+'</style></head><body>'+inner+'</body></html>');
    w.document.close();
    setTimeout(()=>w.print(),300);
  },

  exportExcel(){
    if(typeof XLSX==='undefined'){alert('Excel library not loaded. Use CSV instead.');return;}
    const from=document.getElementById('dp-from')?.value||'';
    const to=document.getElementById('dp-to')?.value||'';
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const tsEntries=DB.get('timesheetEntries',S.project)||[];
    const workers=DB.get('workers',S.project)||[];
    const actCodes=DB.get('activityCodes',S.project)||[];
    const toMins=t=>{if(!t)return null;const[h,m]=String(t).split(':').map(Number);return(h||0)*60+(m||0);};
    const rs=typeof Payroll!=='undefined'?Payroll.getSettings():{wknorm:1,wkot:1.5,sat12am:1,sat12pm:2,sun:2,holWork:2,holRest:1};
    const filtered=tsEntries.filter(e=>{const dt=normD(e.date);return(!from||dt>=from)&&(!to||dt<=to);});
    const rowMap={};const rowOrder=[];
    filtered.forEach(e=>{const dt=normD(e.date);let acts=[];try{acts=JSON.parse(e.activities||'[]');}catch{}if(!acts.length)acts=[{c:e.activityCode||'',d:e.description||'',s:e.activityStart||e.dayStart||'',e2:e.activityEnd||e.dayEnd||'',h:+(e.totalHrs||e.hoursReg||0)}];acts.forEach(a=>{const key=dt+'|'+(e.foremanName||'')+'|'+(a.c||a.d||'_');if(!rowMap[key]){rowMap[key]={key,dt,foreman:e.foremanName||'',actCode:a.c||'',actDesc:a.d||'',start:a.s||'',end:a.e||a.e2||'',entries:[]};rowOrder.push(key);}rowMap[key].entries.push(Object.assign({},e,{_actHrs:a.h||0,_effStart:a.s||'',_actStart:a.s||'',_actEnd:a.e||a.e2||''}));});});
    const hdrs=['Foreman','Date','Activity','Start','End','Act.Hrs','Workers','Labour (E)','Plant (E)','Total Cost (E)'];
    const aoa=[hdrs,...rowOrder.map(key=>{
      const g=rowMap[key];
      const dow=new Date((g.dt||'2000-01-01')+'T00:00:00').getDay();
      const actLbl=g.actCode?(actCodes.find(a=>a.code===g.actCode)?.name||g.actDesc||g.actCode):g.actDesc||'—';
      const wv=g.entries.filter(e=>!e.isForeman).length;
      const aS=toMins(g.start),aE=toMins(g.end);let ahv=0;
      if(aS!==null&&aE!==null&&aE>aS){ahv=Math.max(0,aE-aS)/60;}else{ahv=g.entries.reduce((s,e)=>s+(e._actHrs||+(e.hoursReg||0)),0);}
      const lv=g.entries.reduce((tot,e)=>{if(e.isForeman)return tot;const wr=workers.find(w=>w.id===e.workerId)||{};const rate=parseFloat(String(wr.hourlyRate||e.hourlyRate||0));if(!rate)return tot;const aS2=toMins(e._effStart||''),aE2=toMins(e._actEnd||'');let wh=0;if(aS2!==null&&aE2!==null&&aE2>aS2){wh=Math.max(0,aE2-aS2)/60;}else{wh=e._actHrs||+(e.hoursReg||0);}const dt2=String(e.dateType||'normal');const mult=dow===0?rs.sun:dt2==='ot_all'?rs.holWork:dow===6?rs.sat12am:rs.wknorm;return tot+wh*rate*mult;},0);
      return[g.foreman,fmtD(g.dt),actLbl,g.start||'',g.end||'',+ahv.toFixed(2),wv,+lv.toFixed(2),0,+lv.toFixed(2)];
    })];
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb,ws,'Daily Progress');
    XLSX.writeFile(wb,'Daily_Progress_Report.xlsx');
  },

    exportCSV(){
    const data=this._filter();if(!data.length){alert('No records');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const tsE=DB.get('timesheetEntries',S.project)||[];
    const matU=DB.get('materialUsage',S.project)||[];
    const msR=DB.get('dailyMeasurements',S.project)||[];
    const esc=v=>{const s=String(v==null?'':v);return(s.indexOf(',')>=0||s.indexOf('"')>=0)?'"'+s.split('"').join('""')+'"':s;};
    const hdrs=['Date','Weather','Foreman','Activities','Workers','Labour (E)','Material (E)','Measurements','Remarks'];
    const rows=data.map(d=>{const r=this._row(d,tsE,matU,msR,normD);return[r.dd,r.weather,r.fmns,r.acts,r.wkrs,r.labC.toFixed(2),r.matC.toFixed(2),r.dayMs.length,r.remarks];});
    const csv=[hdrs,...rows].map(r=>r.map(esc).join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='Daily_Progress.csv';a.click();URL.revokeObjectURL(a.href);
  },
};


// ════════════════════════════════════════════════════════════════════════════
// 📄 DOCUMENT CONTROL
// ════════════════════════════════════════════════════════════════════════════
