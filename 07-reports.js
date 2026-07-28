/* CivMetrix — 07-reports.js
 * Document Control, report settings, transfers, plant & fuel reports
 *
 * Part 7 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */

const DocumentControl = {

  // ── Document Registry ────────────────────────────────────────────────────
  registry: [
    { id:'monthly_plant_return',  name:'Monthly Plant Return',         tab:'plant',    icon:'🚜', desc:'Per-equipment monthly plant usage return (AFRI CIVILS template)', fields:['regId','plantType','date','hrOpening','hrClosing','activityStart','activityEnd','hrsWorked','idleHrs','incWeather','breakdown','weather','agreed'] },
    { id:'plant_usage_report',    name:'Plant Usage Records Report',   tab:'plant',    icon:'🚜', desc:'Detailed plant usage with cost, fuel and production data',         fields:['date','equipment','regId','hrOpening','hrClosing','activityStart','activityEnd','hrsWorked','idleHrs','incWeather','breakdown','plantCost','fuelCost','total'] },
    { id:'fuel_disbursements',    name:'Fuel Disbursements Report',    tab:'plant',    icon:'⛽', desc:'Fuel issues ledger and consumption analysis',                       fields:['date','regId','plantType','litres','odometer','costPerLitre','cost','issuedBy','reconStatus'] },
    { id:'fuel_variance',         name:'Fuel Variance vs Inventory',   tab:'plant',    icon:'⛽', desc:'Actual vs theoretical fuel consumption comparison',                 fields:['regId','actualLhr','theorLhr','variance','totalCost','actualCostHr'] },
    { id:'weekly_timesheet',      name:'Weekly Timesheet',             tab:'labour',   icon:'👷', desc:'Weekly labour timesheet per worker',                               fields:['workerName','trade','date','startTime','endTime','hoursWorked','rate','total','overtime'] },
    { id:'monthly_timesheet',     name:'Monthly Timesheet',            tab:'labour',   icon:'👷', desc:'Monthly consolidated labour timesheet',                            fields:['workerName','trade','totalDays','totalHours','regularPay','overtimePay','totalPay'] },
    { id:'daily_progress',        name:'Daily Progress Report',        tab:'daily',    icon:'📊', desc:'Daily site progress — activities, labour, plant, measurements', headerType:'qms', fields:['date','weather','foreman','activities','workers','labourCost','remarks'] },
    { id:'ncr_register',          name:'NCR Register',                 tab:'sheq',     icon:'⚠',  desc:'Non-conformance register and tracking',                            fields:['ncrNo','date','description','raisedBy','status','closeOutDate'] },
    { id:'material_requisition',  name:'Material Requisition',         tab:'stores',   icon:'📦', desc:'Material request and issue form',                                  fields:['date','itemCode','description','qty','unit','requestedBy','approvedBy'] },
    { id:'site_instruction',      name:'Site Instruction',             tab:'sheq',     icon:'📋', desc:'Formal site instruction document',                                 fields:['siNo','date','issuedBy','description','actionBy','dueDate','status'] },
    { id:'toolbox_talk',          name:'Toolbox Talk Record',          tab:'sheq',     icon:'🪛', desc:'Safety toolbox talk attendance and content record',                fields:['date','topic','presenter','attendees','signatureCount'] },
    { id:'plant_inventory',       name:'Plant Inventory Register',     tab:'plant',    icon:'🚜', desc:'Complete plant fleet register with rates and specs',               fields:['regId','type','description','ownerSupplier','minRate','minHours','fuelConsumption'] },
    { id:'costing_report',        name:'Costing Report',               tab:'costing',  icon:'💰', desc:'Project cost report — QMS header, executive summary, cost breakdowns and S-curve', fields:['month','group','category','supplier','description','amount'] },
    { id:'purchase_order',        name:'Purchase Order (Fuel)',        tab:'stores',   icon:'🧾', desc:'Fuel purchase order with supplier details and approval sign-off',  fields:['description','qty','unit','rate','amount'] },
    { id:'fuel_request',          name:'Fuel Request (Requisition)',   tab:'stores',   icon:'📝', desc:'Fuel requisition raised to Site Admin, with approval workflow',    fields:['description','qty','unit','rate','amount'] },
    { id:'fuel_reconciliation',   name:'Fuel Reconciliation',          tab:'stores',   icon:'📊', desc:'Fuel received vs consumed reconciliation with line items',        fields:['invoice','date','description','quantity','unitPrice','amount'] },
    { id:'interim_payment_certificate', name:'Interim Payment Certificate (IPC)', tab:'production', icon:'🏛️', desc:'Client payment certificate — contract sum, additions, VAT, total claimed, banking',  fields:['section','description','total'] },
    { id:'rate_worksheet',        name:'Rate Worksheet',               tab:'production', icon:'📊', desc:'Per-activity Rate (E/unit) build-up worksheet with cost variables and working steps', headerType:'qms', fields:['step','value','result'] },
    { id:'budget_worksheet',      name:'Budget Worksheet',             tab:'costing',  icon:'📝', desc:'Budget line build-up worksheet with labelled working steps and formulas', headerType:'qms', fields:['step','value','result'] },
    { id:'fuel_disbursement',     name:'Fuel Disbursement',            tab:'stores',   icon:'⛽', desc:'Fuel issued to plant + fuel transfers (in/out), with notes and totals for the period', headerType:'qms', fields:['date','regId','litres','cost','notes'] },
    { id:'stock_balance',         name:'Stock Balance',                tab:'stores',   icon:'⚖️', desc:'Materials & fuel stock — received, issued, balance and value per item', headerType:'qms', fields:['material','received','issued','balance','value'] },
    { id:'drawing_control',       name:'Drawing Control',              tab:'production', icon:'📐', desc:'Measured work reconciled against drawing take-off — remaining quantity and VO warnings', headerType:'qms', fields:['drawingNo','elementId','description','unit','qty','measured','remaining'] },
  ],

  _activeDoc: null,
  _designerData: null,

  renderInto(el) {
    const gs   = ReportSettings.get();
    const org  = DB.organizations?.find(o=>o.id===S.org?.id||o.id===S.user?.orgId)||{};
    const proj = S.project ? (DB.getProject(S.project)||{}) : null;
    const docs = this.registry;
    const saved= this._getSavedSettings();
    const hc   = gs.headerColor||'#2d6a2d';
    const fonts= ['Arial','Helvetica','Calibri','Times New Roman','Georgia','Trebuchet MS','Verdana'];

    const compLogoImg=(gs.logo||org.logo)
      ? `<img src="${gs.logo||org.logo}" style="max-height:56px;max-width:100%;object-fit:contain">`
      : `<div style="text-align:center;color:var(--text3);font-size:10px;font-style:italic">No logo</div>`;
    const clientLogoImg = gs.clientLogo
      ? `<img src="${gs.clientLogo}" style="max-height:56px;max-width:100%;object-fit:contain">`
      : `<div style="text-align:center;color:var(--text3);font-size:10px;font-style:italic">No logo</div>`;

    const presetColors = ['#2d6a2d','#1a56db','#9f1239','#92400e','#374151','#0f766e','#6d28d9','#b45309','#0369a1'];

    el.innerHTML = `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:0;min-height:580px;border:1px solid var(--border);border-radius:10px;overflow:hidden">

      <!-- ╔══ LEFT PANEL — Company Branding + Global Settings ════════╗ -->
      <div style="background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column">

        <!-- Header -->
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,${hc}18,${hc}08)">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${hc}">
            ⚙ Global Settings
          </div>
          <div style="font-size:9.5px;color:var(--text3);margin-top:2px">Applied to all documents</div>
        </div>

        <div style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:14px">

          <!-- Company Logo -->
          <div>
            <div style="font-size:9.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Company Logo</div>
            <div id="dc-comp-logo-prev" style="height:62px;border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface2);margin-bottom:6px">
              ${compLogoImg}
            </div>
            <div style="display:flex;gap:5px">
              <label class="btn ghost sm" style="flex:1;text-align:center;cursor:pointer;font-size:10px;padding:3px 6px">
                📤 Upload
                <input type="file" accept="image/*" style="display:none" onchange="DocumentControl._setLogo(this,'company')">
              </label>
              ${(gs.logo||org.logo)?`<button class="btn ghost sm" style="font-size:10px;color:var(--red);padding:3px 8px" onclick="DocumentControl._clearLogo('company')">✕</button>`:''}
            </div>
            <label style="display:flex;align-items:center;gap:5px;font-size:10px;margin-top:6px;cursor:pointer">
              <input type="checkbox" id="dc-show-logo" ${gs.showLogo?'checked':''}> Show on all documents
            </label>
          </div>

          <!-- Client Logo -->
          <div>
            <div style="font-size:9.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Client Logo <span style="color:var(--text3);font-weight:400;text-transform:none">(Meas. Sheet right header)</span></div>
            <div id="dc-client-logo-prev" style="height:62px;border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface2);margin-bottom:6px">
              ${clientLogoImg}
            </div>
            <div style="display:flex;gap:5px">
              <label class="btn ghost sm" style="flex:1;text-align:center;cursor:pointer;font-size:10px;padding:3px 6px">
                📤 Upload
                <input type="file" accept="image/*" style="display:none" onchange="DocumentControl._setLogo(this,'client')">
              </label>
              ${gs.clientLogo?`<button class="btn ghost sm" style="font-size:10px;color:var(--red);padding:3px 8px" onclick="DocumentControl._clearLogo('client')">✕</button>`:''}
            </div>
          </div>

          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:9.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Branding</div>
            <div class="field" style="margin-bottom:8px">
              <label class="flabel">Company Name on Docs</label>
              <input class="finput" id="dc-compName" value="${gs.companyName||org.name||''}" placeholder="${org.name||'Company name'}">
            </div>
            <div class="field" style="margin-bottom:8px">
              <label class="flabel">Header Colour</label>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
                <input type="color" id="dc-global-hc" value="${hc}" style="width:40px;height:30px;border:none;cursor:pointer;border-radius:4px;flex-shrink:0"
                  oninput="document.getElementById('dc-global-hc-hex').value=this.value;document.querySelectorAll('.dc-hc-preview').forEach(e=>e.style.background=this.value)">
                <input class="finput" id="dc-global-hc-hex" value="${hc}" maxlength="7" style="font-family:monospace;width:80px"
                  oninput="document.getElementById('dc-global-hc').value=this.value;document.querySelectorAll('.dc-hc-preview').forEach(e=>e.style.background=this.value)">
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                ${presetColors.map(col=>`<div class="dc-hc-swatch" onclick="document.getElementById('dc-global-hc').value='${col}';document.getElementById('dc-global-hc-hex').value='${col}';document.querySelectorAll('.dc-hc-preview').forEach(e=>e.style.background='${col}')"
                  style="width:22px;height:22px;background:${col};border-radius:4px;cursor:pointer;border:2px solid ${col===hc?'#fff':'transparent'};flex-shrink:0"
                  title="${col}"></div>`).join('')}
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:8px">
              <div class="field" style="flex:2">
                <label class="flabel">Font</label>
                <select class="fselect" id="dc-global-ff">
                  ${fonts.map(f=>`<option ${gs.fontFamily===f?'selected':''}>${f}</option>`).join('')}
                </select>
              </div>
              <div class="field" style="flex:1">
                <label class="flabel">Size</label>
                <input class="finput" type="number" id="dc-global-fs" value="${gs.fontSize||10}" min="8" max="14">
              </div>
            </div>
          </div>

          <!-- Measurement Sheet Specifics -->
          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:9.5px;font-weight:700;color:${hc};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📏 Measurement Sheet</div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:6px">
              <div class="field">
                <label class="flabel">Doc ID</label>
                <input class="finput" id="dc-docId" value="${gs.docId||'T4_Measurement Sheets'}" style="font-size:10px">
              </div>
              <div class="field">
                <label class="flabel">Revision</label>
                <input class="finput" id="dc-revision" value="${gs.revision||'0'}" style="font-size:10px;max-width:60px">
              </div>
              <div class="field">
                <label class="flabel">Approved By</label>
                <input class="finput" id="dc-approvedBy" value="${gs.approvedBy||'CM'}" style="font-size:10px">
              </div>
              <div class="field">
                <label class="flabel">Date</label>
                <input class="finput" id="dc-effectiveDate" value="${gs.effectiveDate||'Sep-25'}" style="font-size:10px">
              </div>
              <div class="field">
                <label class="flabel">Rows / Page</label>
                <input class="finput" type="number" id="dc-rowsPerPage" value="${gs.rowsPerPage||18}" min="10" max="30" style="font-size:10px">
              </div>
              ${proj?`<div class="field">
                <label class="flabel">Location</label>
                <input class="finput" id="dc-projLoc" value="${proj.location||''}" style="font-size:10px">
              </div>`:''}
            </div>
          </div>

        </div><!-- /scrollable left -->

        <!-- Save button pinned at bottom -->
        <div style="padding:10px 14px;border-top:1px solid var(--border);background:var(--surface)">
          <button class="btn amber" id="btn-dc-save-global" style="width:100%;font-size:12px">
            💾 Save Settings
          </button>
          <div id="dc-save-st" style="font-size:10px;color:var(--green);text-align:center;height:14px;margin-top:4px"></div>
        </div>
      </div><!-- /left panel -->

      <!-- ╔══ RIGHT PANEL — Document Registry ════════════════════════╗ -->
      <div style="display:flex;flex-direction:column">

        <!-- Top bar -->
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface2)">
          <div>
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--amber)">📑 Document Registry</div>
            <div style="font-size:9.5px;color:var(--text3);margin-top:1px">${docs.length} documents · per-document overrides</div>
          </div>
          <button onclick="DocumentControl._newDoc()" class="btn amber sm" style="font-size:10px">＋ New Document</button>
        </div>

        <!-- Header-colour preview stripe -->
        <div class="dc-hc-preview" style="height:3px;background:${hc};transition:background .2s"></div>

        <div style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px">
          ${['plant','labour','daily','sheq','stores','costing'].map(tab=>{
            const tabDocs = docs.filter(d=>d.tab===tab);
            if(!tabDocs.length) return '';
            const tabLabel = {plant:'🚜 Plant & Equipment',labour:'👷 Labour',daily:'📅 Daily Progress',sheq:'⛑ SHEQ',stores:'📦 Stores',costing:'💰 Costing & Commercial'}[tab]||('📄 '+tab);
            return `<div>
              <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);padding:4px 0 6px;border-bottom:1px solid var(--border);margin-bottom:6px">${tabLabel}</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${tabDocs.map(d=>{
                  const s2=this._getDocSettings(d.id);
                  const rs2=ReportSettings.get();
                  const dc_hc=s2.headerColor||rs2.headerColor||'#2d6a2d';
                  const isCustom=!!saved[d.id];
                  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:7px;overflow:hidden;border-left:3px solid ${isCustom?dc_hc:'var(--border)'}">
                    <!-- Row header -->
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;cursor:pointer;background:${this._activeDoc===d.id?'rgba(240,165,0,.06)':'var(--surface)'}"
                      onclick="DocumentControl._toggleDocPanel('${d.id}')">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:16px">${d.icon}</span>
                        <div>
                          <div style="font-size:12px;font-weight:600;color:${this._activeDoc===d.id?'var(--amber)':'var(--text)'}">${d.name}</div>
                          <div style="font-size:9.5px;color:var(--text3);margin-top:1px">${d.desc}</div>
                        </div>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px">
                        ${isCustom?`<span style="font-size:9px;padding:2px 8px;border-radius:8px;background:${dc_hc}22;color:${dc_hc};font-weight:700">● Customised</span>`
                                  :`<span style="font-size:9px;color:var(--text3)">Default</span>`}
                        <span style="font-size:11px;color:var(--text3);transform:rotate(${this._activeDoc===d.id?'90':'0'}deg);display:inline-block;transition:transform .2s">▶</span>
                      </div>
                    </div>
                    <!-- Inline settings panel -->
                    <div id="dcp-${d.id}" style="display:${this._activeDoc===d.id?'block':'none'}">
                      <div style="border-top:1px solid var(--border);padding:12px 14px;background:var(--surface2)">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Header Colour</label>
                            <div style="display:flex;gap:5px;align-items:center">
                              <input type="color" id="dc-hc-${d.id}" value="${dc_hc}" style="width:34px;height:28px;border:none;cursor:pointer;border-radius:3px">
                              <div style="display:flex;gap:3px;flex-wrap:wrap">
                                ${presetColors.slice(0,6).map(col=>`<div onclick="document.getElementById('dc-hc-${d.id}').value='${col}'" style="width:16px;height:16px;background:${col};border-radius:2px;cursor:pointer"></div>`).join('')}
                              </div>
                            </div>
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Font</label>
                            <select id="dc-ff-${d.id}" class="fselect" style="width:100%;font-size:10px">
                              ${fonts.map(f=>`<option ${(s2.fontFamily||'Arial')===f?'selected':''}>${f}</option>`).join('')}
                            </select>
                          </div>
                          <div style="display:flex;gap:6px">
                            <div style="flex:1">
                              <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Size</label>
                              <input type="number" id="dc-fs-${d.id}" value="${s2.fontSize||10}" min="8" max="14" class="finput" style="font-size:10px">
                            </div>
                            <div style="flex:1">
                              <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Paper</label>
                              <select id="dc-ps-${d.id}" class="fselect" style="font-size:10px">
                                ${['A4 Portrait','A4 Landscape','A3 Landscape','Letter'].map(p=>`<option ${(s2.paperSize||'A4 Landscape')===p?'selected':''}>${p}</option>`).join('')}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Doc ID</label>
                            <input type="text" id="dc-di-${d.id}" value="${s2.docId||d.id.toUpperCase()}" class="finput" style="font-size:10px;width:100%">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Revision</label>
                            <input type="text" id="dc-rv-${d.id}" value="${s2.revision||'0'}" class="finput" style="font-size:10px">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Effective Date</label>
                            <input type="text" id="dc-ed-${d.id}" value="${s2.effectiveDate||''}" class="finput" style="font-size:10px" placeholder="e.g. Mar-25">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Header Type</label>
                            <select id="dc-htype-${d.id}" class="fselect" style="width:100%;font-size:10px">
                              ${[['qms','QMS Control Header'],['letterhead','Letterhead'],['simple','Simple Title']].map(([v,l])=>`<option value="${v}" ${(s2.headerType||'qms')===v?'selected':''}>${l}</option>`).join('')}
                            </select>
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Department</label>
                            <input type="text" id="dc-dept-${d.id}" value="${s2.department||''}" class="finput" style="font-size:10px;width:100%" placeholder="e.g. QMS / Commercial">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Approved By</label>
                            <input type="text" id="dc-appr-${d.id}" value="${s2.approvedBy||''}" class="finput" style="font-size:10px;width:100%" placeholder="e.g. MD">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Prepared By</label>
                            <input type="text" id="dc-prep-${d.id}" value="${s2.preparedBy||''}" class="finput" style="font-size:10px;width:100%" placeholder="defaults to current user">
                          </div>
                          <div>
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Checked By</label>
                            <input type="text" id="dc-chk-${d.id}" value="${s2.checkedBy||''}" class="finput" style="font-size:10px;width:100%">
                          </div>
                          <div style="grid-column:1/-1">
                            <label style="font-size:9.5px;color:var(--text3);display:block;margin-bottom:3px">Watermark</label>
                            <input type="text" id="dc-wm-${d.id}" value="${s2.watermark||''}" class="finput" style="width:100%;font-size:10px" placeholder="e.g. CONFIDENTIAL">
                          </div>
                        </div>
                        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
                          <button onclick="DocumentControl._saveDocSettings('${d.id}')" class="btn amber sm" style="font-size:10px">💾 Save</button>
                          <button onclick="DocumentControl._openDesigner('${d.id}')" class="btn ghost sm" style="font-size:10px">✏ Template Designer</button>
                          ${isCustom?`<button onclick="DocumentControl._resetDoc('${d.id}')" class="btn ghost sm" style="font-size:10px;color:var(--red)">↺ Reset to Default</button>`:''}
                          <span id="dc-st-${d.id}" style="font-size:10px;color:var(--green)"></span>
                        </div>
                      </div>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div><!-- /right panel -->
    </div>`;

    // Save global settings handler
    document.getElementById('btn-dc-save-global')?.addEventListener('click', ()=>{
      const gs2=ReportSettings.get();
      gs2.companyName = document.getElementById('dc-compName')?.value||gs2.companyName;
      gs2.headerColor = document.getElementById('dc-global-hc')?.value||gs2.headerColor;
      gs2.fontFamily  = document.getElementById('dc-global-ff')?.value||gs2.fontFamily;
      gs2.fontSize    = parseInt(document.getElementById('dc-global-fs')?.value||10);
      gs2.showLogo    = document.getElementById('dc-show-logo')?.checked??true;
      gs2.docId       = document.getElementById('dc-docId')?.value||gs2.docId;
      gs2.revision    = document.getElementById('dc-revision')?.value||gs2.revision;
      gs2.approvedBy  = document.getElementById('dc-approvedBy')?.value||'CM';
      gs2.effectiveDate=document.getElementById('dc-effectiveDate')?.value||gs2.effectiveDate;
      gs2.rowsPerPage = parseInt(document.getElementById('dc-rowsPerPage')?.value||18);
      if(proj){
        const loc=document.getElementById('dc-projLoc')?.value||'';
        if(loc!==proj.location){
          const upd=Object.assign({},proj,{location:loc});
          DB.save('projects',upd);
          if(!S.isDemo&&S.scriptUrl) GAS.post({action:'save',sheet:'Projects',record:upd}).catch(()=>{});
        }
      }
      ReportSettings.save(gs2);
      const st=document.getElementById('dc-save-st');
      if(st){st.textContent='✅ Saved';setTimeout(()=>st.textContent='',2000);}
      if(typeof Toast!=='undefined') Toast.show('Document settings saved');
    });
  },

  _toggleDocPanel(docId) {
    this._activeDoc = this._activeDoc===docId ? null : docId;
    // Toggle panel visibility without full re-render
    document.querySelectorAll('[id^="dcp-"]').forEach(p=>{
      p.style.display='none';
    });
    document.querySelectorAll('[onclick^="DocumentControl._toggleDocPanel"]').forEach(row=>{
      const id=row.getAttribute('onclick').match(/'([^']+)'/)?.[1];
      const arrow=row.querySelector('span:last-child');
      if(id===this._activeDoc){
        row.style.background='rgba(240,165,0,.06)';
        row.querySelector('div>div:nth-child(2)').style.color='var(--amber)';
        if(arrow) arrow.style.transform='rotate(90deg)';
      } else {
        row.style.background='var(--surface)';
        row.querySelector('div>div:nth-child(2)').style.color='var(--text)';
        if(arrow) arrow.style.transform='rotate(0deg)';
      }
    });
    if(this._activeDoc){
      const panel=document.getElementById('dcp-'+this._activeDoc);
      if(panel) panel.style.display='block';
    }
  },

  _setLogo(input, type) {
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      // Resize/compress so the base64 fits in a Google Sheets cell (~50k char limit),
      // otherwise the logo cannot sync to other users/devices.
      const img=new Image();
      img.onload=()=>{
        // Logo travels to the server inside a JSONP URL parameter, so it must be SMALL
        // (URLs cap ~8000 chars). Resize hard and compress until it fits.
        const tryEncode=(maxPx)=>{
          let w=img.width, h=img.height;
          if(w>h && w>maxPx){ h=Math.round(h*maxPx/w); w=maxPx; }
          else if(h>maxPx){ w=Math.round(w*maxPx/h); h=maxPx; }
          else if(w>maxPx||h>maxPx){ if(w>=h){h=Math.round(h*maxPx/w);w=maxPx;}else{w=Math.round(w*maxPx/h);h=maxPx;} }
          const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
          const cx=cv.getContext('2d');
          cx.fillStyle='#ffffff'; cx.fillRect(0,0,w,h); // flatten transparency for JPEG
          cx.drawImage(img,0,0,w,h);
          let best=cv.toDataURL('image/png');
          for(const q of [0.85,0.7,0.6,0.5,0.4,0.3]){
            const j=cv.toDataURL('image/jpeg',q);
            if(j.length<best.length) best=j;
            if(best.length<=LIMIT) break;
          }
          return best;
        };
        const LIMIT=44000; // fits a Google Sheets cell; sent via real POST (not URL)
        let data=tryEncode(400);
        for(const px of [320,260,220,180,140]){
          if(data.length<=LIMIT) break;
          data=tryEncode(px);
        }
        if(data.length>LIMIT){
          if(typeof toast!=='undefined') toast('Logo too detailed to sync — using a simpler/smaller image is recommended','info');
        }
        const gs2=ReportSettings.get();
        if(type==='company'){
          gs2.logo=data; gs2.showLogo=true;
          const prev=document.getElementById('dc-comp-logo-prev');
          if(prev) prev.innerHTML=`<img src="${data}" style="max-height:56px;max-width:100%;object-fit:contain">`;
        } else {
          gs2.clientLogo=data;
          const prev=document.getElementById('dc-client-logo-prev');
          if(prev) prev.innerHTML=`<img src="${data}" style="max-height:56px;max-width:100%;object-fit:contain">`;
        }
        ReportSettings.save(gs2);
        const _kb=Math.round(data.length/1024);
        if(typeof toast!=='undefined') toast((type==='company'?'Company':'Client')+' logo saved & synced ('+_kb+'KB) — visible to all users','ok');
      };
      img.onerror=()=>{ if(typeof toast!=='undefined') toast('Could not read image file','err'); };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  _clearLogo(type) {
    const gs2=ReportSettings.get();
    if(type==='company') gs2.logo=''; else gs2.clientLogo='';
    ReportSettings.save(gs2);
    const el=document.getElementById('org-section-body');
    if(el) DocumentControl.renderInto(el);
  },

  _resetDoc(docId) {
    if(!confirm('Reset "'+docId+'" to default settings?')) return;
    const s=this._getSavedSettings();
    delete s[docId];
    localStorage.setItem('dc_settings',JSON.stringify(s));
    this._pushGlobal();
    const el=document.getElementById('org-section-body');
    if(el) DocumentControl.renderInto(el);
  },


  _getSavedSettings() {
    // Org-level first (shared across devices/users, via the Organization record),
    // then fall back to this device's localStorage cache.
    try {
      const t = (typeof Prod!=='undefined' && Prod._tplGet) ? Prod._tplGet() : {};
      if (t && t.docSettings && Object.keys(t.docSettings).length) {
        try { localStorage.setItem('dc_settings', JSON.stringify(t.docSettings)); } catch(e){}
        return t.docSettings;
      }
    } catch(e){}
    try { return JSON.parse(localStorage.getItem('dc_settings')||'{}'); } catch(e) { return {}; }
  },

  // Document Control settings persist via the Organization record (Prod._tplSave), which
  // is the reliable org-level channel. The old app_settings write is intentionally removed —
  // it required permissions org users don't have and would sit stuck in the sync queue.
  _pushGlobal() { /* no-op: handled by Prod._tplSave({docSettings}) in _saveDocSettings */ },

  _getDocSettings(docId) {
    return this._getSavedSettings()[docId] || {};
  },

  _saveDocSettings(docId) {
    const doc = this.registry.find(d=>d.id===docId);
    const all = this._getSavedSettings();
    const fields = [...document.querySelectorAll('.dc-field-'+docId)].filter(cb=>cb.checked).map(cb=>cb.dataset.field);
    all[docId] = {
      headerColor: document.getElementById('dc-hc-'+docId)?.value,
      fontFamily:  document.getElementById('dc-ff-'+docId)?.value,
      fontSize:    parseInt(document.getElementById('dc-fs-'+docId)?.value||10),
      paperSize:   document.getElementById('dc-ps-'+docId)?.value,
      watermark:   document.getElementById('dc-wm-'+docId)?.value,
      docId:       document.getElementById('dc-di-'+docId)?.value,
      revision:    document.getElementById('dc-rv-'+docId)?.value,
      effectiveDate: document.getElementById('dc-ed-'+docId)?.value,
      headerType:  document.getElementById('dc-htype-'+docId)?.value,
      department:  document.getElementById('dc-dept-'+docId)?.value,
      approvedBy:  document.getElementById('dc-appr-'+docId)?.value,
      preparedBy:  document.getElementById('dc-prep-'+docId)?.value,
      checkedBy:   document.getElementById('dc-chk-'+docId)?.value,
      logo:        window['_dcLogo_'+docId] || this._getDocSettings(docId).logo || '',
      activeFields: fields,
    };
    localStorage.setItem('dc_settings', JSON.stringify(all));
    // Persist to the Organization record so every device/user sees the same headers.
    try { if(typeof Prod!=='undefined' && Prod._tplSave) Prod._tplSave({ docSettings: all }); } catch(e){}
    this._pushGlobal();
    // Sync to global ReportSettings for fields they share
    const _grs = ReportSettings.get();
    // Sync shared layout settings to global (NOT logo - logos are per-document only)
    // Sync ONLY shared branding to global (colour/font/watermark).
    // Doc ID / Revision / Effective Date / Department / sign-off are PER-DOCUMENT
    // and must never leak from one document into another via the global settings.
    ['headerColor','fontFamily','fontSize','watermark','watermarkOpacity'].forEach(k=>{ if(all[docId][k]) _grs[k]=all[docId][k]; });
    ReportSettings.save(_grs);
    window['_dcLogo_'+docId] = undefined;
    toast('Settings saved for "'+doc.name+'"','ok');
    if(this._selectDoc) this._selectDoc(docId);
  },

  // ── Enhanced Template Designer ─────────────────────────────────────────
  // ── Enhanced Template Designer ────────────────────────────────────────────
  _openDesigner(docId) {
    const doc = this.registry.find(d=>d.id===docId);
    const saved = this._getDocSettings(docId);
    const rows = saved.templateRows||12, cols = saved.templateCols||8;
    this._designerData = this._loadTemplate(docId, rows, cols);
    this._designerDocId = docId;

    // Build full field list with categories
    const allFields = {
      'Project': ['projName','contractNo','startDate','endDate','siteAgent','projectManager'],
      'Plant Record': (doc.fields||[]).filter(f=>['regId','plantType','hrOpening','hrClosing','activityStart','activityEnd','hrsWorked','idleHrs','incWeather','breakdown','weather','agreed'].includes(f)),
      'Costs': (doc.fields||[]).filter(f=>['plantCost','fuelCost','total','rate','rateType'].includes(f)),
      'Fuel': (doc.fields||[]).filter(f=>['litres','odometer','costPerLitre','issuedBy','reconStatus'].includes(f)),
      'Labour': (doc.fields||[]).filter(f=>['workerName','trade','hoursWorked','rate','overtime'].includes(f)),
      'Meta': ['date','pageNo','reportTitle','companyLogo','companyName'],
    };

    const fieldOptGroups = Object.entries(allFields)
      .filter(([,fields])=>fields.length>0)
      .map(([cat,fields])=>`<optgroup label="${cat}">${fields.map(f=>`<option value="${f}">${f}</option>`).join('')}</optgroup>`)
      .join('');

    const html = `
      <div style="display:flex;flex-direction:column;height:calc(100vh - 140px)">
        <!-- Top Bar -->
        <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <label style="font-size:10px;color:var(--text3);white-space:nowrap">Page Size:</label>
            <select id="td-pagesize" onchange="DocumentControl._applyPageSize()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 8px;font-size:11px">
              ${['A4 Portrait','A4 Landscape','A3 Landscape','A3 Portrait','Letter Portrait','Letter Landscape'].map(p=>`<option ${(saved.paperSize||'A4 Landscape')===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <label style="font-size:10px;color:var(--text3);white-space:nowrap">Grid:</label>
            <input id="td-rows" type="number" value="${rows}" min="1" max="60" style="width:44px;padding:3px 6px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:11px">
            <span style="font-size:11px;color:var(--text3)">×</span>
            <input id="td-cols" type="number" value="${cols}" min="1" max="26" style="width:44px;padding:3px 6px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:11px">
            <button onclick="DocumentControl._resizeGrid()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer">Apply</button>
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <label style="font-size:10px;color:var(--text3)">Header Style:</label>
            <select id="td-hdrtype" onchange="DocumentControl._applyHeaderStyle()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 8px;font-size:11px">
              <option value="none">None</option>
              <option value="letterhead">Letterhead</option>
              <option value="table">Table (like Plant Return)</option>
              <option value="banner">Banner</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;margin-left:auto">
            <button onclick="DocumentControl._mergeSelected()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer" title="Merge selected cells">⊞ Merge</button>
            <button onclick="DocumentControl._unmergeSelected()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer" title="Unmerge">⊟ Unmerge</button>
            <button onclick="DocumentControl._addRow()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer">＋ Row</button>
            <button onclick="DocumentControl._addCol()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer">＋ Col</button>
            <button onclick="DocumentControl._deleteRow()" style="background:var(--surface);border:1px solid var(--red);color:var(--red);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer">− Row</button>
            <button onclick="DocumentControl._deleteCol()" style="background:var(--surface);border:1px solid var(--red);color:var(--red);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer">− Col</button>
          </div>
        </div>

        <!-- Main Area -->
        <div style="display:flex;flex:1;overflow:hidden;gap:0">
          <!-- Grid -->
          <div style="flex:1;overflow:auto;padding:12px;background:#e8e8e8">
            <div style="display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,.3);background:#fff" id="td-page-wrap">
              <div id="td-grid" style="display:inline-block"></div>
            </div>
          </div>

          <!-- Right Properties Panel -->
          <div style="width:260px;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto">

            <!-- Cell Properties -->
            <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--amber);letter-spacing:.5px;margin-bottom:8px">Cell Properties</div>
              <div id="td-props"><div style="font-size:10px;color:var(--text3);text-align:center;padding:8px">Click a cell to edit</div></div>
            </div>

            <!-- Field Linking -->
            <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--blue);letter-spacing:.5px;margin-bottom:8px">Field Linking</div>
              <div style="font-size:10px;color:var(--text3);margin-bottom:6px">Link cell to live data field:</div>
              <select id="td-field-link" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 6px;font-size:11px;margin-bottom:6px">
                <option value="">— None —</option>
                <option value="companyLogo">🖼 Company Logo</option>
                ${fieldOptGroups}
              </select>
              <button onclick="DocumentControl._linkField()" style="width:100%;background:var(--blue);border:none;color:#fff;border-radius:4px;padding:4px;font-size:10px;cursor:pointer;margin-bottom:6px">Link to Selected Cell</button>
              <div style="font-size:9px;color:var(--text3)">Logo field: inserts company logo image. Other fields: insert live data value at print time.</div>
            </div>

            <!-- Formula / Calculation -->
            <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--green);letter-spacing:.5px;margin-bottom:8px">Formula</div>
              <div style="font-size:9px;color:var(--text3);margin-bottom:6px">Reference cells with A1 notation or fields:</div>
              <input id="td-formula" placeholder="=SUM(A1:A5) or =field.hrsWorked*rate" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 6px;font-size:10px;font-family:monospace;margin-bottom:6px">
              <button onclick="DocumentControl._applyFormula()" style="width:100%;background:var(--green);border:none;color:#000;border-radius:4px;padding:4px;font-size:10px;cursor:pointer;margin-bottom:4px">Apply Formula</button>
              <div style="font-size:9px;color:var(--text3)">
                <b>Examples:</b><br>
                =A1+B1 (add cells)<br>
                =SUM(A1:A10) (sum range)<br>
                =field.hrsWorked (live field)<br>
                =field.plantCost*1.15 (calc)<br>
                =MAX(A1:A5) / =AVG(B1:B10)
              </div>
            </div>

            <!-- Borders quick set -->
            <div style="padding:10px 12px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text2);letter-spacing:.5px;margin-bottom:8px">Quick Borders</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                ${[['All','all'],['None','none'],['Outside','outside'],['Inside','inside'],['Top','top'],['Bottom','bottom'],['Left','left'],['Right','right'],['Thick All','thick']].map(([l,v])=>`<button onclick="DocumentControl._quickBorder('${v}')" style="padding:4px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:10px;cursor:pointer">${l}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    Modal.open(`Template Designer — ${doc.name}`, html, [
      {label:'Save Template',cls:'amber',fn:()=>DocumentControl._saveTemplate(docId)},
      {label:'Preview',cls:'ghost',fn:()=>DocumentControl._previewTemplate(docId)},
      {label:'Reset Grid',cls:'ghost',fn:()=>{DocumentControl._designerData=DocumentControl._loadTemplate(null,rows,cols);DocumentControl._renderGrid();}},
      {label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)},
    ], {fullscreen:true});
    setTimeout(()=>{ DocumentControl._renderGrid(); DocumentControl._applyPageSize(); }, 50);
  },

  _applyPageSize() {
    const ps = document.getElementById('td-pagesize')?.value||'A4 Landscape';
    const wrap = document.getElementById('td-page-wrap');
    if(!wrap) return;
    const sizes = {
      'A4 Portrait':      {w:'210mm',h:'297mm'},
      'A4 Landscape':     {w:'297mm',h:'210mm'},
      'A3 Landscape':     {w:'420mm',h:'297mm'},
      'A3 Portrait':      {w:'297mm',h:'420mm'},
      'Letter Portrait':  {w:'216mm',h:'279mm'},
      'Letter Landscape': {w:'279mm',h:'216mm'},
    };
    const sz = sizes[ps]||sizes['A4 Landscape'];
    wrap.style.width = sz.w;
    wrap.style.minHeight = sz.h;
    if(this._designerData) this._designerData.paperSize = ps;
  },

  _applyHeaderStyle() {
    const style = document.getElementById('td-hdrtype')?.value;
    if(!style || style==='none') return;
    const g = this._designerData; if(!g) return;
    if(style==='letterhead') {
      // Row 0: Logo (col 0-1 merged) | Company name (col 2-4) | Doc info (col 5-7)
      if(g.cells[0]) {
        g.cells[0][0] = Object.assign(g.cells[0][0]||{},{text:'',field:'companyLogo',bold:false,mergeRight:1,mergeDown:0,bg:'',borderBottom:true,borderTop:false,borderLeft:false,borderRight:false,align:'center',fontSize:11});
        if(g.cells[0][1]) g.cells[0][1].hidden=true;
        g.cells[0][2] = Object.assign(g.cells[0][2]||{},{text:'COMPANY NAME',field:'companyName',bold:true,fontSize:16,mergeRight:2,bg:'',align:'center'});
        if(g.cells[0][3]) g.cells[0][3].hidden=true;
        if(g.cells[0][4]) g.cells[0][4].hidden=true;
        if(g.cells[0][5]) g.cells[0][5] = Object.assign(g.cells[0][5]||{},{text:'DOCUMENT ID\nREVISION: 0\nDATE:',field:'',bold:false,fontSize:8,align:'right',mergeRight:2});
        if(g.cells[0][6]) g.cells[0][6].hidden=true;
        if(g.cells[0][7]) g.cells[0][7].hidden=true;
      }
    } else if(style==='table') {
      // Row 0: header bar spanning all columns
      if(g.cells[0]) {
        const nc=g.cells[0].length;
        g.cells[0][0]=Object.assign(g.cells[0][0]||{},{text:'MONTHLY PLANT RETURN',field:'',bold:true,fontSize:13,mergeRight:nc-1,bg:'#2d6a2d',color:'#fff',align:'center',borderTop:true,borderBottom:true,borderLeft:true,borderRight:true});
        for(let i=1;i<nc;i++) if(g.cells[0][i]) g.cells[0][i].hidden=true;
      }
    } else if(style==='banner') {
      if(g.cells[0]) {
        const nc=g.cells[0].length;
        g.cells[0][0]=Object.assign(g.cells[0][0]||{},{text:'REPORT TITLE',field:'reportTitle',bold:true,fontSize:14,mergeRight:Math.floor(nc/2)-1,bg:'',color:'',align:'left'});
        for(let i=1;i<Math.floor(nc/2);i++) if(g.cells[0][i]) g.cells[0][i].hidden=true;
        const mid=Math.floor(nc/2);
        if(g.cells[0][mid]) g.cells[0][mid]=Object.assign(g.cells[0][mid]||{},{text:'Date:',field:'date',bold:false,fontSize:10,mergeRight:nc-mid-1,align:'right'});
        for(let i=mid+1;i<nc;i++) if(g.cells[0][i]) g.cells[0][i].hidden=true;
      }
    } else if(style==='minimal') {
      if(g.cells[0]) {
        g.cells[0][0]=Object.assign(g.cells[0][0]||{},{text:'',field:'companyLogo',mergeRight:0,align:'left',bg:'',borderBottom:true,borderTop:false,borderLeft:false,borderRight:false});
        if(g.cells[0][g.cells[0].length-1]) g.cells[0][g.cells[0].length-1]=Object.assign(g.cells[0][g.cells[0].length-1]||{},{text:'Page: ',field:'pageNo',align:'right',bold:false,fontSize:9});
      }
    }
    this._renderGrid();
  },

  _renderGrid() {
    const g = this._designerData; if(!g) return;
    const el = document.getElementById('td-grid'); if(!el) return;
    // Column labels A, B, C...
    const colLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let html = '<table style="border-collapse:collapse;table-layout:fixed">';
    html += '<thead><tr><th style="width:24px;background:#ddd;border:1px solid #bbb;font-size:9px;padding:1px 2px;text-align:center;color:#666"></th>';
    g.cells[0].forEach((_,ci)=>{ html+=`<th style="min-width:80px;background:#ddd;border:1px solid #bbb;font-size:9px;padding:2px 4px;text-align:center;color:#333;font-weight:600">${colLabels[ci]||ci}</th>`; });
    html += '</tr></thead><tbody>';
    g.cells.forEach((row,r)=>{
      html += `<tr><td style="background:#ddd;border:1px solid #bbb;font-size:9px;padding:1px 4px;text-align:center;color:#666;font-weight:600;white-space:nowrap">${r+1}</td>`;
      row.forEach((cell,c)=>{
        if(cell.hidden) return;
        const rs=cell.mergeDown>0?` rowspan="${cell.mergeDown+1}"`:'';
        const cs=cell.mergeRight>0?` colspan="${cell.mergeRight+1}"`:'' ;
        const isSel=g.multiSelect&&g.multiSelect.some(s=>s[0]===r&&s[1]===c);
        const isActive=g.selectedR===r&&g.selectedC===c;
        const selStyle=isActive?'outline:2px solid var(--blue);outline-offset:-1px;':isSel?'outline:1px dashed var(--blue);outline-offset:-1px;':'';
        const bg=cell.bg||(isActive?'rgba(59,130,246,.1)':isSel?'rgba(59,130,246,.05)':'#fff');
        const bTop=cell.borderTop?'1px solid #888':'1px solid #e0e0e0';
        const bBot=cell.borderBottom?'1px solid #888':'1px solid #e0e0e0';
        const bLft=cell.borderLeft?'1px solid #888':'1px solid #e0e0e0';
        const bRgt=cell.borderRight?'1px solid #888':'1px solid #e0e0e0';
        const fieldBadge=cell.field?`<span style="font-size:7px;background:#1a56db;color:#fff;border-radius:2px;padding:0 3px;float:right;line-height:1.6">${cell.field}</span>`:'';
        const formulaBadge=cell.formula?`<span style="font-size:7px;background:#16a34a;color:#fff;border-radius:2px;padding:0 3px;float:right;line-height:1.6">fx</span>`:'';
        const style=`padding:3px 5px;min-width:80px;min-height:22px;cursor:pointer;background:${bg};font-weight:${cell.bold?'bold':'normal'};font-style:${cell.italic?'italic':'normal'};text-align:${cell.align||'left'};color:${cell.color||'#000'};font-size:${cell.fontSize||11}px;border-top:${bTop};border-bottom:${bBot};border-left:${bLft};border-right:${bRgt};vertical-align:top;${selStyle}`;
        const display=cell.field==='companyLogo'?'<div style="font-size:9px;color:#888;font-style:italic">[LOGO]</div>':(cell.text||'');
        html+=`<td${rs}${cs} style="${style}" onclick="DocumentControl._cellClick(${r},${c},event)" oncontextmenu="DocumentControl._cellCtx(${r},${c},event)">${fieldBadge}${formulaBadge}${display}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  },

  _renderProps() {
    const g = this._designerData;
    if(!g||g.selectedR<0) return;
    const r=g.selectedR, cc=g.selectedC;
    const cell = g.cells[r]?.[cc]; if(!cell) return;
    const pp = document.getElementById('td-props'); if(!pp) return;
    const fval = document.getElementById('td-formula');
    if(fval) fval.value = cell.formula||'';
    pp.innerHTML = `
      <div style="margin-bottom:5px"><label style="font-size:9px;color:var(--text3);display:block;margin-bottom:2px">Text Content</label>
        <textarea id="cp-text" rows="2" oninput="DocumentControl._cellProp('text',this.value)" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:3px 6px;font-size:11px;resize:vertical">${cell.text||''}</textarea></div>
      <div style="display:flex;gap:3px;margin-bottom:5px">
        <button onclick="DocumentControl._cellProp('bold',!DocumentControl._getCell().bold)" style="flex:1;padding:3px;background:${cell.bold?'var(--amber)':'var(--surface2)'};border:1px solid var(--border);color:${cell.bold?'#000':'var(--text)'};border-radius:3px;font-size:11px;font-weight:700;cursor:pointer">B</button>
        <button onclick="DocumentControl._cellProp('italic',!DocumentControl._getCell().italic)" style="flex:1;padding:3px;background:${cell.italic?'var(--amber)':'var(--surface2)'};border:1px solid var(--border);color:${cell.italic?'#000':'var(--text)'};border-radius:3px;font-size:11px;font-style:italic;cursor:pointer">I</button>
        ${['left','center','right'].map(a=>`<button onclick="DocumentControl._cellProp('align','${a}')" style="flex:1;padding:3px;background:${cell.align===a?'var(--amber)':'var(--surface2)'};border:1px solid var(--border);color:${cell.align===a?'#000':'var(--text)'};border-radius:3px;font-size:9px;cursor:pointer">${a==='left'?'◀':a==='center'?'◆':'▶'}</button>`).join('')}
      </div>
      <div style="display:flex;gap:4px;align-items:center;margin-bottom:5px">
        <label style="font-size:9px;color:var(--text3);white-space:nowrap">Size</label>
        <input type="number" value="${cell.fontSize||11}" min="7" max="24" oninput="DocumentControl._cellProp('fontSize',+this.value)" style="width:46px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:10px">
        <label style="font-size:9px;color:var(--text3)">BG</label>
        <input type="color" value="${cell.bg||'#ffffff'}" oninput="DocumentControl._cellProp('bg',this.value)" style="width:26px;height:22px;border:1px solid var(--border);cursor:pointer;border-radius:3px;padding:1px">
        <label style="font-size:9px;color:var(--text3)">FG</label>
        <input type="color" value="${cell.color||'#000000'}" oninput="DocumentControl._cellProp('color',this.value)" style="width:26px;height:22px;border:1px solid var(--border);cursor:pointer;border-radius:3px;padding:1px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px">
        ${['borderTop','borderBottom','borderLeft','borderRight'].map(b=>`<label style="display:flex;align-items:center;gap:3px;font-size:9px;cursor:pointer;padding:2px 4px;background:var(--surface2);border-radius:3px"><input type="checkbox" ${cell[b]!==false?'checked':''} onchange="DocumentControl._cellProp('${b}',this.checked)"> ${b.replace('border','').replace(/([A-Z])/g,' $1')}</label>`).join('')}
      </div>
      ${cell.field?`<div style="padding:4px 6px;background:rgba(26,86,219,.1);border-radius:4px;font-size:9px;color:var(--blue);margin-bottom:4px">Linked: <b>${cell.field}</b> <button onclick="DocumentControl._cellProp('field','')" style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:9px">× remove</button></div>`:''}
      ${cell.formula?`<div style="padding:4px 6px;background:rgba(22,163,74,.1);border-radius:4px;font-size:9px;color:var(--green);margin-bottom:4px">Formula: <code>${cell.formula}</code> <button onclick="DocumentControl._cellProp('formula','')" style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:9px">× remove</button></div>`:''}
      <div style="font-size:9px;color:var(--text3)">Cell: <b style="color:var(--amber)">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[cc]||cc}${r+1}</b>${cell.mergeRight>0||cell.mergeDown>0?` (merged ${cell.mergeRight>0?cell.mergeRight+1+'C':''}${cell.mergeDown>0?cell.mergeDown+1+'R':''})`:''}</div>`;
  },

  _getCell() {
    const g=this._designerData;
    return g&&g.selectedR>=0?g.cells[g.selectedR]?.[g.selectedC]||{}:{};
  },

  _applyFormula() {
    const f = document.getElementById('td-formula')?.value?.trim();
    if(!f) return;
    this._cellProp('formula', f);
    toast('Formula set','ok');
  },

  _quickBorder(type) {
    const g=this._designerData; if(!g) return;
    const sel=g.multiSelect.length?g.multiSelect:[[g.selectedR,g.selectedC]];
    const minR=Math.min(...sel.map(s=>s[0])),maxR=Math.max(...sel.map(s=>s[0]));
    const minC=Math.min(...sel.map(s=>s[1])),maxC=Math.max(...sel.map(s=>s[1]));
    sel.forEach(([r,c])=>{
      const cell=g.cells[r]?.[c]; if(!cell) return;
      if(type==='all'){cell.borderTop=cell.borderBottom=cell.borderLeft=cell.borderRight=true;}
      else if(type==='none'){cell.borderTop=cell.borderBottom=cell.borderLeft=cell.borderRight=false;}
      else if(type==='outside'){
        cell.borderTop=r===minR; cell.borderBottom=r===maxR;
        cell.borderLeft=c===minC; cell.borderRight=c===maxC;
      }
      else if(type==='inside'){
        cell.borderTop=r>minR; cell.borderBottom=r<maxR;
        cell.borderLeft=c>minC; cell.borderRight=c<maxC;
      }
      else if(type==='thick'){cell.borderTop=cell.borderBottom=cell.borderLeft=cell.borderRight=true;}
      else { cell['border'+type.charAt(0).toUpperCase()+type.slice(1)]=true; }
    });
    this._renderGrid();
  },


  _loadTemplate(docId, rows, cols) {
    const saved = this._getDocSettings(docId).template;
    if(saved) return saved;
    const grid = [];
    for(let r=0; r<rows; r++){
      const row = [];
      for(let c=0; c<cols; c++){
        row.push({text:'',field:'',bold:false,italic:false,align:'left',bg:'',color:'',fontSize:'',borderTop:true,borderBottom:true,borderLeft:true,borderRight:true,merged:false,mergeRight:0,mergeDown:0,hidden:false});
      }
      grid.push(row);
    }
    return {rows,cols,cells:grid,selectedR:-1,selectedC:-1,multiSelect:[]};
  },

  _renderGrid() {
    const g = this._designerData; if(!g) return;
    const el = document.getElementById('td-grid'); if(!el) return;
    let html = '<table style="border-collapse:collapse;min-width:600px">';
    // Column width row
    html += '<colgroup>'+g.cells[0].map(()=>'<col style="min-width:80px">').join('')+'</colgroup>';
    g.cells.forEach((row,r)=>{
      html += '<tr>';
      row.forEach((cell,c)=>{
        if(cell.hidden){return;}
        const rs=cell.mergeDown>0?` rowspan="${cell.mergeDown+1}"`:'' ;
        const cs=cell.mergeRight>0?` colspan="${cell.mergeRight+1}"`:'' ;
        const isSel=g.multiSelect.some(s=>s[0]===r&&s[1]===c)||(g.selectedR===r&&g.selectedC===c);
        const bg=isSel?'rgba(59,130,246,.25)':(cell.bg||'transparent');
        const borders=`border-top:${cell.borderTop?'1px solid #555':'none'};border-bottom:${cell.borderBottom?'1px solid #555':'none'};border-left:${cell.borderLeft?'1px solid #555':'none'};border-right:${cell.borderRight?'1px solid #555':'none'}`;
        const style=`padding:4px 6px;min-width:80px;min-height:24px;cursor:pointer;background:${bg};font-weight:${cell.bold?'bold':'normal'};font-style:${cell.italic?'italic':'normal'};text-align:${cell.align};color:${cell.color||'inherit'};font-size:${cell.fontSize||'11'}px;${borders}${isSel?';outline:2px solid var(--blue)':''}`;
        const linkedLabel=cell.field?`<span style="font-size:8px;color:#888;display:block">[${cell.field}]</span>`:'';
        html+=`<td${rs}${cs} style="${style}" onclick="DocumentControl._cellClick(${r},${c},event)" oncontextmenu="DocumentControl._cellCtx(${r},${c},event)">${cell.text||''}${linkedLabel}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    el.innerHTML = html;
  },

  _cellClick(r, c, e) {
    const g = this._designerData;
    if(e.shiftKey && g.selectedR>=0) {
      g.multiSelect = g.multiSelect.filter(s=>!(s[0]===r&&s[1]===c));
      g.multiSelect.push([r,c]);
    } else {
      g.selectedR=r; g.selectedC=c; g.multiSelect=[[r,c]];
    }
    this._renderGrid();
    this._renderProps();
  },

  _renderProps() {
    const g = this._designerData;
    if(!g||g.selectedR<0) return;
    const cell = g.cells[g.selectedR]?.[g.selectedC]; if(!cell) return;
    const pp = document.getElementById('td-props'); if(!pp) return;
    pp.innerHTML = `
      <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:2px">Text Content</label>
        <input id="cp-text" value="${cell.text||''}" oninput="DocumentControl._cellProp('text',this.value)" style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:3px 6px;font-size:11px"></div>
      <div style="display:flex;gap:4px">
        <button onclick="DocumentControl._cellProp('bold',!DocumentControl._designerData.cells[DocumentControl._designerData.selectedR][DocumentControl._designerData.selectedC].bold)" style="flex:1;padding:3px;background:${cell.bold?'var(--amber)':'var(--surface)'};border:1px solid var(--border);color:${cell.bold?'#000':'var(--text)'};border-radius:3px;font-size:11px;font-weight:700;cursor:pointer">B</button>
        <button onclick="DocumentControl._cellProp('italic',!DocumentControl._designerData.cells[DocumentControl._designerData.selectedR][DocumentControl._designerData.selectedC].italic)" style="flex:1;padding:3px;background:${cell.italic?'var(--amber)':'var(--surface)'};border:1px solid var(--border);color:${cell.italic?'#000':'var(--text)'};border-radius:3px;font-size:11px;font-style:italic;cursor:pointer">I</button>
        ${['left','center','right'].map(a=>`<button onclick="DocumentControl._cellProp('align','${a}')" style="flex:1;padding:3px;background:${cell.align===a?'var(--amber)':'var(--surface)'};border:1px solid var(--border);color:${cell.align===a?'#000':'var(--text)'};border-radius:3px;font-size:9px;cursor:pointer">${a==='left'?'◀':a==='center'?'▼':'▶'}</button>`).join('')}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <label style="font-size:10px;color:var(--text3);white-space:nowrap">Font size</label>
        <input type="number" id="cp-fs" value="${cell.fontSize||11}" min="7" max="20" oninput="DocumentControl._cellProp('fontSize',this.value)" style="width:50px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 4px;font-size:11px">
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <label style="font-size:10px;color:var(--text3)">BG</label>
        <input type="color" value="${cell.bg||'#ffffff'}" oninput="DocumentControl._cellProp('bg',this.value)" style="width:28px;height:22px;border:none;cursor:pointer">
        <label style="font-size:10px;color:var(--text3)">Text</label>
        <input type="color" value="${cell.color||'#000000'}" oninput="DocumentControl._cellProp('color',this.value)" style="width:28px;height:22px;border:none;cursor:pointer">
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">Borders:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
        ${['borderTop','borderBottom','borderLeft','borderRight'].map(b=>`<label style="display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer"><input type="checkbox" ${cell[b]?'checked':''} onchange="DocumentControl._cellProp('${b}',this.checked)"> ${b.replace('border','')}</label>`).join('')}
      </div>
      ${cell.field?`<div style="font-size:10px;color:var(--green)">Linked: ${cell.field} <button onclick="DocumentControl._cellProp('field','')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:10px">× remove</button></div>`:''}`;
  },

  _cellProp(prop, val) {
    const g = this._designerData; if(!g||g.selectedR<0) return;
    // Apply to all selected cells
    (g.multiSelect.length ? g.multiSelect : [[g.selectedR,g.selectedC]]).forEach(([r,c])=>{
      if(g.cells[r]?.[c]) g.cells[r][c][prop] = val;
    });
    this._renderGrid();
    this._renderProps();
  },

  _mergeSelected() {
    const g = this._designerData; if(!g||g.multiSelect.length<2) { alert('Select 2+ cells to merge'); return; }
    const rows=g.multiSelect.map(s=>s[0]),cols=g.multiSelect.map(s=>s[1]);
    const minR=Math.min(...rows),maxR=Math.max(...rows),minC=Math.min(...cols),maxC=Math.max(...cols);
    g.cells[minR][minC].mergeRight=maxC-minC;
    g.cells[minR][minC].mergeDown=maxR-minR;
    for(let r=minR;r<=maxR;r++) for(let c=minC;c<=maxC;c++) if(!(r===minR&&c===minC)) g.cells[r][c].hidden=true;
    this._renderGrid();
  },

  _unmergeSelected() {
    const g = this._designerData; if(!g||g.selectedR<0) return;
    const r=g.selectedR,c=g.selectedC;
    const cell=g.cells[r][c];
    for(let dr=0;dr<=cell.mergeDown;dr++) for(let dc=0;dc<=cell.mergeRight;dc++) { if(g.cells[r+dr]?.[c+dc]) g.cells[r+dr][c+dc].hidden=false; }
    cell.mergeRight=0; cell.mergeDown=0;
    this._renderGrid();
  },

  _addRow() {
    const g=this._designerData;
    g.cells.push(g.cells[0].map(()=>({text:'',field:'',bold:false,italic:false,align:'left',bg:'',color:'',fontSize:'',borderTop:true,borderBottom:true,borderLeft:true,borderRight:true,merged:false,mergeRight:0,mergeDown:0,hidden:false})));
    g.rows++; this._renderGrid();
  },

  _addCol() {
    const g=this._designerData;
    g.cells.forEach(row=>row.push({text:'',field:'',bold:false,italic:false,align:'left',bg:'',color:'',fontSize:'',borderTop:true,borderBottom:true,borderLeft:true,borderRight:true,merged:false,mergeRight:0,mergeDown:0,hidden:false}));
    g.cols++; this._renderGrid();
  },

  _deleteRow() {
    const g=this._designerData; if(g.cells.length<=1) return;
    const r=g.selectedR>=0?g.selectedR:g.cells.length-1;
    g.cells.splice(r,1); g.rows--; g.selectedR=-1; this._renderGrid();
  },

  _deleteCol() {
    const g=this._designerData; if(!g.cells[0]||g.cells[0].length<=1) return;
    const col=g.selectedC>=0?g.selectedC:g.cells[0].length-1;
    g.cells.forEach(row=>row.splice(col,1)); g.cols--; g.selectedC=-1; this._renderGrid();
  },

  _resizeGrid() {
    const r=parseInt(document.getElementById('td-rows')?.value||12);
    const cc=parseInt(document.getElementById('td-cols')?.value||8);
    this._designerData = this._loadTemplate(null, r, cc);
    this._designerData.rows=r; this._designerData.cols=cc;
    this._renderGrid();
  },

  _linkField() {
    const g=this._designerData; if(!g||g.selectedR<0) return;
    const f=document.getElementById('td-field-link')?.value||'';
    this._cellProp('field', f);
    toast('Field linked: '+f,'ok');
  },

  _cellCtx(r, c, e) {
    e.preventDefault();
    this._cellClick(r, c, e);
    // Simple context menu
    const m=document.createElement('div');
    m.style.cssText=`position:fixed;top:${e.clientY}px;left:${e.clientX}px;background:var(--surface);border:1px solid var(--border);border-radius:6px;z-index:9999;min-width:160px;padding:4px`;
    m.innerHTML=['Merge with selection','Unmerge','Bold','Italic','Clear cell','Add row below','Add col right'].map(a=>`<div onclick="DocumentControl._ctxAction('${a}',${r},${c});this.closest('[style*=position]').remove()" style="padding:6px 12px;font-size:11px;cursor:pointer;border-radius:4px" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">${a}</div>`).join('');
    document.body.appendChild(m);
    setTimeout(()=>document.addEventListener('click',()=>m.remove(),{once:true}),10);
  },

  _ctxAction(action, r, c) {
    if(action==='Merge with selection') this._mergeSelected();
    if(action==='Unmerge') this._unmergeSelected();
    if(action==='Bold') this._cellProp('bold',!this._designerData.cells[r][c].bold);
    if(action==='Italic') this._cellProp('italic',!this._designerData.cells[r][c].italic);
    if(action==='Clear cell') { this._cellProp('text',''); this._cellProp('field',''); }
    if(action==='Add row below') this._addRow();
    if(action==='Add col right') this._addCol();
  },

  _saveTemplate(docId) {
    const all=this._getSavedSettings();
    all[docId]=all[docId]||{};
    all[docId].template=this._designerData;
    all[docId].templateRows=this._designerData.rows;
    all[docId].templateCols=this._designerData.cols;
    localStorage.setItem('dc_settings',JSON.stringify(all));
    this._pushGlobal();
    toast('Template saved','ok');
    Modal.close();
  },

  _previewTemplate(docId) {
    const g=this._designerData; if(!g) return;
    const s=this._getDocSettings(docId)||{};
    let html='<table style="border-collapse:collapse;width:100%;font-family:'+( s.fontFamily||'Arial')+';font-size:'+(s.fontSize||10)+'px">';
    g.cells.forEach(row=>{
      html+='<tr>';
      row.forEach(cell=>{
        if(cell.hidden) return;
        const rs=cell.mergeDown>0?` rowspan="${cell.mergeDown+1}"`:'' ;
        const cs=cell.mergeRight>0?` colspan="${cell.mergeRight+1}"`:'' ;
        html+=`<td${rs}${cs} style="padding:4px 6px;background:${cell.bg||'transparent'};font-weight:${cell.bold?'700':'400'};font-style:${cell.italic?'italic':'normal'};text-align:${cell.align};color:${cell.color||'#000'};font-size:${cell.fontSize||s.fontSize||10}px;border-top:${cell.borderTop?'1px solid #333':'none'};border-bottom:${cell.borderBottom?'1px solid #333':'none'};border-left:${cell.borderLeft?'1px solid #333':'none'};border-right:${cell.borderRight?'1px solid #333':'none'}">${cell.text||''}${cell.field?'<span style="font-size:8px;color:#888"> ['+cell.field+']</span>':''}</td>`;
      });
      html+='</tr>';
    });
    html+='</table>';
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Preview</title><style>body{font-family:'+( s.fontFamily||'Arial')+';margin:20px;font-size:'+(s.fontSize||10)+'px}</style></head><body>'+ReportSettings.header('Project Name','Contract No','','','REG-001',{}||{},0,0,'Preview')+html+'</body></html>');
  },

  _newDoc() {
    const name=prompt('Document name (e.g. "Payment Certificate"):');
    if(!name||!name.trim()) return;
    const cats=[['costing','Costing & Commercial'],['plant','Plant & Equipment'],['labour','Labour'],['daily','Daily Progress'],['sheq','SHEQ'],['stores','Stores']];
    let tab='costing';
    const pick=prompt('Category — type a number:\n'+cats.map((c,i)=>(i+1)+'. '+c[1]).join('\n'),'1');
    const idx=parseInt(pick)-1; if(idx>=0&&idx<cats.length) tab=cats[idx][0];
    const id='custom_'+Date.now();
    const autoDocId=name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)+'-01';
    this.registry.push({id,name:name.trim(),tab,icon:'📄',desc:'Custom document — configure its QMS header below',fields:['date','description','amount']});
    const all=this._getSavedSettings(); all[id]=Object.assign({docId:autoDocId,revision:'0',headerType:'qms'},all[id]||{});
    localStorage.setItem('dc_settings',JSON.stringify(all));
    const host=document.querySelector('#app-settings-body')||document.querySelector('[data-appsub="doc"]')||document.getElementById('sub-body');
    if(host) this.renderInto(host);
    toast('“'+name.trim()+'” added — set its header details, then Save','ok');
    setTimeout(()=>this._selectDoc&&this._selectDoc(id),50);
  },
};


// ════════════════════════════════════════════════════════════════
// ⚙ REPORT SETTINGS
// ════════════════════════════════════════════════════════════════
const ReportSettings = {
  _key: 'reportSettings',

  get() {
    try {
      const raw = localStorage.getItem(this._key);
      if(!raw) return this.defaults();
      const data = JSON.parse(raw);
      const cur = this._curOrg();
      // never serve another organization's branding
      if(cur && data.orgId && data.orgId !== cur){ localStorage.removeItem(this._key); return this.defaults(); }
      return data;
    } catch(e) { return this.defaults(); }
  },
  _curOrg(){ try{ return (typeof _orgId==='function'?_orgId():'') || (typeof S!=='undefined' && ((S.org&&S.org.id)||(S.user&&S.user.orgId))) || ''; }catch(e){ return ''; } },

  save(data) {
    try{ data.orgId = this._curOrg(); }catch(_){}
    localStorage.setItem(this._key, JSON.stringify(data));
    // Push globally so all devices/users share it. Logos can be very large
    // base64 strings that exceed a Google Sheets cell limit, so they are synced
    // via the Organizations sheet instead — we strip them from this payload.
    try {
      if(typeof S!=='undefined' && !S.isDemo && S.scriptUrl && typeof GAS!=='undefined') {
        const _slim = Object.assign({}, data);
        delete _slim.logo; delete _slim.clientLogo; delete _slim.watermark; delete _slim.savedTemplates;
        const _org = this._curOrg();
        GAS.post({action:'save', sheet:'AppSettings', record:{
          // id must be per-organization: a shared 'reportSettings' id makes two orgs
          // collide on the same row (upsert is on_conflict=id). Read-back matches on `key`.
          id:'reportSettings'+(_org?('-'+_org):''), key:'reportSettings', value:JSON.stringify(_slim),
          orgId:_org,   // REQUIRED — RLS policy checks "orgId" = current_org()
          updatedBy:(S.user&&S.user.id)||'', updatedAt:new Date().toISOString()
        }}).catch(()=>{});
        // Sync the company logo globally via the Organizations record so EVERY user sees it
        if(data.logo!==undefined){
          const _oid=(S.org&&S.org.id)||(S.user&&S.user.orgId)||'';
          let _o = (_oid && DB.getOrg) ? DB.getOrg(_oid) : null;
          // Fall back to the first known organization if no orgId is resolvable
          if(!_o && DB.organizations && DB.organizations.length) _o = DB.organizations[0];
          if(_o){
            _o.logo = data.logo;
            // keep in-memory copy current so it shows immediately everywhere
            const _ix = (DB.organizations||[]).findIndex(o=>o.id===_o.id);
            if(_ix>=0) DB.organizations[_ix]=_o;
            GAS.postBig({action:'save',sheet:'Organizations',record:_o});
          }
        }
        if(data.clientLogo!==undefined){
          const _oid2=(S.org&&S.org.id)||(S.user&&S.user.orgId)||'';
          let _o2=(_oid2&&DB.getOrg)?DB.getOrg(_oid2):null;
          if(!_o2 && DB.organizations && DB.organizations.length) _o2=DB.organizations[0];
          if(_o2){ _o2.clientLogo=data.clientLogo; GAS.postBig({action:'save',sheet:'Organizations',record:_o2}); }
        }
      }
    } catch(_){}
  },

  defaults() {
    return {
      logo: '',
      logoAlign: 'left',
      watermark: '',
      watermarkOpacity: 0.08,
      fontFamily: 'Arial',
      fontSize: 10,
      headerColor: '#2d6a2d',
      companyName: 'AFRI CIVILS',
      docId: 'T4_MONTHLY PLANT RETURN',
      revision: '0',
      effectiveDate: 'Sep-24',
      address: '',
      showLogo: true,
      showWatermark: false,
      clientLogo: '',
      savedTemplates: {}
    };
  },

  open() {
    const s = this.get();
    const alignBtn = (val, label) =>
      `<button onclick="document.querySelectorAll('.la-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.getElementById('rs-logoAlign').value='${val}'" ` +
      `class="la-btn ${s.logoAlign===val?'active':''}" style="padding:4px 12px;border:1px solid var(--border);background:${s.logoAlign===val?'var(--amber)':'var(--surface2)'};color:${s.logoAlign===val?'#000':'var(--text)'};border-radius:4px;cursor:pointer;font-size:11px">${label}</button>`;

    const templateOptions = Object.keys(s.savedTemplates||{}).map(k =>
      `<option value="${k}">${k}</option>`).join('');

    const html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:4px">
        <!-- LEFT COLUMN -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-family:var(--fh);font-size:12px;font-weight:700;color:var(--blue);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🖼 Logo</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div id="rs-logo-preview" style="height:60px;border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface2)">
                ${s.logo ? `<img src="${s.logo}" style="max-height:56px;max-width:100%;object-fit:contain">` : '<span style="color:var(--text3);font-size:11px">No logo uploaded</span>'}
              </div>
              <input type="file" id="rs-logoFile" accept="image/*" onchange="ReportSettings._previewLogo(this)" style="font-size:11px;color:var(--text2)">
              <div style="display:flex;gap:6px;align-items:center">
                <span style="font-size:10px;color:var(--text3)">Align:</span>
                ${alignBtn('left','◀ Left')}${alignBtn('center','▼ Centre')}${alignBtn('right','Right ▶')}
                <input type="hidden" id="rs-logoAlign" value="${s.logoAlign}">
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer">
                <input type="checkbox" id="rs-showLogo" ${s.showLogo?'checked':''}>
                Show logo on printed reports
              </label>
              ${s.logo ? `<button onclick="ReportSettings._clearLogo()" style="font-size:10px;color:var(--red);background:none;border:1px solid var(--red);border-radius:4px;padding:2px 8px;cursor:pointer">🗑 Remove Logo</button>` : ''}
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-family:var(--fh);font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">💧 Watermark</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Watermark Text (e.g. CONFIDENTIAL)</label>
                <input id="rs-watermark" value="${s.watermark||''}" class="finput" style="width:100%" placeholder="Leave blank to disable"></div>
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Opacity: <span id="rs-opLabel">${Math.round((s.watermarkOpacity||0.08)*100)}%</span></label>
                <input type="range" id="rs-watermarkOpacity" min="2" max="30" value="${Math.round((s.watermarkOpacity||0.08)*100)}" oninput="document.getElementById('rs-opLabel').textContent=this.value+'%'" style="width:100%"></div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-family:var(--fh);font-size:12px;font-weight:700;color:var(--orange);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🎨 Appearance</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Header Colour</label>
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="color" id="rs-headerColor" value="${s.headerColor||'#2d6a2d'}" style="width:40px;height:28px;border:none;cursor:pointer">
                  <span id="rs-colorLabel" style="font-size:11px;font-family:monospace">${s.headerColor||'#2d6a2d'}</span>
                </div>
                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                  ${['#2d6a2d','#1a56db','#9f1239','#92400e','#1e3a5f','#374151'].map(col=>
                    `<div onclick="document.getElementById('rs-headerColor').value='${col}';document.getElementById('rs-colorLabel').textContent='${col}'" style="width:24px;height:24px;background:${col};border-radius:4px;cursor:pointer;border:2px solid ${col===s.headerColor?'#fff':'transparent'}"></div>`
                  ).join('')}
                </div>
              </div>
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Font Family</label>
                <select id="rs-fontFamily" class="finput" style="width:100%">
                  ${['Arial','Calibri','Times New Roman','Georgia','Trebuchet MS','Helvetica'].map(f=>
                    `<option ${s.fontFamily===f?'selected':''}>${f}</option>`).join('')}
                </select>
              </div>
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Font Size (px)</label>
                <input type="number" id="rs-fontSize" value="${s.fontSize||10}" min="8" max="14" class="finput" style="width:80px">
              </div>
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-family:var(--fh);font-size:12px;font-weight:700;color:var(--green);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">📋 Document Info</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Document ID</label>
                <input id="rs-docId" value="${s.docId||'T4_MONTHLY PLANT RETURN'}" class="finput" style="width:100%"></div>
              <div style="display:flex;gap:8px">
                <div style="flex:1"><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Revision</label>
                  <input id="rs-revision" value="${s.revision||'0'}" class="finput"></div>
                <div style="flex:2"><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Effective Date</label>
                  <input id="rs-effectiveDate" value="${s.effectiveDate||'Sep-24'}" class="finput"></div>
              </div>
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-family:var(--fh);font-size:12px;font-weight:700;color:#a78bfa;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">💾 Templates</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;gap:6px">
                <input id="rs-tplName" placeholder="Template name..." class="finput" style="flex:1">
                <button onclick="ReportSettings._saveTemplate()" style="background:var(--amber);color:#000;border:none;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap">💾 Save</button>
              </div>
              ${templateOptions ? `<div style="display:flex;gap:6px">
                <select id="rs-tplLoad" class="finput" style="flex:1"><option value="">Load template...</option>${templateOptions}</select>
                <button onclick="ReportSettings._loadTemplate()" style="background:var(--blue);color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer">Load</button>
                <button onclick="ReportSettings._deleteTemplate()" style="background:var(--surface2);color:var(--red);border:1px solid var(--red);border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">🗑</button>
              </div>` : '<div style="font-size:10px;color:var(--text3)">No saved templates yet</div>'}
            </div>
          </div>
        </div>
      </div>`;

    Modal.open('⚙ Report Settings', html, [
      {label:'💾 Save Settings',cls:'amber',fn:()=>ReportSettings._save()},
      {label:'Reset Defaults',cls:'ghost',fn:()=>{if(confirm('Reset all settings?')){ReportSettings.save(ReportSettings.defaults());Modal.close();}}},
      {label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)}
    ], {wide:true});
  },

  _previewLogo(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('rs-logo-preview');
      if(prev) prev.innerHTML = `<img src="${e.target.result}" style="max-height:56px;max-width:100%;object-fit:contain">`;
      // Store temporarily
      window._rsTempLogo = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _clearLogo() {
    window._rsTempLogo = '';
    const prev = document.getElementById('rs-logo-preview');
    if(prev) prev.innerHTML = '<span style="color:var(--text3);font-size:11px">No logo uploaded</span>';
  },

  _save() {
    const s = this.get();
    s.logoAlign = document.getElementById('rs-logoAlign')?.value || 'left';
    s.showLogo = document.getElementById('rs-showLogo')?.checked ?? true;
    s.watermark = document.getElementById('rs-watermark')?.value || '';
    s.watermarkOpacity = (parseInt(document.getElementById('rs-watermarkOpacity')?.value||8))/100;
    s.headerColor = document.getElementById('rs-headerColor')?.value || '#2d6a2d';
    s.fontFamily = document.getElementById('rs-fontFamily')?.value || 'Arial';
    s.fontSize = parseInt(document.getElementById('rs-fontSize')?.value||10);
    s.docId = document.getElementById('rs-docId')?.value || 'T4_MONTHLY PLANT RETURN';
    s.revision = document.getElementById('rs-revision')?.value || '0';
    s.effectiveDate = document.getElementById('rs-effectiveDate')?.value || 'Sep-24';
    if(window._rsTempLogo !== undefined) s.logo = window._rsTempLogo;
    this.save(s);
    window._rsTempLogo = undefined;
    Modal.close();
    toast('Report settings saved','ok');
  },

  _saveTemplate() {
    const name = document.getElementById('rs-tplName')?.value?.trim();
    if(!name) return;
    const s = this.get();
    s.savedTemplates = s.savedTemplates||{};
    // Save current UI state as template
    s.savedTemplates[name] = {
      logoAlign: document.getElementById('rs-logoAlign')?.value,
      headerColor: document.getElementById('rs-headerColor')?.value,
      fontFamily: document.getElementById('rs-fontFamily')?.value,
      fontSize: document.getElementById('rs-fontSize')?.value,
      watermark: document.getElementById('rs-watermark')?.value,
      docId: document.getElementById('rs-docId')?.value,
      companyName: document.getElementById('rs-companyName')?.value,
    };
    this.save(s);
    toast('Template "'+name+'" saved','ok');
  },

  _loadTemplate() {
    const name = document.getElementById('rs-tplLoad')?.value;
    if(!name) return;
    const s = this.get();
    const tpl = s.savedTemplates?.[name];
    if(!tpl) return;
    if(document.getElementById('rs-headerColor')) document.getElementById('rs-headerColor').value = tpl.headerColor||'#2d6a2d';
    if(document.getElementById('rs-fontFamily')) document.getElementById('rs-fontFamily').value = tpl.fontFamily||'Arial';
    if(document.getElementById('rs-fontSize')) document.getElementById('rs-fontSize').value = tpl.fontSize||10;
    if(document.getElementById('rs-watermark')) document.getElementById('rs-watermark').value = tpl.watermark||'';
    if(document.getElementById('rs-docId')) document.getElementById('rs-docId').value = tpl.docId||'';
    if(document.getElementById('rs-companyName')) document.getElementById('rs-companyName').value = tpl.companyName||'';
    toast('Template "'+name+'" loaded','ok');
  },

  _deleteTemplate() {
    const name = document.getElementById('rs-tplLoad')?.value;
    if(!name||!confirm('Delete template "'+name+'"?')) return;
    const s = this.get();
    delete s.savedTemplates[name];
    this.save(s);
    toast('Template deleted','ok');
    ReportSettings.open();
  },

  // Generate the print header HTML used by all reports

  _logoHTML(docId, style) {
    const _ds = typeof DocumentControl !== 'undefined' ? DocumentControl._getDocSettings(docId) : {};
    const _gs = ReportSettings.get();
    const _orgId = (typeof S!=='undefined') ? (S.org?.id || S.user?.orgId || '') : '';
    const _org = (typeof DB!=='undefined' && DB.getOrg && _orgId) ? (DB.getOrg(_orgId)||{}) : ((typeof DB!=='undefined'&&DB.organizations&&DB.organizations[0])||{});
    const logo = _ds.logo || _gs.logo || _org.logo || '';
    const name = _gs.companyName || _org.name || 'COMPANY';
    const st = style || 'max-height:48px;max-width:160px;object-fit:contain;display:block';
    return logo ? '<img src="'+logo+'" style="'+st+'">' : '<span style="font-size:14px;font-weight:900;letter-spacing:1px">'+name+'</span>';
  },

    header(projName, contractNo, from, to, regId, pi, util, avail, pageInfo, docId, pageNum) {
    const _gs = this.get();
    const _ds = docId && typeof DocumentControl!=='undefined' ? DocumentControl._getDocSettings(docId) : {};
    const s = Object.assign({}, _gs, Object.fromEntries(Object.entries(_ds).filter(([k,v])=>v!==undefined&&v!==''&&v!==null)));
    const _fmtId = k => String(k||'').replace(/[_-]+/g,' ').trim().toUpperCase();
    const DOC_TITLES = { plant_usage_report:'MONTHLY PLANT RETURN', monthly_plant_return:'MONTHLY PLANT RETURN',
      fuel_disbursements:'FUEL DISBURSEMENT REPORT', fuel_variance:'FUEL VARIANCE REPORT' };
    const reportTitle  = DOC_TITLES[docId] || (docId ? _fmtId(docId) : 'MONTHLY PLANT RETURN');
    const docIdDisplay = (_ds.docId && String(_ds.docId).trim()) ? _ds.docId : reportTitle;
    const hc = s.headerColor||'#2d6a2d';
    const hcLight = hc+'22';
    const fmtD = v => v ? new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const uColor = util>=80?'#00b050':util>=50?'#ff9900':'#ff0000';
    const aColor = avail>=80?'#00b050':avail>=50?'#ff9900':'#ff0000';
    const plantDesc = [pi?.type||'', regId, pi?.description||pi?.fullDescription||''].filter(Boolean).join(' | ');
    const owner     = pi?.ownerSupplier||'—';
    const rate      = parseFloat(pi?.minRate||0).toFixed(2);
    const rateType  = (pi?.rateType||'per_hr').replace('per_','');
    const minHrs    = (pi && isFinite(parseFloat(pi.minHours))) ? parseFloat(pi.minHours) : 0;
    const fuelLhr   = pi?.fuelConsumption||0;
    const fuelUnit  = pi?.fuelUnit||'L/hr';
    const isPerKm   = (pi?.rateType==='per_km');

    const logoHtml = s.showLogo && s.logo
      ? '<img src="'+s.logo+'" style="max-height:52px;max-width:180px;object-fit:contain">'
      : '<div style="font-size:18px;font-weight:900;color:'+hc+';letter-spacing:2px;font-family:Arial Black,Arial">'+s.companyName+'</div>';
    const align = s.logoAlign||'left';

    return '<div class="rpt-header" style="border-bottom:3px solid '+hc+';padding-bottom:8px;margin-bottom:8px">'
      +'<table style="width:100%;border-collapse:collapse"><tr>'
      +'<td style="width:33%;vertical-align:middle">'+(align==='left'?'<div style="text-align:left">'+logoHtml+'</div>':'&nbsp;')+'</td>'
      +'<td style="width:34%;text-align:center;vertical-align:middle"><div style="font-size:15px;font-weight:700;color:'+hc+';letter-spacing:1px">'+reportTitle+'</div>'+(pageInfo&&pageInfo!=='Page 1 of 1'?'<div style="font-size:9px;color:#555;margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">'+pageInfo+'</div>':'')+'</td>'
      +'<td style="width:33%;text-align:right;vertical-align:top">'+(align==='right'?'<div style="text-align:right">'+logoHtml+'</div>':'')
      +'<div style="font-size:8px;color:#555;line-height:1.7">'
      +'<b>DOCUMENT ID:</b> '+docIdDisplay+'<br>'
      +'<b>REVISION:</b> '+(s.revision||'0')+'&nbsp;&nbsp;<b>EFFECTIVE DATE:</b> '+(s.effectiveDate||'Sep-24')+'<br>'
      +(pageNum||pageInfo||'Page 1 of 1')+'</div></td></tr>'
      +(align==='center'?'<tr><td colspan="3" style="padding-top:2px"><div style="text-align:center">'+logoHtml+'</div></td></tr>':'')
      +'</table></div>'
      +'<table class="info-table">'
      +'<colgroup><col style="width:22%"><col style="width:30%"><col style="width:10%"><col style="width:14%"><col style="width:12%"><col style="width:12%"></colgroup>'
      +'<tr>'
      +'<td class="lbl">CONTRACT NAME:</td><td colspan="3">'+projName+'</td>'
      +'<td class="lbl">Start Date:</td><td>'+fmtD(from)+'</td>'
      +'<td class="green-lbl" style="background:'+hc+'">UTILIZATION:</td>'
      +'<td class="green-val" style="color:'+uColor+';font-weight:700;background:'+hcLight+'">'+util.toFixed(1)+'%</td>'
      +'</tr><tr>'
      +'<td class="lbl">CONTRACT NO.:</td><td colspan="3">'+contractNo+'</td>'
      +'<td class="lbl">END DATE:</td><td>'+fmtD(to)+'</td>'
      +'<td class="green-lbl" style="background:'+hc+'">AVAILABILITY:</td>'
      +'<td class="green-val" style="color:'+aColor+';font-weight:700;background:'+hcLight+'">'+avail.toFixed(1)+'%</td>'
      +'</tr><tr>'
      +'<td class="lbl">PLANT NUMBER &amp; DESCRIPTION:</td><td colspan="3" style="font-weight:700">'+plantDesc+'</td>'
      +'<td class="lbl">AGREED RATE:</td><td>E '+rate+' /'+rateType+'</td>'
      +'<td colspan="2"></td>'
      +'</tr><tr>'
      +'<td class="lbl">COMPANY NAME:</td><td colspan="3">'+owner+'</td>'
      +'<td class="lbl">'+(isPerKm?'AGREED MIN:':'AGREED MIN HR/DAY:')+'</td><td>'+(isPerKm?'— (billed per km)':(((pi&&isFinite(parseFloat(pi.minHours)))?parseFloat(pi.minHours):0)+' hr/day'+((pi&&isFinite(parseFloat(pi.minHoursRainy))&&parseFloat(pi.minHoursRainy)>0)?' (Rainy: '+parseFloat(pi.minHoursRainy)+')':'')))+'</td>'
      +'<td colspan="2"></td>'
      +'</tr><tr>'
      +'<td colspan="4"></td>'
      +'<td class="lbl">Fuel '+fuelUnit+':</td><td>'+fuelLhr+' '+fuelUnit+'</td>'
      +'<td colspan="2"></td>'
      +'</tr>'
      +'</table>';
  },


  // CSS for all print templates
  css(docId) {
    const _gs = this.get();
    const _ds = docId && typeof DocumentControl!=='undefined' ? DocumentControl._getDocSettings(docId) : {};
    const s = Object.assign({}, _gs, Object.fromEntries(Object.entries(_ds).filter(([k,v])=>v!==undefined&&v!==''&&v!==null)));
    const hc = s.headerColor||'#2d6a2d';
    const wm = s.watermark||'';
    const wmOp = s.watermarkOpacity||0.08;
    return `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:${s.fontFamily||'Arial'},sans-serif;font-size:${s.fontSize||10}px;color:#000;background:#fff}
      ${wm?`body::before{content:'${wm}';position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;font-weight:900;color:#000;opacity:${wmOp};pointer-events:none;z-index:9999;white-space:nowrap}`:''}
      @page{size:297mm 210mm;margin:0}
      .page{width:297mm;min-height:auto;padding:8mm 10mm;page-break-after:always}
      .page:last-child{page-break-after:auto}
      .info-table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px}
      .info-table td{border:1px solid #ccc;padding:3px 6px}
      .lbl{font-weight:700;background:#f2f2f2;white-space:nowrap}
      .green-lbl{font-weight:700;background:${hc};color:#fff;white-space:nowrap;padding:3px 6px}
      .green-val{background:${hc}22;font-weight:700;border:1px solid ${hc}}
      .data-table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:9px}
      .data-table th{border:1px solid ${hc};padding:3px 4px;text-align:center;background:${hc};color:#fff;font-weight:700}
      .data-table thead{display:table-header-group}
      .data-table tr{page-break-inside:avoid}
      .data-table td{border:1px solid #999;padding:2px 4px;text-align:center}
      .data-table td:first-child,.data-table td:last-child{text-align:left}
      .data-table tbody tr:nth-child(even){background:#f9f9f9}
      .data-table tfoot tr{background:${hc}18;border-top:2px solid ${hc};font-weight:700}
      .data-table tfoot td{border-color:${hc}}
      .rpt-total{background:${hc}18;border-top:2px solid ${hc};font-weight:700}
      .rpt-subtotal{background:${hc}10;font-weight:600}
      .kpi-table th{background:${hc};color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;padding:4px 10px;border:1px solid ${hc}}
      .kpi-table td{padding:5px 10px;border:1px solid #ccc;font-size:12px;font-weight:700}
      .sign-section{margin-top:12px;border-top:2px solid ${hc};padding-top:8px}
      .sign-row{display:flex;justify-content:space-between;margin-bottom:16px;font-size:10px}
      .rpt-header{border-bottom:3px solid ${hc}!important}
      @media print{body{margin:0}.page{border:none;padding:5mm}}`;
  },

  printRange(from, to) {
    // Temporarily filter data, call print(), then restore
    const _origGet = DB.get.bind(DB);
    const norm = v => v ? String(v).slice(0,10) : '';
    DB.get = (sheet, proj) => {
      const data = _origGet(sheet, proj);
      if (!from && !to) return data;
      if (['timesheetEntries','plant','daily','dailyMeasurements'].includes(sheet)) {
        return data.filter(r => { const d=norm(r.date); return (!from||d>=from)&&(!to||d<=to); });
      }
      return data;
    };
    try { this.print(); } finally { DB.get = _origGet; }
  }
};


/* ═══════════════════════════════════════════════════════════════════
   INTER-PROJECT TRANSFERS  — unified register for moving Workers,
   Plant, Fuel and Material between projects with a send→receive
   handshake and full audit trail. Assets (worker/plant) reassign on
   confirmation; consumables (fuel/material) record qty + value moved.
   ═══════════════════════════════════════════════════════════════════ */
const Transfers = {
  // resource-type metadata --------------------------------------------------
  TYPES: {
    plant:    { label:'Plant',    icon:'🚜', kind:'asset',      coll:'plantInventory' },
    worker:   { label:'Worker',   icon:'👷', kind:'asset',      coll:'workers' },
    fuel:     { label:'Fuel',     icon:'⛽', kind:'consumable', coll:'fuelIssues' },
    material: { label:'Material', icon:'📦', kind:'consumable', coll:'issues' },
  },

  _statusMeta: {
    pending:   { label:'Pending',   col:'var(--amber)', bg:'rgba(240,165,0,.12)' },
    received:  { label:'Received',  col:'var(--green)', bg:'rgba(34,197,94,.12)' },
    rejected:  { label:'Rejected',  col:'var(--red)',   bg:'rgba(239,68,68,.12)' },
    cancelled: { label:'Cancelled', col:'var(--text3)', bg:'rgba(150,150,150,.12)' },
  },

  // ── data helpers ────────────────────────────────────────────────────────
  _all() {
    this._lsMerge();
    // De-duplicate by id, preferring the most-progressed status. Append-style
    // backends or a reload can leave both a 'pending' and a 'received' row for
    // the same transfer; without this the pending ghost re-appears as unconfirmed.
    const rank = s => ({pending:0, cancelled:1, rejected:1, received:2}[s] || 0);
    const seen = {};
    (DB.transfers || []).forEach(t => {
      const ex = seen[t.id];
      if(!ex) { seen[t.id] = t; return; }
      if(rank(t.status) > rank(ex.status)) seen[t.id] = t;
      else if(rank(t.status) === rank(ex.status)
        && String(t.receivedAt||t.initiatedAt||'') > String(ex.receivedAt||ex.initiatedAt||'')) seen[t.id] = t;
    });
    return Object.values(seen);
  },

  // ── Local cache ─────────────────────────────────────────────────────────
  // The org-wide load REPLACES DB.transfers from the backend; if a confirmation
  // didn't persist there (missing sheet/column, append-only save, transport
  // limit), it would be lost on reload. We mirror every change to localStorage
  // and re-apply it, so a transfer you confirmed stays confirmed on this device.
  _LS: 'cm_transfers_cache',
  _lsLoad() { try { return JSON.parse(localStorage.getItem(this._LS) || '[]'); } catch(e) { return []; } },
  _lsSave(t) {
    try {
      const a = this._lsLoad();
      const i = a.findIndex(x => x.id === t.id);
      const rec = JSON.parse(JSON.stringify(t));
      if(i >= 0) a[i] = rec; else a.push(rec);
      localStorage.setItem(this._LS, JSON.stringify(a));
    } catch(e) {}
  },
  _lsMerge() {
    const a = this._lsLoad(); if(!a.length) return;
    const rank = s => ({pending:0, cancelled:1, rejected:1, received:2}[s] || 0);
    if(!DB.transfers) DB.transfers = [];
    a.forEach(lt => {
      const i = DB.transfers.findIndex(x => x.id === lt.id);
      if(i < 0) { DB.transfers.push(lt); return; }
      // Local cache wins when it is the same or a more-progressed status, and
      // restores fields the backend may have dropped (e.g. snapshot).
      if(rank(lt.status) >= rank(DB.transfers[i].status)) {
        const cur = DB.transfers[i];
        if(!lt.snapshot && cur.snapshot) lt.snapshot = cur.snapshot;
        DB.transfers[i] = lt;
      } else if(!DB.transfers[i].snapshot && lt.snapshot) {
        DB.transfers[i].snapshot = lt.snapshot;
      }
    });
  },
  _incoming() { return this._all().filter(t => t.toProject === S.project); },
  _outgoing() { return this._all().filter(t => t.fromProject === S.project); },
  _forProject() {
    return this._all()
      .filter(t => t.fromProject === S.project || t.toProject === S.project)
      .sort((a,b)=>String(b.initiatedAt||b.date||'').localeCompare(String(a.initiatedAt||a.date||'')));
  },
  _otherProjects() {
    return (DB.projects||[]).filter(p => p.code !== S.project);
  },
  _projName(code) { const p = DB.getProject(code); return p ? p.code : (code||'—'); },
  _badge(status) {
    const m = this._statusMeta[status] || this._statusMeta.pending;
    return `<span style="background:${m.bg};color:${m.col};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">${m.label}</span>`;
  },
  _canReceive(t) {
    // Only the destination project may confirm/reject a pending transfer
    return t.status === 'pending' && t.toProject === S.project;
  },
  _canCancel(t) {
    // Only the source project may cancel a still-pending transfer
    return t.status === 'pending' && t.fromProject === S.project;
  },

  // ── MAIN RENDER ─────────────────────────────────────────────────────────
  render() {
    this._reconcileTeams();
    const list     = this._forProject();
    const incoming = list.filter(t => this._canReceive(t));
    const html = Prod._orgContextStrip()
      + `<div class="sec-hdr"><div class="sec-title">🔄 Inter-Project Transfers</div>
           <div style="display:flex;gap:6px;flex-wrap:wrap">
             <button class="btn ghost sm" onclick="Transfers.report()">📄 Report</button>
             <button class="btn ghost sm" onclick="Transfers.exportCSV()">⇩ CSV</button>
             <button class="btn amber" onclick="Transfers.openInitiate()">＋ New Transfer</button>
           </div></div>`
      + this._statsStrip(list)
      + (incoming.length ? this._incomingPanel(incoming) : '')
      + this._registerPanel(list);
    ge('sub-body').innerHTML = html;
  },

  _statsStrip(list) {
    const c = s => list.filter(t=>t.status===s).length;
    const cell = (v,l,col)=>`<div class="stat-mini"><div class="stat-v" style="color:${col||'var(--text)'}">${v}</div><div class="stat-l">${l}</div></div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:16px">
      ${cell(list.length,'Total')}
      ${cell(c('pending'),'Pending','var(--amber)')}
      ${cell(c('received'),'Received','var(--green)')}
      ${cell(this._outgoing().length,'Out')}
      ${cell(this._incoming().length,'In','var(--blue)')}
    </div>`;
  },

  _incomingPanel(incoming) {
    return `<div class="panel" style="border:1px solid var(--amber);margin-bottom:16px">
      <div class="panel-title" style="color:var(--amber)">📥 Incoming — awaiting your confirmation (${incoming.length})</div>
      <div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
        <th>Ref</th><th>Type</th><th>Resource</th><th>From</th><th>Qty / Detail</th><th>Date</th><th>By</th><th>Action</th>
      </tr></thead><tbody>${incoming.map(t=>this._incomingRow(t)).join('')}</tbody></table></div></div>`;
  },

  _incomingRow(t) {
    const ty = this.TYPES[t.resourceType] || {};
    return `<tr>
      <td class="mono" style="font-size:10px">${t.id}</td>
      <td>${ty.icon||''} ${ty.label||t.resourceType}</td>
      <td class="bold">${this._esc(t.resourceName||t.resourceRef||'—')}</td>
      <td>${this._projName(t.fromProject)}</td>
      <td>${this._detail(t)}</td>
      <td>${fmtD(t.effectiveDate||t.date)}</td>
      <td style="font-size:10px">${this._esc(t.initiatedBy||'—')}</td>
      <td style="white-space:nowrap">
        <button class="btn green" style="padding:3px 10px;font-size:10px" onclick="Transfers.confirm('${t.id}')">Confirm</button>
        <button class="btn ghost" style="padding:3px 10px;font-size:10px" onclick="Transfers.reject('${t.id}')">Reject</button>
      </td></tr>`;
  },

  _registerPanel(list) {
    if(!list.length) return `<div class="empty"><div class="ico">🔄</div><p>No transfers yet</p>
      <p style="font-size:12px;margin-top:6px">Use “＋ New Transfer” to move a worker, plant, fuel or material to another project.</p></div>`;
    return `<div class="panel"><div class="panel-title">📋 Transfer Register</div>
      <div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
        <th>Ref</th><th>Type</th><th>Resource</th><th>From → To</th><th>Qty / Detail</th><th>Cost (E)</th><th>Date</th><th>Status</th><th></th>
      </tr></thead><tbody>${list.map(t=>this._registerRow(t)).join('')}</tbody></table></div></div>`;
  },

  _registerRow(t) {
    const ty  = this.TYPES[t.resourceType] || {};
    const dir = t.fromProject===S.project ? '↗' : '↘';
    let act = '';
    if(this._canCancel(t)) act = `<button class="btn ghost" style="padding:3px 9px;font-size:10px" onclick="Transfers.cancel('${t.id}')">Cancel</button>`;
    else if(this._canReceive(t)) act = `<button class="btn green" style="padding:3px 9px;font-size:10px" onclick="Transfers.confirm('${t.id}')">Confirm</button>`;
    return `<tr>
      <td class="mono" style="font-size:10px">${t.id}</td>
      <td>${ty.icon||''} ${ty.label||t.resourceType}</td>
      <td class="bold">${this._esc(t.resourceName||t.resourceRef||'—')}</td>
      <td style="font-size:10px">${dir} ${this._projName(t.fromProject)} → ${this._projName(t.toProject)}</td>
      <td>${this._detail(t)}</td>
      <td style="text-align:right;font-size:11px">${this._costCell(t)}</td>
      <td>${fmtD(t.effectiveDate||t.date)}</td>
      <td>${this._badge(t.status)}</td>
      <td style="white-space:nowrap">${act}</td></tr>`;
  },

  _detail(t) {
    if(t.resourceType==='plant')  return t.hourMeter!=null&&t.hourMeter!==''?('Hr '+t.hourMeter):'—';
    if(t.resourceType==='worker') return this._esc(t.resourceRef||'—');
    const q = (t.qty!=null&&t.qty!=='')?(fmtN(t.qty)+(t.unit?(' '+t.unit):'')):'—';
    const v = (t.value!=null&&t.value!=='')?(' · E'+Number(t.value||0).toFixed(2)):'';
    return q+v;
  },
  _esc(s){ return s==null?'':String(s).replace(/</g,'&lt;'); },

  _costCell(t) {
    const val = parseFloat(t.value)||0;
    if(t.status==='received'){
      const imp = this._costImpact(t);
      if(!imp) return '<span style="color:var(--text3)">—</span>';
      const col = imp<0?'var(--red)':'var(--green)';
      return `<span style="color:${col};font-weight:700">${imp<0?'−':'+'}E${fmtN(Math.abs(imp))}</span>`;
    }
    if(val>0) return `<span style="color:var(--text3)">E${fmtN(val)}</span>`;
    return '<span style="color:var(--text3)">—</span>';
  },

  // Signed cost into each project's Costing dashboard. Material already moves
  // its cost via the paired GRN (the Materials KPI), so it is skipped here to
  // avoid double-counting; fuel/plant/worker post to manualCosts.
  _postCostEntries(t) {
    const val = parseFloat(t.value)||0;
    if(!(val>0)) return;
    if(t.resourceType==='material') return;
    const ty = this.TYPES[t.resourceType]||{};
    const mk = (proj, amt, desc) => ({
      id:'MC-TRF-'+uid(), orgId:(DB.getProject(proj)?.orgId)||t.orgId, project:proj,
      date:(t.effectiveDate||t.date), category:'Inter-Project Transfer',
      description:desc, vendor:(t.resourceName||ty.label||''), amount:+amt.toFixed(2),
      invoiceRef:t.id, approvedBy:(S.user?.name||''), createdBy:(S.user?.id||''),
      updatedAt:new Date().toISOString()
    });
    const outRec = mk(t.fromProject, -val, (ty.icon||'')+' Transfer out: '+(t.resourceName||ty.label)+' → '+t.toProject);
    const inRec  = mk(t.toProject,    val, (ty.icon||'')+' Transfer in: '+(t.resourceName||ty.label)+' ← '+t.fromProject);
    DB.save('manualCosts', outRec); DB.save('manualCosts', inRec);
    if(!S.isDemo && S.scriptUrl){
      GAS.post({action:'save', sheet:'ManualCosts', record:outRec}).catch(()=>{});
      GAS.post({action:'save', sheet:'ManualCosts', record:inRec}).catch(()=>{});
    }
  },

  // Signed cost impact on the CURRENT project: out → negative, in → positive.
  // Only confirmed (received) transfers have actually moved value.
  _costImpact(t) {
    if(t.status!=='received') return 0;
    const val = parseFloat(t.value)||0;
    if(t.fromProject===S.project) return -val;
    if(t.toProject===S.project)   return  val;
    return 0;
  },
  _detailPlain(t) {
    if(t.resourceType==='plant')  return (t.hourMeter!=null&&t.hourMeter!=='')?('Hr '+t.hourMeter):'—';
    if(t.resourceType==='worker') return t.resourceRef||'—';
    return (t.qty!=null&&t.qty!=='')?(fmtN(t.qty)+(t.unit?(' '+t.unit):'')):'—';
  },

  // ── REPORT (print) ──────────────────────────────────────────────────────
  report() {
    const list = this._forProject();
    if(!list.length){ toast('No transfers to report','info'); return; }
    const gs   = (typeof ReportSettings!=='undefined' && ReportSettings.get) ? ReportSettings.get() : {};
    const proj = DB.getProject(S.project)||{};
    const projName = proj.name||S.project;
    const hc   = gs.headerColor||'#2d6a2d';
    const fD   = v=>v?new Date(String(v).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const money= v=>'E '+(parseFloat(v)||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
    const signed=v=>{ const n=parseFloat(v)||0; return (n<0?'-':(n>0?'+':''))+'E '+Math.abs(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2}); };

    let totIn=0, totOut=0; const byType={};
    const rows = list.map(t=>{
      const ty=this.TYPES[t.resourceType]||{};
      const out=t.fromProject===S.project;
      const val=parseFloat(t.value)||0;
      const impact=this._costImpact(t);
      if(t.status==='received'){
        if(out) totOut+=val; else totIn+=val;
        byType[t.resourceType]=byType[t.resourceType]||{in:0,out:0,n:0};
        byType[t.resourceType][out?'out':'in']+=val; byType[t.resourceType].n++;
      }
      const impCol=impact<0?'#c00':(impact>0?'#16a34a':'#999');
      return '<tr>'
        +'<td>'+t.id+'</td>'
        +'<td>'+fD(t.effectiveDate||t.date)+'</td>'
        +'<td>'+(ty.label||t.resourceType)+'</td>'
        +'<td>'+this._esc(t.resourceName||t.resourceRef||'—')+'</td>'
        +'<td style="text-align:center;font-weight:700;color:'+(out?'#c00':'#16a34a')+'">'+(out?'OUT →':'← IN')+'</td>'
        +'<td>'+(out?this._projName(t.toProject):this._projName(t.fromProject))+'</td>'
        +'<td>'+this._detailPlain(t)+'</td>'
        +'<td style="text-align:right">'+(val?money(val):'—')+'</td>'
        +'<td style="text-align:right;font-weight:700;color:'+impCol+'">'+(t.status==='received'?signed(impact):'<span style="color:#999;font-weight:400">'+t.status+'</span>')+'</td>'
        +'<td style="text-align:center">'+t.status+'</td>'
        +'</tr>';
    }).join('');
    const net=totIn-totOut;

    const kpi=(l,v,c)=>'<div style="border:1px solid #ccc;border-radius:4px;padding:8px 12px;text-align:center"><div style="font-size:8px;color:#555;text-transform:uppercase;letter-spacing:.5px">'+l+'</div><div style="font-size:15px;font-weight:700;color:'+c+'">'+v+'</div></div>';
    const kpis='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0">'
      +kpi('Transfers In (value)','+'+money(totIn),'#16a34a')
      +kpi('Transfers Out (value)','-'+money(totOut),'#c00')
      +kpi('Net Cost Impact',signed(net),net<0?'#c00':'#16a34a')
      +kpi('Records',String(list.length),'#333')
      +'</div>';
    const typeRows=Object.entries(byType).map(([k,v])=>{
      const ty=this.TYPES[k]||{}; const n=(v.in-v.out);
      return '<tr><td>'+(ty.label||k)+'</td><td style="text-align:center">'+v.n+'</td>'
        +'<td style="text-align:right;color:#16a34a">+'+money(v.in)+'</td>'
        +'<td style="text-align:right;color:#c00">-'+money(v.out)+'</td>'
        +'<td style="text-align:right;font-weight:700;color:'+(n<0?'#c00':'#16a34a')+'">'+signed(n)+'</td></tr>';
    }).join('');

    const logoHtml = (gs.showLogo && gs.logo)
      ? '<img src="'+gs.logo+'" style="max-height:50px;max-width:180px;object-fit:contain">'
      : '<div style="font-size:18px;font-weight:900;color:'+hc+';letter-spacing:2px">'+(gs.companyName||'CivMetrix')+'</div>';
    const header='<div style="border-bottom:3px solid '+hc+';padding-bottom:8px;margin-bottom:10px">'
      +'<table style="width:100%;border-collapse:collapse"><tr>'
      +'<td style="width:34%;vertical-align:middle">'+logoHtml+'</td>'
      +'<td style="width:34%;text-align:center"><div style="font-size:15px;font-weight:700;color:'+hc+';letter-spacing:1px">INTER-PROJECT TRANSFERS REPORT</div></td>'
      +'<td style="width:32%;text-align:right;font-size:8px;color:#555;line-height:1.7">'
      +'<b>DOCUMENT ID:</b> '+(gs.docId||'T-TRANSFERS')+'<br><b>REVISION:</b> '+(gs.revision||'0')+'<br>Generated '+new Date().toLocaleString('en-GB')+'</td>'
      +'</tr></table>'
      +'<div style="font-size:10px;color:#333;margin-top:6px"><b>PROJECT:</b> '+this._esc(projName)+' ('+(proj.code||S.project)+')'
      +' &nbsp;|&nbsp; <b>CONTRACT NO.:</b> '+this._esc(proj.contractNo||'—')+'</div></div>';

    const css='*{box-sizing:border-box}body{font-family:'+(gs.fontFamily||'Arial')+';margin:18px;font-size:11px;color:#111}'
      +'.data-table{width:100%;border-collapse:collapse;margin-top:6px}'
      +'.data-table th{background:'+hc+';color:#fff;font-size:9px;padding:6px 7px;text-align:left;border:1px solid #999}'
      +'.data-table td{font-size:9px;padding:4px 7px;border:1px solid #ccc}'
      +'.data-table tfoot td{font-weight:700;background:#f0f0f0}'
      +'.sumtbl{border-collapse:collapse;margin:6px 0;font-size:9px}.sumtbl th,.sumtbl td{border:1px solid #ccc;padding:4px 8px}.sumtbl th{background:#eee}'
      +'@media print{button{display:none}}';

    const doc='<!DOCTYPE html><html><head><title>Inter-Project Transfers Report</title><style>'+css+'</style></head><body>'
      +'<div style="text-align:right;margin-bottom:6px"><button onclick="window.print()" style="padding:5px 16px;background:'+hc+';color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">🖨 Print</button></div>'
      +header+kpis
      +'<table class="data-table"><thead><tr>'
      +'<th>Ref</th><th>Date</th><th>Type</th><th>Resource</th><th>Dir</th><th>Counterparty</th><th>Detail</th><th style="text-align:right">Value</th><th style="text-align:right">Cost to Project</th><th>Status</th>'
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot><tr><td colspan="8" style="text-align:right">NET COST IMPACT ('+projName+')</td>'
      +'<td style="text-align:right;color:'+(net<0?'#c00':'#16a34a')+'">'+signed(net)+'</td><td></td></tr></tfoot></table>'
      +(typeRows?'<div style="margin-top:14px;font-size:10px;font-weight:700;color:#555">SUMMARY BY TYPE</div>'
        +'<table class="sumtbl"><thead><tr><th>Type</th><th>Count</th><th>In (+)</th><th>Out (−)</th><th>Net</th></tr></thead><tbody>'+typeRows+'</tbody></table>':'')
      +'<div style="margin-top:14px;font-size:8px;color:#888">Convention: value leaving this project is shown negative (credit); value received is positive (debit). Only confirmed transfers affect cost.</div>'
      +'</body></html>';

    const w=window.open('','_blank','width=1050,height=720,scrollbars=yes');
    if(!w){ toast('Allow pop-ups to open the report','err'); return; }
    w.document.write(doc); w.document.close();
    setTimeout(()=>{ try{w.print();}catch(e){} },400);
  },

  exportCSV() {
    const list=this._forProject();
    if(!list.length){ toast('No transfers to export','info'); return; }
    const esc=v=>{ const s=(v==null?'':String(v)); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
    const head=['Ref','Date','Type','Resource','Direction','From','To','Qty','Unit','Value(E)','CostToProject(E)','Status','Initiated By','Received By','Notes'];
    const lines=[head.join(',')];
    list.forEach(t=>{
      const out=t.fromProject===S.project;
      lines.push([t.id,(t.effectiveDate||t.date),t.resourceType,(t.resourceName||t.resourceRef||''),
        out?'OUT':'IN',t.fromProject,t.toProject,(t.qty||''),(t.unit||''),
        (parseFloat(t.value)||0).toFixed(2),this._costImpact(t).toFixed(2),t.status,
        (t.initiatedBy||''),(t.receivedBy||''),(t.notes||'')].map(esc).join(','));
    });
    const blob=new Blob([lines.join('\n')],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='transfers_'+(S.project||'project')+'_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },

  // ── INITIATE ────────────────────────────────────────────────────────────
  openInitiate() {
    if(this._otherProjects().length===0){ toast('No other project to transfer to — create a second project first.','info'); return; }
    const types = Object.entries(this.TYPES).map(([k,v])=>
      `<button class="btn ghost" style="flex:1;min-width:120px;padding:14px;font-size:13px" onclick="Transfers._initiateForm('${k}')">${v.icon} ${v.label}</button>`).join('');
    Modal.open('🔄 New Transfer — choose what to move',
      `<p style="color:var(--text2);font-size:12px;margin-bottom:12px">From <b>${this._projName(S.project)}</b> to another project.</p>
       <div style="display:flex;gap:10px;flex-wrap:wrap">${types}</div>`,
      [{label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  },

  _initiateForm(type) {
    const ty = this.TYPES[type];
    const today = new Date().toISOString().slice(0,10);
    const destOpts = this._otherProjects().map(p=>`<option value="${p.code}">${p.code} — ${this._esc(p.name)}</option>`).join('');
    const _fl = (lbl,inner)=>`<div style="margin-bottom:10px"><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">${lbl}</label>${inner}</div>`;
    const inS = 'class="finput" style="width:100%"';

    let resourceField = '';
    if(ty.kind==='asset'){
      const opts = this._availableAssets(type).map(r=>`<option value="${r.id}">${this._esc(r.label)}</option>`).join('');
      resourceField = _fl(ty.label+' to transfer', `<select id="tf-res" ${inS}>${opts||'<option value="">— none available —</option>'}</select>`);
    } else if(type==='material'){
      const stk = this._materialStock();
      if(!stk.length){
        resourceField = _fl('Material', `<div style="color:var(--red);font-size:12px;padding:6px 0">No material in stock on this project to transfer.</div>`);
      } else {
        const opts = stk.map((r,i)=>`<option value="${i}" data-mat="${this._esc(r.material)}" data-unit="${this._esc(r.unit)}" data-avail="${r.available}" data-cost="${r.lastCost}">${this._esc(r.material)} — ${fmtN(r.available)} ${this._esc(r.unit)} in stock</option>`).join('');
        resourceField = _fl('Material (from stock balance)', `<select id="tf-matsel" ${inS} onchange="Transfers._onMatPick()">${opts}</select>`);
      }
    } else {
      resourceField = _fl(ty.label+' name', `<input id="tf-resname" ${inS} value="Diesel" placeholder="Diesel">`);
    }

    let extra = '';
    if(type==='plant'){
      extra = _fl('Hour-meter reading at transfer', `<input id="tf-hr" type="number" step="0.1" ${inS} placeholder="e.g. 1240.5">`)
            + _fl('Odometer (optional)', `<input id="tf-odo" type="number" step="0.1" ${inS} placeholder="optional">`);
    }
    if(ty.kind==='consumable'){
      const isMat = type==='material';
      extra = `<div style="display:flex;gap:10px">
          <div style="flex:2">${_fl('Quantity'+(isMat?' <span id="tf-avail-hint" style="color:var(--text3);font-weight:400"></span>':''), `<input id="tf-qty" type="number" step="0.01" ${inS} placeholder="0">`)}</div>
          <div style="flex:1">${_fl('Unit', `<input id="tf-unit" ${inS} value="${type==='fuel'?'L':''}" ${isMat?'readonly':''} placeholder="${type==='fuel'?'L':'unit'}">`)}</div>
        </div>`
        + _fl('Value (E) — cost moved with the goods', `<input id="tf-val" type="number" step="0.01" ${inS} placeholder="0.00">`);
    }
    if(ty.kind==='asset'){
      extra += _fl('Transfer value (E) — optional, for internal cost charging', `<input id="tf-val" type="number" step="0.01" ${inS} placeholder="0.00 — leave blank if none">`);
    }

    Modal.open(`${ty.icon} Transfer ${ty.label}`,
      _fl('Destination project', `<select id="tf-dest" ${inS}>${destOpts}</select>`)
      + resourceField
      + _fl('Effective date', `<input id="tf-date" type="date" ${inS} value="${today}">`)
      + extra
      + _fl('Reason / notes', `<textarea id="tf-notes" class="finput" style="width:100%;min-height:48px" placeholder="Optional"></textarea>`),
      [{label:'Send Transfer',cls:'amber',fn:()=>Transfers.submit(type)},
       {label:'Back',cls:'ghost',fn:()=>Transfers.openInitiate()}]);
    if(type==='material') setTimeout(()=>Transfers._onMatPick(), 50);
  },

  // available material in the source project's store: received − consumed,
  // less any qty already committed on still-pending outgoing transfers
  _materialStock() {
    const grn = DB.get('grn', S.project) || [];
    const stock = {};
    grn.forEach(g=>{
      const k=(g.material||'')+'||'+(g.unit||'');
      if(!stock[k]) stock[k]={key:k, material:g.material||'', unit:g.unit||'', received:0, consumed:0, lastCost:0};
      stock[k].received += parseFloat(g.qtyReceived)||0;
      if(parseFloat(g.unitCost)) stock[k].lastCost = parseFloat(g.unitCost);
    });
    (DB.materialUsage||[]).filter(u=>!u.project||u.project===S.project).forEach(u=>{
      const m=Object.keys(stock).find(k=>k.startsWith((u.material||'')+'||'));
      if(m) stock[m].consumed += parseFloat(u.usedQty)||0;
    });
    const pend = {};
    this._outgoing().filter(t=>t.resourceType==='material'&&t.status==='pending').forEach(t=>{
      const k=(t.resourceName||'')+'||'+(t.unit||'');
      pend[k]=(pend[k]||0)+(parseFloat(t.qty)||0);
    });
    return Object.values(stock).map(r=>{
      r.available = +(r.received - r.consumed - (pend[r.key]||0)).toFixed(3);
      return r;
    }).filter(r=>r.available>0);
  },

  _onMatPick() {
    const sel = ge('tf-matsel'); if(!sel||!sel.value) return;
    const opt = sel.options[sel.selectedIndex]; if(!opt) return;
    const u = ge('tf-unit'); if(u){ u.value = opt.dataset.unit||''; }
    const h = ge('tf-avail-hint'); if(h) h.textContent = '· max '+opt.dataset.avail+' '+(opt.dataset.unit||'');
    const q = ge('tf-qty'); if(q) q.max = opt.dataset.avail;
  },

  _availableAssets(type) {
    if(type==='plant'){
      return (DB.get('plantInventory', S.project)||[])
        .filter(p=>!this._isInTransit(p.id))
        .map(p=>({id:p.id, label:`${p.regId||''} — ${p.plantType||''} ${p.description||''}`.trim()}));
    }
    if(type==='worker'){
      return (DB.get('workers', S.project)||[])
        .filter(w=>(String(w.status||'active').toLowerCase()!=='inactive') && !this._isInTransit(w.id))
        .map(w=>({id:w.id, label:`${w.name||''} — ${w.employeeId||''} (${w.trade||w.skillLevel||''})`}));
    }
    return [];
  },
  _isInTransit(resId){
    return this._all().some(t=>t.resourceId===resId && t.status==='pending');
  },

  submit(type) {
    const ty   = this.TYPES[type];
    const dest = ge('tf-dest')?.value;
    if(!dest){ toast('Select a destination project','err'); return; }
    const date = ge('tf-date')?.value || new Date().toISOString().slice(0,10);

    const rec = {
      id: 'TRF-'+uid(),
      orgId: _orgId(),
      project: S.project,            // stamp source for generic machinery
      resourceType: type,
      fromProject: S.project,
      toProject: dest,
      date, effectiveDate: date,
      resourceId:'', resourceRef:'', resourceName:'',
      qty:'', unit:'', value:'',
      hourMeter:'', odometer:'',
      status:'pending',
      initiatedBy: S.user?.name || S.user?.id || '',
      initiatedAt: new Date().toISOString(),
      receivedBy:'', receivedAt:'', rejectReason:'',
      notes: ge('tf-notes')?.value || '',
      createdBy: S.user?.id || '',
    };

    if(ty.kind==='asset'){
      const resId = ge('tf-res')?.value;
      if(!resId){ toast('Select a '+ty.label.toLowerCase()+' to transfer','err'); return; }
      const src = (DB.get(ty.coll, S.project)||[]).find(r=>r.id===resId);
      if(!src){ toast('Resource not found','err'); return; }
      rec.resourceId  = resId;
      if(type==='plant'){
        rec.resourceRef  = src.regId||'';
        rec.resourceName = `${src.regId||''} — ${src.plantType||''}`.trim();
        rec.hourMeter    = ge('tf-hr')?.value || '';
        rec.odometer     = ge('tf-odo')?.value || '';
      } else {
        rec.resourceRef  = src.employeeId||'';
        rec.resourceName = src.name||'';
      }
      rec.value = parseFloat(ge('tf-val')?.value)||0;
      try { rec.snapshot = JSON.stringify(src); } catch(e) { rec.snapshot = ''; }
    } else if(type==='material'){
      const sel = ge('tf-matsel');
      if(!sel || !sel.value){ toast('No material in stock to transfer','err'); return; }
      const opt   = sel.options[sel.selectedIndex];
      const avail = parseFloat(opt.dataset.avail)||0;
      const cost  = parseFloat(opt.dataset.cost)||0;
      const qty   = parseFloat(ge('tf-qty')?.value);
      if(!(qty>0)){ toast('Enter a quantity greater than zero','err'); return; }
      if(qty>avail){ toast('Quantity exceeds available stock ('+avail+' '+(opt.dataset.unit||'')+')','err'); return; }
      rec.resourceName = opt.dataset.mat||'';
      rec.resourceRef  = rec.resourceName;
      rec.qty   = qty;
      rec.unit  = opt.dataset.unit||'';
      rec.value = parseFloat(ge('tf-val')?.value) || +(qty*cost).toFixed(2);
    } else {
      const qty = parseFloat(ge('tf-qty')?.value);
      if(!(qty>0)){ toast('Enter a quantity greater than zero','err'); return; }
      rec.resourceName = (ge('tf-resname')?.value||ty.label).trim();
      rec.resourceRef  = rec.resourceName;
      rec.qty   = qty;
      rec.unit  = ge('tf-unit')?.value || '';
      rec.value = parseFloat(ge('tf-val')?.value)||0;
    }

    DB.save('transfers', rec);
    this._lsSave(rec);
    if(!S.isDemo && S.scriptUrl) GAS.post({action:'save', sheet:'Transfers', record:rec}).catch(()=>{});
    Modal.close();
    toast(`${ty.label} transfer sent to ${this._projName(dest)} — awaiting confirmation`,'success');
    this.render();
  },

  // ── CONFIRM / REJECT / CANCEL ───────────────────────────────────────────
  confirm(id) {
    const t = this._all().find(x=>x.id===id);
    if(!t || !this._canReceive(t)){ toast('This transfer cannot be confirmed here','err'); return; }
    const ty = this.TYPES[t.resourceType];
    if(ty.kind==='asset'){
      const ok = this._applyAssetReassign(t);
      if(!ok){ toast('Could not locate the '+(ty.label||'').toLowerCase()+' record to reassign — try Reload, then confirm again.','err'); return; }
    }
    if(t.resourceType==='material') this._postMaterialStock(t);
    // Fuel needs no posting: the Fuel Stock panel nets received fuel transfers directly.
    this._postCostEntries(t);   // signed cost: −value on source, +value on destination
    t.status='received';
    t.receivedBy = S.user?.name || S.user?.id || '';
    t.receivedAt = new Date().toISOString();
    DB.save('transfers', t);
    this._lsSave(t);
    if(!S.isDemo && S.scriptUrl) GAS.post({action:'save', sheet:'Transfers', record:t}).catch(()=>{});
    toast(`${ty.label} received into ${this._projName(t.toProject)}`,'success');
    this.render();
  },

  _applyAssetReassign(t) {
    const ty = this.TYPES[t.resourceType];
    let rec = (DB[ty.coll]||[]).find(r=>r.id===t.resourceId);
    if(!rec && t.snapshot){
      // Destination session loads assets per-project, so the source record may
      // not be present here. Re-create it from the snapshot taken at initiate.
      try { rec = JSON.parse(t.snapshot); } catch(e) { rec = null; }
      if(rec){ DB[ty.coll]=DB[ty.coll]||[]; if(!DB[ty.coll].some(r=>r.id===rec.id)) DB[ty.coll].push(rec); }
    }
    if(!rec) return false;
    rec.project = t.toProject;                       // reassign forward; history keeps its own stamps
    const destOrg = DB.getProject(t.toProject)?.orgId;
    if(destOrg) rec.orgId = destOrg;                 // follow the destination project's org
    if(t.resourceType==='plant' && t.hourMeter!=='') rec.lastTransferHr = t.hourMeter;
    DB.save(ty.coll, rec);
    if(!S.isDemo && S.scriptUrl){
      const sheet = {plantInventory:'PlantInventory', workers:'Workers'}[ty.coll];
      if(sheet) GAS.post({action:'save', sheet, record:rec}).catch(()=>{});
    }
    // Source-team cleanup is handled by _reconcileTeams() (runs where the
    // source project's teams are actually loaded), not here on the dest session.
    return true;
  },

  // Self-heal: strip from THIS project's teams any worker whose latest received
  // transfer moved them to a different project. Uses the org-wide transfer
  // ledger, so it works regardless of which session confirmed the transfer.
  _reconcileTeams() {
    const teams = (DB.foremenTeams||[]).filter(t=>t.project===S.project);
    if(!teams.length) return;
    const latest = {};
    this._all().filter(t=>t.resourceType==='worker'&&t.status==='received'&&t.resourceId).forEach(t=>{
      const ex=latest[t.resourceId];
      if(!ex || String(t.receivedAt||'')>String(ex.receivedAt||'')) latest[t.resourceId]=t;
    });
    teams.forEach(team=>{
      const ids = String(team.workerIds||'').split(',').map(s=>s.trim()).filter(Boolean);
      const keep = ids.filter(id=>{ const lt=latest[id]; return !(lt && lt.toProject!==team.project); });
      if(keep.length!==ids.length){
        team.workerIds = keep.join(',');
        DB.save('foremenTeams', team);
        if(!S.isDemo && S.scriptUrl) GAS.post({action:'save', sheet:'ForemenTeams', record:team}).catch(()=>{});
      }
    });
  },

  // Inter-project material movement → paired GRN receipts so every stock
  // balance (computed from GRN received) updates automatically: a reducing
  // receipt on the source store and a positive receipt on the destination.
  _postMaterialStock(t) {
    const qty = parseFloat(t.qty)||0; if(!(qty>0)) return;
    const unitCost = qty>0 ? (parseFloat(t.value)||0)/qty : 0;
    const d = t.effectiveDate||t.date;
    const who = S.user?.name||S.user?.id||'';
    const mk = (proj, signedQty, statusLabel, counterparty) => ({
      id:'GRN-'+uid(), orgId:(DB.getProject(proj)?.orgId)||t.orgId, project:proj, date:d,
      supplier:counterparty, deliveryNote:t.id, material:t.resourceName, unit:t.unit,
      qtyOrdered:signedQty, qtyReceived:signedQty, unitCost:+unitCost.toFixed(4),
      total:+(signedQty*unitCost).toFixed(2), boqCode:'', receivedBy:who, invoiceNo:'',
      status:statusLabel, createdBy:(S.user?.id||'')
    });
    const outRec = mk(t.fromProject, -qty, 'Transfer Out', '[Transfer → '+t.toProject+']');
    const inRec  = mk(t.toProject,    qty, 'Transfer In',  '[Transfer ← '+t.fromProject+']');
    DB.save('grn', outRec); DB.save('grn', inRec);
    if(!S.isDemo && S.scriptUrl){
      GAS.post({action:'save', sheet:'GRN', record:outRec}).catch(()=>{});
      GAS.post({action:'save', sheet:'GRN', record:inRec}).catch(()=>{});
    }
  },

  reject(id) {
    const t = this._all().find(x=>x.id===id);
    if(!t || !this._canReceive(t)){ toast('This transfer cannot be rejected here','err'); return; }
    Modal.open('Reject transfer',
      `<label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Reason</label>
       <textarea id="tf-rej" class="finput" style="width:100%;min-height:60px" placeholder="Why is this being rejected?"></textarea>`,
      [{label:'Confirm Reject',cls:'red',fn:()=>{
          t.status='rejected'; t.rejectReason=ge('tf-rej')?.value||'';
          t.receivedBy=S.user?.name||S.user?.id||''; t.receivedAt=new Date().toISOString();
          DB.save('transfers',t);
          Transfers._lsSave(t);
          if(!S.isDemo && S.scriptUrl) GAS.post({action:'save',sheet:'Transfers',record:t}).catch(()=>{});
          Modal.close(); toast('Transfer rejected','info'); Transfers.render();
        }},
       {label:'Back',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  },

  cancel(id) {
    const t = this._all().find(x=>x.id===id);
    if(!t || !this._canCancel(t)){ toast('Only the sending project can cancel a pending transfer','err'); return; }
    t.status='cancelled';
    DB.save('transfers',t);
    this._lsSave(t);
    if(!S.isDemo && S.scriptUrl) GAS.post({action:'save',sheet:'Transfers',record:t}).catch(()=>{});
    toast('Transfer cancelled','info'); this.render();
  },
};
const PlantReports = {
  // Resolve a plant's inventory record tolerantly (trim + case-insensitive on
  // regId), searching the current project first then any loaded inventory.
  // This is why "Min Hrs/Day" was falling back to 8 — a regId case/whitespace
  // mismatch or out-of-project inventory made the exact-match lookup miss.
  _pi(regId) {
    const key = String(regId||'').trim().toLowerCase();
    if(!key) return null;
    const match = x => String(x.regId||'').trim().toLowerCase() === key;
    return (DB.get('plantInventory', S.project)||[]).find(match)
        || (DB.plantInventory||[]).find(match)
        || null;
  },
  // Min Hrs/Day for a plant — the value set on the Plant & Equipment Inventory.
  // No default is applied: a blank/unset value reads as 0, and an explicit 0
  // stays 0.
  _minHrs(regId) {
    const pi = this._pi(regId);
    if(!pi) return 0;
    const v = parseFloat(pi.minHours);
    return isFinite(v) ? v : 0;
  },
  // Min Hrs/Day on rainy (inclement-weather) days — separate contractual minimum.
  // No default: blank/unset reads as 0, explicit 0 stays 0.
  _minHrsRainy(regId) {
    const pi = this._pi(regId);
    if(!pi) return 0;
    const v = parseFloat(pi.minHoursRainy);
    return isFinite(v) ? v : 0;
  },
  open() {
    const plant = DB.get('plant', S.project) || [];
    const inv   = DB.get('plantInventory', S.project) || [];
    const fuel  = DB.get('fuelIssues', S.project) || [];
    const normD = v => v ? String(v).slice(0,10) : '';
    const fmtD  = v => v ? new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const fmtE  = v => 'E '+parseFloat(v||0).toFixed(2);

    // Get unique equipment list & date range
    const regIds  = [...new Set(plant.map(p=>p.regId).filter(Boolean))].sort();
    const dates   = plant.map(p=>normD(p.date)).filter(Boolean).sort();
    const minDate = dates[0]||'', maxDate = dates[dates.length-1]||'';

    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;align-items:flex-end">
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">FROM</label>
          <input type="date" id="rpt-from" value="${minDate}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">TO</label>
          <input type="date" id="rpt-to" value="${maxDate}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">EQUIPMENT</label>
          <select id="rpt-equip" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px">
            <option value="ALL">All Equipment</option>
            ${regIds.map(r=>`<option value="${r}">${r}</option>`).join('')}
          </select></div>
        <div style="display:flex;gap:6px">
          <button onclick="PlantReports.run(1)" style="background:var(--amber);color:#000;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Hourly Analysis</button>
          <button onclick="PlantReports.run(2)" style="background:var(--blue);color:#fff;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Cost &amp; Production</button>
          <button onclick="PlantReports.run(3)" style="background:var(--green);color:#000;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Full Report</button>
          <button onclick="PlantReports.run(4)" style="background:var(--red);color:#fff;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">📉 Loss Analysis</button>
        </div>
      </div>
      <div id="rpt-output" style="max-height:65vh;overflow-y:auto"></div>`;

    Modal.open('📊 Plant Usage Records — Reports', html,
      [{label:'🖨 Print',cls:'amber',fn:()=>PlantReports.print()},{label:'📥 Export CSV',cls:'ghost',fn:()=>PlantReports.exportCSV()},{label:'📊 Export Excel',cls:'ghost',fn:()=>PlantReports.exportExcel()},
       {label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)}],{fullscreen:true});
    setTimeout(()=>PlantReports.run(1),50);
  },

  _filter() {
    const plant = DB.get('plant',S.project)||[];
    const normD = v=>v?String(v).slice(0,10):'';
    const from  = document.getElementById('rpt-from')?.value||'';
    const to    = document.getElementById('rpt-to')?.value||'';
    const eq    = document.getElementById('rpt-equip')?.value||'ALL';
    return plant.filter(p=>{
      const d=normD(p.date);
      if(from&&d<from) return false;
      if(to&&d>to)     return false;
      if(eq!=='ALL'&&p.regId!==eq) return false;
      return true;
    });
  },

  _hrs(p) {
    if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)
      return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);
    if(p.hrsWorked) return parseFloat(p.hrsWorked)||0;
    if(p.activityStart&&p.activityEnd){
      const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);
      return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;
    }
    return 0;
  },

  _activeType: 1,
  run(type) {
    this._activeType=type;
    const data = this._filter();
    const el   = document.getElementById('rpt-output');
    if(!el) return;
    if(!data.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">No records in selected range</div>';return;}
    if(type===1) el.innerHTML = this._hourlyReport(data);
    if(type===2) el.innerHTML = this._costReport(data);
    if(type===3) el.innerHTML = this._fullReport(data);
    if(type===4) el.innerHTML = this._lossReport(data);
  },

  _hourlyReport(data) {
    var _h=function(p){if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){var s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    var normD=function(v){return v?String(v).slice(0,10):''};
    var fmtD=function(v){return v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'--';};
    var inv=DB.get('plantInventory',S.project)||[];
    var byReg={};
    data.forEach(function(p){if(!byReg[p.regId])byReg[p.regId]={type:p.equipment||p.type||'--',records:[]};byReg[p.regId].records.push(p);});
    var _bdH=function(p){
      if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime) return 0;
      var s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);
      return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;
    };
    var html='<div style="display:flex;flex-direction:column;gap:28px">';
    Object.keys(byReg).sort().forEach(function(regId){
      var grp=byReg[regId];
      var pi=PlantReports._pi(regId);
      var minHrs=PlantReports._minHrs(regId);
      var recs=grp.records.slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))||String(a.activityStart||'').localeCompare(String(b.activityStart||''));});
      var days=[...new Set(recs.map(function(p){return normD(p.date);}))].sort();
      var totW=recs.reduce(function(s,p){return s+_h(p);}.bind(this),0);
      var totI=recs.reduce(function(s,p){return s+parseFloat(p.idleHrs||0);},0);
      var totIW=recs.reduce(function(s,p){return s+parseFloat(p.incWeather||0);},0);
      var totBd=recs.reduce(function(s,p){return s+_bdH(p);},0);
      var utilDenom=Math.max(0.01,days.length*minHrs-totIW-totBd);
      var util=minHrs>0?totW/utilDenom*100:0;
      var uC=util>=80?'var(--green)':util>=50?'var(--amber)':'var(--red)';
      var dateGroups={};
      recs.forEach(function(p){var d=normD(p.date);if(!dateGroups[d])dateGroups[d]=[];dateGroups[d].push(p);});

      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">';
      html+='<div style="padding:12px 16px;background:linear-gradient(90deg,rgba(240,165,0,.15) 0%,transparent);border-bottom:2px solid var(--amber);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">';
      html+='<div style="display:flex;align-items:center;gap:12px">';
      html+='<span style="font-family:var(--fh);font-size:20px;font-weight:700;color:var(--amber)">'+regId+'</span>';
      html+='<span style="color:var(--text2);font-size:13px">'+grp.type+'</span>';
      html+='<span style="background:var(--amber-dim);color:var(--amber);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+days.length+' days | '+recs.length+' activities</span></div>';
      html+='<div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap">';
      html+='<span>Total <b style="color:var(--amber)">'+totW.toFixed(2)+'h</b></span>';
      html+='<span>Avg <b>'+(totW/days.length).toFixed(2)+'h/day</b></span>';
      html+='<span>Idle <b>'+totI.toFixed(1)+'h</b></span>';
      html+='<span>InclWx <b style="color:var(--blue)">'+totIW.toFixed(1)+'h</b></span>';
      html+='<span>BD <b style="color:var(--red)">'+totBd.toFixed(1)+'h</b></span>';
      html+='<span>Util <b style="color:'+uC+'">'+util.toFixed(1)+'%</b></span></div></div>';
      html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
      html+='<thead><tr style="background:var(--surface2)">';
      html+='<th style="padding:7px 10px;text-align:left;border:1px solid var(--border)">Date</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border)">Hr Open</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border)">Hr Close</th>';
      html+='<th style="padding:7px 10px;text-align:center;border:1px solid var(--border)">Start</th>';
      html+='<th style="padding:7px 10px;text-align:center;border:1px solid var(--border)">End</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border);color:var(--text2)">Act.Hrs</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border);color:var(--blue)">Hrs Worked</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border);color:var(--amber)">Total Hrs/Day</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border)">Idle</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border);color:var(--blue)">Incl.Wx (hrs)</th>';
      html+='<th style="padding:7px 10px;text-align:center;border:1px solid var(--border);color:var(--red)">Breakdown</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border)">Min Hrs/Day</th>';
      html+='<th style="padding:7px 10px;text-align:right;border:1px solid var(--border)">Utilisation</th>';
      html+='<th style="padding:7px 10px;text-align:left;border:1px solid var(--border)">Activity</th>';
      html+='<th style="padding:7px 10px;text-align:left;border:1px solid var(--border)">Remarks</th>';
      html+='</tr></thead><tbody>';

      days.forEach(function(d){
        var dr=dateGroups[d]||[];
        var span=dr.length;
        var dayW=dr.reduce(function(s,p){return s+_h(p);}.bind(this),0);
        var dayIW=dr.reduce(function(s,p){return s+parseFloat(p.incWeather||0);},0);
        var dayBd=dr.reduce(function(s,p){return s+_bdH(p);},0);
        var dDen=Math.max(0.01,minHrs-dayIW-dayBd);
        var dUtil=dayW/dDen*100;
        var dC=dUtil>=80?'var(--green)':dUtil>=50?'var(--amber)':'var(--red)';
        dr.forEach(function(p,ri){
          var hrs=_h(p);
          var actH='--';
          if(p.activityStart&&p.activityEnd){
            var s2=p.activityStart.split(':').map(Number),e2=p.activityEnd.split(':').map(Number);
            var h=Math.max(0,(e2[0]*60+(e2[1]||0))-(s2[0]*60+(s2[1]||0)))/60;
            actH=h>0?h.toFixed(2)+'h':'--';
          }
          var bdH=_bdH(p);
          var isF=ri===0;
          html+='<tr style="border-bottom:1px solid var(--border)">';
          if(isF) html+='<td style="padding:5px 10px;border:1px solid var(--border);font-weight:600;vertical-align:middle;background:rgba(240,165,0,.04)" rowspan="'+span+'">'+fmtD(d)+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right">'+(p.hrOpening!=null?parseFloat(p.hrOpening).toFixed(1):'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right">'+(p.hrClosing!=null?parseFloat(p.hrClosing).toFixed(1):'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:center;font-family:monospace">'+(p.activityStart||'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:center;font-family:monospace">'+(p.activityEnd||'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;color:var(--text2)">'+actH+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--blue)">'+hrs.toFixed(2)+'h</td>';
          if(isF) html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--amber);vertical-align:middle" rowspan="'+span+'">'+dayW.toFixed(2)+'h</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right">'+parseFloat(p.idleHrs||0).toFixed(1)+'h</td>';
          if(isF) html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;color:var(--blue);vertical-align:middle" rowspan="'+span+'">'+(dayIW>0?dayIW.toFixed(1)+'h':'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:center;color:'+(p.breakdown==='Yes'?'var(--red)':'var(--green)')+'">'+( p.breakdown==='Yes'?('X '+bdH.toFixed(1)+'h'):'OK')+'</td>';
          if(isF) html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;vertical-align:middle;color:var(--text3)" rowspan="'+span+'">'+minHrs+'h</td>';
          if(isF) html+='<td style="padding:5px 10px;border:1px solid var(--border);text-align:right;font-weight:700;vertical-align:middle;color:'+dC+';font-size:13px" rowspan="'+span+'">'+dUtil.toFixed(1)+'%</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);font-size:10px;color:var(--text2)">'+(p.activityCode||p.activityDesc||'--')+'</td>';
          html+='<td style="padding:5px 10px;border:1px solid var(--border);font-size:10px;color:var(--text2);max-width:160px;white-space:normal">'+(p.remarks?String(p.remarks).replace(/</g,'&lt;'):'--')+'</td>';
          html+='</tr>';
        }.bind(this));
      }.bind(this));

      html+='<tr style="background:rgba(240,165,0,.08);font-weight:700;border-top:2px solid var(--amber)">';
      html+='<td style="padding:6px 10px;border:1px solid var(--border)">TOTAL ('+recs.length+')</td>';
      html+='<td colspan="5" style="padding:6px 10px;border:1px solid var(--border)"></td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:var(--amber)">'+totW.toFixed(2)+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:var(--amber)">'+totW.toFixed(2)+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right">'+totI.toFixed(1)+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:var(--blue)">'+totIW.toFixed(1)+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:center;color:var(--red)">'+totBd.toFixed(1)+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right">'+minHrs+'h</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:'+uC+'">'+util.toFixed(1)+'%</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border);font-size:10px;color:var(--text3)">Util=TotHrs/((MinHrs-IW)-BD)</td>';
      html+='<td style="padding:6px 10px;border:1px solid var(--border)"></td>';
      html+='</tr></tbody></table></div></div>';
    });
    return html+'</div>';
  },

  _costReport(data) {
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const inv  = DB.get('plantInventory',S.project)||[];
    const fuel = DB.get('fuelIssues',S.project)||[];

    const _fuelRate=(regId)=>{
      const rf=fuel.filter(f=>f.regId===regId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      if(rf.length<2) return 0;
      const lastD=new Date((normD(rf[rf.length-1].date)||'2000-01-01')+'T00:00:00');
      const wkS=new Date(lastD.getTime()-7*24*60*60*1000);
      const wkF=rf.filter(f=>{const fd=new Date((normD(f.date)||'2000-01-01')+'T00:00:00');return fd>=wkS&&fd<=lastD;});
      if(wkF.length<2) return 0;
      const wc=wkF.reduce((s,f)=>s+parseFloat(f.cost||0),0);
      const od=wkF.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);
      if(od.length<2) return 0;
      const rng=Math.max(...od)-Math.min(...od);
      return rng>=0.5?wc/rng:0;
    };

    const byReg={};
    data.forEach(p=>{
      if(!byReg[p.regId]) byReg[p.regId]={type:p.equipment||p.type||'—',records:[]};
      byReg[p.regId].records.push(p);
    });

    let html='<div style="display:flex;flex-direction:column;gap:20px">';

    // Summary card across all equipment
    const grandTotals={plantCost:0,fuelCost:0,hrs:0};

    Object.entries(byReg).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([regId,grp])=>{
      const pi=PlantReports._pi(regId);
      const fuelRate=_fuelRate(regId);
      const rType=pi?.rateType||'per_hr';
      let totPlant=0,totFuel=0,totHrs=0;

      const rows=grp.records.map(p=>{
        const hrs=_h(p);
        const baseRate=p.weather&&/rain/i.test(p.weather)?parseFloat(pi?.minRateRainy||pi?.minRate||0):parseFloat(pi?.minRate||0);
        // per_day: get total day hrs
        const allDay=data.filter(x=>x.regId===regId&&normD(x.date)===normD(p.date));
        const totDayH=allDay.reduce((s,x)=>s+this._hrs(x),0)||1;
        const effRate=rType==='per_day'?baseRate/totDayH:rType==='per_week'?baseRate/(5*totDayH):rType==='per_month'?baseRate/(22*totDayH):baseRate;
        const plantCost=hrs*effRate;
        const fuelCost=fuelRate>0?fuelRate*hrs:0;
        totPlant+=plantCost; totFuel+=fuelCost; totHrs+=hrs;
        return {p,hrs,plantCost,fuelCost,total:plantCost+fuelCost,baseRate,rType};
      });
      grandTotals.plantCost+=totPlant; grandTotals.fuelCost+=totFuel; grandTotals.hrs+=totHrs;
      const totCost=totPlant+totFuel;
      const cph=totHrs>0?totCost/totHrs:0;

      html+=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:linear-gradient(90deg,rgba(59,130,246,.12) 0%,transparent);border-bottom:2px solid var(--blue);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-family:var(--fh);font-size:16px;font-weight:700;color:var(--blue)">${regId}</span>
            <span style="color:var(--text2);font-size:12px">${grp.type}</span>
            <span style="font-size:10px;color:var(--text3)">${rType.replace('per_','E/').replace('agreed','Fixed')}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:11px;flex-wrap:wrap">
            <span>⏱ <b>${totHrs.toFixed(2)}h</b></span>
            <span style="color:var(--blue)">🏗 Plant <b>E ${totPlant.toFixed(2)}</b></span>
            <span style="color:var(--orange)">⛽ Fuel <b>E ${totFuel.toFixed(2)}</b></span>
            <span style="color:#a78bfa">💰 Total <b>E ${totCost.toFixed(2)}</b></span>
            <span style="color:var(--text2)">E/hr <b>${cph.toFixed(2)}</b></span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Date</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Activity</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Hrs</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Rate</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Plant Cost (E)</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Fuel Cost (E)</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Total (E)</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">E/hr</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Remarks</th>
          </tr></thead>
          <tbody>
            ${rows.map(({p,hrs,plantCost,fuelCost,total,baseRate,rType})=>`
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:5px 10px">${fmtD(normD(p.date))}</td>
              <td style="padding:5px 10px;color:var(--text2);font-size:10px">${p.activityCode||p.activityDesc||'—'}</td>
              <td style="padding:5px 10px;text-align:right;font-weight:700">${hrs.toFixed(2)}h</td>
              <td style="padding:5px 10px;text-align:right;font-size:10px;color:var(--text2)">E${baseRate.toFixed(0)}/${rType.replace('per_','')}</td>
              <td style="padding:5px 10px;text-align:right;color:var(--blue)">E ${plantCost.toFixed(2)}</td>
              <td style="padding:5px 10px;text-align:right;color:var(--orange)">E ${fuelCost.toFixed(2)}</td>
              <td style="padding:5px 10px;text-align:right;font-weight:700;color:#a78bfa">E ${total.toFixed(2)}</td>
              <td style="padding:5px 10px;text-align:right;color:var(--text2)">${hrs>0?(total/hrs).toFixed(2):'—'}</td>
              <td style="padding:5px 10px;font-size:10px;color:var(--text2);max-width:160px;white-space:normal">${p.remarks?String(p.remarks).replace(/</g,'&lt;'):'—'}</td>
            </tr>`).join('')}
            <tr style="background:rgba(59,130,246,.06);font-weight:700;border-top:2px solid var(--blue)">
              <td colspan="2" style="padding:6px 10px">TOTAL</td>
              <td style="padding:6px 10px;text-align:right;color:var(--amber)">${totHrs.toFixed(2)}h</td>
              <td style="padding:6px 10px"></td>
              <td style="padding:6px 10px;text-align:right;color:var(--blue)">E ${totPlant.toFixed(2)}</td>
              <td style="padding:6px 10px;text-align:right;color:var(--orange)">E ${totFuel.toFixed(2)}</td>
              <td style="padding:6px 10px;text-align:right;color:#a78bfa">E ${totCost.toFixed(2)}</td>
              <td style="padding:6px 10px;text-align:right">${totHrs>0?cph.toFixed(2):'—'}</td>
              <td style="padding:6px 10px"></td>
            </tr>
          </tbody>
        </table></div>`;
    });

    // Grand Summary
    const gTotal=grandTotals.plantCost+grandTotals.fuelCost;
    html+=`<div style="background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(167,139,250,.1));border:2px solid var(--blue);border-radius:8px;padding:14px 16px">
      <div style="font-family:var(--fh);font-size:14px;font-weight:700;margin-bottom:10px;color:var(--blue)">📊 GRAND SUMMARY</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div><div style="font-size:10px;color:var(--text3)">TOTAL HOURS</div><div style="font-size:20px;font-weight:700;color:var(--amber)">${grandTotals.hrs.toFixed(2)}h</div></div>
        <div><div style="font-size:10px;color:var(--text3)">PLANT COST</div><div style="font-size:20px;font-weight:700;color:var(--blue)">E ${grandTotals.plantCost.toFixed(2)}</div></div>
        <div><div style="font-size:10px;color:var(--text3)">FUEL COST</div><div style="font-size:20px;font-weight:700;color:var(--orange)">E ${grandTotals.fuelCost.toFixed(2)}</div></div>
        <div><div style="font-size:10px;color:var(--text3)">GRAND TOTAL</div><div style="font-size:20px;font-weight:700;color:#a78bfa">E ${gTotal.toFixed(2)}</div></div>
        <div><div style="font-size:10px;color:var(--text3)">FUEL % OF TOTAL</div><div style="font-size:20px;font-weight:700;color:var(--orange)">${gTotal>0?(grandTotals.fuelCost/gTotal*100).toFixed(1):'0'}%</div></div>
      </div>
    </div>`;
    return html+'</div>';
  },


  _printCost() {
    const data=this._filter();
    if(!data.length){alert('No records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const inv=DB.get('plantInventory',S.project)||[];
    const fuel=DB.get('fuelIssues',S.project)||[];
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project;
    const contractNo=_proj.contractNo||S.project;
    const from=document.getElementById('rpt-from')?.value||'';
    const to=document.getElementById('rpt-to')?.value||'';
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const _fuelRate=regId=>{const rf=fuel.filter(f=>f.regId===regId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(rf.length<2)return 0;const ld=new Date((normD(rf[rf.length-1].date)||'2000-01-01')+'T00:00:00');const ws=new Date(ld.getTime()-7*24*60*60*1000);const wf=rf.filter(f=>{const fd=new Date((normD(f.date)||'2000-01-01')+'T00:00:00');return fd>=ws&&fd<=ld;});if(wf.length<2)return 0;const wc=wf.reduce((s,f)=>s+parseFloat(f.cost||0),0);const od=wf.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);if(od.length<2)return 0;const rng=Math.max(...od)-Math.min(...od);return rng>=0.5?wc/rng:0;};
    const byReg={};
    data.forEach(p=>{if(!byReg[p.regId])byReg[p.regId]=[];byReg[p.regId].push(p);});
    let pages='';
    const _pp=Object.keys(byReg).sort();_pp.forEach((regId,_i)=>{
      const recs=byReg[regId].slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const pi=PlantReports._pi(regId)||{};
      const fuelRate=_fuelRate(regId);
      const rateType=pi.rateType||'per_hr';
      const isPerDay=rateType!=='per_hr';
      const minHrs=PlantReports._minHrs(regId);
      const rainyMin=PlantReports._minHrsRainy(regId);
      const _byDate={};recs.forEach(p=>{const d=normD(p.date);(_byDate[d]=_byDate[d]||[]).push(p);});
      const _dayInfo={};let totAgreedQty=0;
      Object.keys(_byDate).forEach(d=>{const dr=_byDate[d];const dHrs=dr.reduce((s,x)=>s+_h(x),0);const dDown=dr.reduce((s,x)=>s+_bdH(x),0);const dIW=dr.reduce((s,x)=>s+parseFloat(x.incWeather||0),0);const dRainy=dIW>0,dDisrupted=dDown>0||dIW>0;const dMinFor=dRainy?rainyMin:minHrs;let qty;if(dHrs>0){if(isPerDay)qty=dDisrupted?(dMinFor>0?Math.min(1,dHrs/dMinFor):0):1;else qty=(dDown>0&&dIW<=0)?dHrs:Math.max(dHrs,dMinFor);}else{qty=(dRainy&&rainyMin>0)?(isPerDay?1:rainyMin):0;}const dayFactor=isPerDay?qty:(dHrs>0?qty/dHrs:0);_dayInfo[d]={dHrs,dRainy,qty,dayFactor,count:dr.length};totAgreedQty+=qty;});
      let gtPlant=0,gtFuel=0,gtHrs=0;
      const rows=recs.map((p,i)=>{
        const hrs=_h(p);
        const isRainy=p.weather&&/rain|storm|thunder/i.test(p.weather);
        const baseRate=isRainy?parseFloat(pi.minRateRainy||pi.minRate||0):parseFloat(pi.minRate||0);
        const allDay=recs.filter(x=>normD(x.date)===normD(p.date));
        const totDH=allDay.reduce((s,x)=>s+_h(x),0)||1;
        const effR=rateType==='per_day'?baseRate/totDH:rateType==='per_week'?baseRate/(5*totDH):rateType==='per_month'?baseRate/(22*totDH):baseRate;
        const _di=_dayInfo[normD(p.date)]||{dHrs:0,qty:0,dayFactor:1,count:1};
        const pCost=(_di.dHrs>0)?(hrs*effR*_di.dayFactor):((_di.qty>0)?(_di.qty*baseRate/_di.count):0);
        const fCost=fuelRate>0?fuelRate*hrs:0;
        const tot=pCost+fCost;
        gtPlant+=pCost;gtFuel+=fCost;gtHrs+=hrs;
        const bdH=_bdH(p);
        return '<tr style="background:'+(i%2?'#f9f9f9':'#fff')+'">'
          +'<td>'+fmtD(normD(p.date))+'</td>'
          +'<td>'+(p.activityCode||p.activityDesc||'—')+'</td>'
          +'<td style="text-align:right;font-weight:700">'+hrs.toFixed(2)+'h</td>'
          +'<td style="text-align:right;font-size:9px">E'+parseFloat(baseRate).toFixed(0)+'/'+rateType.replace('per_','')+'</td>'
          +'<td style="text-align:right;color:#1a56db">E '+pCost.toFixed(2)+'</td>'
          +'<td style="text-align:right;color:#c85000">E '+fCost.toFixed(2)+'</td>'
          +'<td style="text-align:right;font-weight:700;color:#7e22ce">E '+tot.toFixed(2)+'</td>'
          +'<td style="text-align:right;color:#555">'+(hrs>0?'E '+(tot/hrs).toFixed(2):'—')+'</td>'
          +'<td style="text-align:center;color:'+(bdH>0?'#c00':'#16a34a')+'">'+(bdH>0?'⚠ '+bdH.toFixed(1)+'h':'✓')+'</td>'
          +'<td style="text-align:right;color:#0070c0">'+(parseFloat(p.incWeather||0)>0?parseFloat(p.incWeather).toFixed(1)+'h':'—')+'</td>'
          +'<td style="font-size:9px;color:#555">'+(p.weather||'—')+'</td>'
          +'<td style="font-size:9px;color:#555;max-width:160px;white-space:normal">'+(p.remarks?String(p.remarks).replace(/</g,'&lt;'):'—')+'</td>'
          +'</tr>';
      });
      const gtTot=gtPlant+gtFuel;
      const util=(gtHrs>0&&recs.length*PlantReports._minHrs(regId)>0)?((gtHrs/(recs.length*PlantReports._minHrs(regId)))*100):0;
      const _totBd=recs.reduce((s,p)=>s+_bdH(p),0);
      const avail=gtHrs>0?((gtHrs-_totBd)/gtHrs*100):0;
      pages+='<div class="page">'
        +ReportSettings.header(projName,contractNo,from,to,regId,pi,util,avail,'Cost & Production Report','plant_usage_report','Page '+(_i+1)+' of '+_pp.length)
        +this._kpis([['Agreed '+(isPerDay?'Days':'Hrs'),totAgreedQty.toFixed(2),'#16a34a'],['Plant Cost (E)','E '+gtPlant.toFixed(2),'#1a56db'],['Fuel Cost (E)','E '+gtFuel.toFixed(2),'#c85000'],['Grand Total (E)','E '+gtTot.toFixed(2),'#7e22ce']])
        +'<div style="margin:8px 0 6px;font-size:10px;font-weight:700;color:#555;border-bottom:1px solid #ccc;padding-bottom:3px">COST & PRODUCTION BREAKDOWN — '+regId+' ('+( recs[0]?.equipment||recs[0]?.type||regId)+')</div>'
        +'<table class="data-table">'
        +'<thead><tr>'
        +'<th>Date</th><th>Activity</th><th>Hrs Worked</th><th>Rate</th>'
        +'<th style="color:#bfdbfe">Plant Cost (E)</th><th style="color:#fed7aa">Fuel Cost (E)</th>'
        +'<th style="color:#e9d5ff">Total (E)</th><th>E/hr</th>'
        +'<th>Breakdown</th><th>Incl.Wx</th><th>Weather</th><th>Remarks</th>'
        +'</tr></thead>'
        +'<tbody>'+rows.join('')+'</tbody>'
        +'<tfoot><tr class="rpt-total">'
        +'<td colspan="2">TOTALS ('+recs.length+' activities)</td>'
        +'<td style="text-align:right">'+gtHrs.toFixed(2)+'h</td>'
        +'<td></td>'
        +'<td style="text-align:right;color:#1a56db">E '+gtPlant.toFixed(2)+'</td>'
        +'<td style="text-align:right;color:#c85000">E '+gtFuel.toFixed(2)+'</td>'
        +'<td style="text-align:right;font-weight:900;color:#7e22ce">E '+gtTot.toFixed(2)+'</td>'
        +'<td style="text-align:right">'+(gtHrs>0?'E '+(gtTot/gtHrs).toFixed(2):'—')+'</td>'
        +'<td colspan="4" style="text-align:right;font-size:9px">Fuel: '+(gtTot>0?(gtFuel/gtTot*100).toFixed(1):0)+'% of total cost</td>'
        +'</tr></tfoot>'
        +'</table>'
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px">'
        +[['Total Hours',gtHrs.toFixed(2)+'h','#c85000'],['Plant Cost','E '+gtPlant.toFixed(2),'#1a56db'],['Fuel Cost','E '+gtFuel.toFixed(2),'#c85000'],['Grand Total','E '+gtTot.toFixed(2),'#7e22ce']].map(([l,v,col])=>'<div style="border:1px solid #ccc;border-radius:4px;padding:6px 10px;text-align:center"><div style="font-size:8px;color:#555;text-transform:uppercase">'+l+'</div><div style="font-size:14px;font-weight:700;color:'+col+'">'+v+'</div></div>').join('')
        +'</div>'
        +'</div>';
    });
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Cost & Production Report</title><style>'+ReportSettings.css('plant_usage_report')+'</style></head><body>'+pages+'</body></html>');
    w.document.close();setTimeout(()=>w.print(),300);
  },

  _printFull() {
    const data=this._filter();
    if(!data.length){alert('No records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const inv=DB.get('plantInventory',S.project)||[];
    const fuel=DB.get('fuelIssues',S.project)||[];
    const meas=DB.get('dailyMeasurements',S.project)||[];
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project;
    const contractNo=_proj.contractNo||S.project;
    const from=document.getElementById('rpt-from')?.value||'';
    const to=document.getElementById('rpt-to')?.value||'';
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const _fuelRate=regId=>{const rf=fuel.filter(f=>f.regId===regId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(rf.length<2)return 0;const ld=new Date((normD(rf[rf.length-1].date)||'2000-01-01')+'T00:00:00');const ws=new Date(ld.getTime()-7*24*60*60*1000);const wf=rf.filter(f=>{const fd=new Date((normD(f.date)||'2000-01-01')+'T00:00:00');return fd>=ws&&fd<=ld;});if(wf.length<2)return 0;const wc=wf.reduce((s,f)=>s+parseFloat(f.cost||0),0);const od=wf.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);if(od.length<2)return 0;const rng=Math.max(...od)-Math.min(...od);return rng>=0.5?wc/rng:0;};
    const byReg={};
    data.forEach(p=>{if(!byReg[p.regId])byReg[p.regId]=[];byReg[p.regId].push(p);});
    let pages='';
    const _pp=Object.keys(byReg).sort();_pp.forEach((regId,_i)=>{
      const recs=byReg[regId].slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const pi=PlantReports._pi(regId)||{};
      const fuelRate=_fuelRate(regId);
      const rateType=pi.rateType||'per_hr';
      const isPerDay=rateType!=='per_hr';
      const minHrs=PlantReports._minHrs(regId);
      const rainyMin=PlantReports._minHrsRainy(regId);
      const _byDate={};recs.forEach(p=>{const d=normD(p.date);(_byDate[d]=_byDate[d]||[]).push(p);});
      const _dayInfo={};let totAgreedQty=0;
      Object.keys(_byDate).forEach(d=>{const dr=_byDate[d];const dHrs=dr.reduce((s,x)=>s+_h(x),0);const dDown=dr.reduce((s,x)=>s+_bdH(x),0);const dIW=dr.reduce((s,x)=>s+parseFloat(x.incWeather||0),0);const dRainy=dIW>0,dDisrupted=dDown>0||dIW>0;const dMinFor=dRainy?rainyMin:minHrs;let qty;if(dHrs>0){if(isPerDay)qty=dDisrupted?(dMinFor>0?Math.min(1,dHrs/dMinFor):0):1;else qty=(dDown>0&&dIW<=0)?dHrs:Math.max(dHrs,dMinFor);}else{qty=(dRainy&&rainyMin>0)?(isPerDay?1:rainyMin):0;}const dayFactor=isPerDay?qty:(dHrs>0?qty/dHrs:0);_dayInfo[d]={dHrs,dRainy,qty,dayFactor,count:dr.length};totAgreedQty+=qty;});
      let gtHrs=0,gtPlant=0,gtFuel=0,gtTot=0;
      const _totBd=recs.reduce((s,p)=>s+_bdH(p),0);
      const rows=recs.map((p,i)=>{
        const hrs=_h(p);
        const isRainy=p.weather&&/rain|storm|thunder/i.test(p.weather);
        const baseRate=isRainy?parseFloat(pi.minRateRainy||pi.minRate||0):parseFloat(pi.minRate||0);
        const allDay=recs.filter(x=>normD(x.date)===normD(p.date));
        const totDH=allDay.reduce((s,x)=>s+_h(x),0)||1;
        const effR=rateType==='per_day'?baseRate/totDH:rateType==='per_week'?baseRate/(5*totDH):rateType==='per_month'?baseRate/(22*totDH):baseRate;
        const _di=_dayInfo[normD(p.date)]||{dHrs:0,qty:0,dayFactor:1,count:1};
        const pCost=(_di.dHrs>0)?(hrs*effR*_di.dayFactor):((_di.qty>0)?(_di.qty*baseRate/_di.count):0);
        const fCost=fuelRate>0?fuelRate*hrs:0;
        const tot=pCost+fCost;
        gtHrs+=hrs;gtPlant+=pCost;gtFuel+=fCost;gtTot+=tot;
        const bdH=_bdH(p);
        const actKey=String(p.activityCode||p.activityDesc||'').trim().toLowerCase();
        const measMatch=meas.filter(m=>{
          if(normD(m.date)!==normD(p.date)||!actKey) return false;
          const mc=String(m.activityCode||'').trim().toLowerCase();
          const md=String(m.activityDescription||'').trim().toLowerCase();
          return mc===actKey||md===actKey;
        });
        const finalQty=measMatch.length?measMatch.reduce((s,m)=>s+parseFloat(String(m.totalQty||0)),0):null;
        const ratePerUnit=finalQty&&finalQty>0&&tot>0?(tot/finalQty):null;
        return '<tr style="background:'+(i%2?'#f9f9f9':'#fff')+';font-size:8.5px">'
          +'<td>'+fmtD(normD(p.date))+'</td>'
          +'<td style="font-family:monospace">'+regId+'</td>'
          +'<td style="text-align:right">'+(p.hrOpening!=null?parseFloat(p.hrOpening).toFixed(1):'—')+'</td>'
          +'<td style="text-align:right">'+(p.hrClosing!=null?parseFloat(p.hrClosing).toFixed(1):'—')+'</td>'
          +'<td style="text-align:center;font-family:monospace">'+(p.activityStart||'—')+'</td>'
          +'<td style="text-align:center;font-family:monospace">'+(p.activityEnd||'—')+'</td>'
          +'<td style="text-align:right;font-weight:700;color:#1a56db">'+hrs.toFixed(2)+'h</td>'
          +'<td style="text-align:right;color:#555">'+(parseFloat(p.idleHrs||0)>0?parseFloat(p.idleHrs).toFixed(1)+'h':'—')+'</td>'
          +'<td style="text-align:right;color:#0070c0">'+(parseFloat(p.incWeather||0)>0?parseFloat(p.incWeather).toFixed(1)+'h':'—')+'</td>'
          +'<td style="text-align:center;color:'+(bdH>0?'#c00':'#16a34a')+'">'+(bdH>0?'⚠':'✓')+'</td>'
          +'<td style="font-size:8px;color:#555">'+(p.weather||'—')+'</td>'
          +'<td style="text-align:right;color:#1a56db">E '+pCost.toFixed(2)+'</td>'
          +'<td style="text-align:right;color:#c85000">E '+fCost.toFixed(2)+'</td>'
          +'<td style="text-align:right;font-weight:700;color:#7e22ce">E '+tot.toFixed(2)+'</td>'
          +'<td style="text-align:right;color:#16a34a">'+(finalQty!=null?finalQty.toFixed(2):'—')+'</td>'
          +'<td style="text-align:right;color:#16a34a">'+(ratePerUnit!=null?'E '+ratePerUnit.toFixed(2):'—')+'</td>'
          +'<td style="font-size:8px;color:#555">'+(p.activityCode||p.activityDesc||'—')+'</td>'
          +'<td style="font-size:8px;color:#555;max-width:140px;white-space:normal">'+(p.remarks?String(p.remarks).replace(/</g,'&lt;'):'—')+'</td>'
          +'</tr>';
      });
      const util=(gtHrs>0&&recs.length*PlantReports._minHrs(regId)>0)?((gtHrs/(recs.length*PlantReports._minHrs(regId)))*100):0;
      const avail=gtHrs>0?((gtHrs-_totBd)/gtHrs*100):0;
      pages+='<div class="page">'
        +ReportSettings.header(projName,contractNo,from,to,regId,pi,util,avail,'Full Report','plant_usage_report','Page '+(_i+1)+' of '+_pp.length)
        +'<div style="margin:8px 0 6px;font-size:10px;font-weight:700;color:#555;border-bottom:1px solid #ccc;padding-bottom:3px">FULL PLANT RECORD — '+regId+' ('+( recs[0]?.equipment||recs[0]?.type||regId)+') <span style="color:#16a34a">· Agreed '+(isPerDay?'Days':'Hrs')+': '+totAgreedQty.toFixed(2)+'</span></div>'
        +'<table class="data-table" style="font-size:8px">'
        +'<thead><tr>'
        +'<th>Date</th><th>Reg/ID</th><th>Hr Open</th><th>Hr Close</th>'
        +'<th>Start</th><th>End</th><th style="color:#bfdbfe">Hrs Worked</th>'
        +'<th>Idle</th><th style="color:#bae6fd">Incl.Wx</th><th>Breakdown</th><th>Weather</th>'
        +'<th style="color:#bfdbfe">Plant Cost</th><th style="color:#fed7aa">Fuel Cost</th>'
        +'<th style="color:#e9d5ff">Total (E)</th>'
        +'<th style="color:#bbf7d0">Final Qty</th><th style="color:#bbf7d0">E/unit</th>'
        +'<th>Activity</th><th>Remarks</th>'
        +'</tr></thead>'
        +'<tbody>'+rows.join('')+'</tbody>'
        +'<tfoot><tr style="background:#f0f0f0;font-weight:700;border-top:2px solid #333;font-size:9px">'
        +'<td colspan="6">TOTALS ('+recs.length+' records)</td>'
        +'<td style="text-align:right;color:#1a56db">'+gtHrs.toFixed(2)+'h</td>'
        +'<td colspan="4"></td>'
        +'<td style="text-align:right;color:#1a56db">E '+gtPlant.toFixed(2)+'</td>'
        +'<td style="text-align:right;color:#c85000">E '+gtFuel.toFixed(2)+'</td>'
        +'<td style="text-align:right;color:#7e22ce;font-weight:900">E '+gtTot.toFixed(2)+'</td>'
        +'<td colspan="4"></td>'
        +'</tr></tfoot>'
        +'</table>'
        +'</div>';
    });
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Full Plant Report</title><style>'+ReportSettings.css('plant_usage_report')+'</style></head><body>'+pages+'</body></html>');
    w.document.close();setTimeout(()=>w.print(),300);
  },



  _toCSV(headers, rows) {
    const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;};
    return [headers.map(esc).join(','),...rows.map(r=>r.map(esc).join(','))].join('\n');
  },

  _downloadFile(name, content, mime) {
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([content],{type:mime}));
    a.download=name; a.click(); URL.revokeObjectURL(a.href);
  },

  exportCSV() {
    const data=this._filter();
    if(!data.length){alert('No records to export');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const inv=DB.get('plantInventory',S.project)||[];
    const fuel=DB.get('fuelIssues',S.project)||[];
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const headers=['Date','Equipment','Reg/ID','Hr Open','Hr Close','Start','End','Hrs Worked','Idle Hrs','Incl Weather Hrs','Breakdown','Breakdown Hrs','Weather','Rate Type','Rate (E)','Plant Cost (E)','Fuel Cost (E)','Total (E)','E/hr','Status','Activity','Remarks'];
    const rows=data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(p=>{
      const pi=PlantReports._pi(p.regId)||{};
      const hrs=_h(p);
      const baseRate=p.weather&&/rain|storm/i.test(p.weather)?parseFloat(pi.minRateRainy||pi.minRate||0):parseFloat(pi.minRate||0);
      const rType=pi.rateType||'per_hr';
      const allDay=data.filter(x=>x.regId===p.regId&&normD(x.date)===normD(p.date));
      const totDH=allDay.reduce((s,x)=>s+_h(x),0)||1;
      const effR=rType==='per_day'?baseRate/totDH:rType==='per_week'?baseRate/(5*totDH):baseRate;
      const pCost=hrs*effR;
      const rf=fuel.filter(f=>f.regId===p.regId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      let fCost=0;
      if(rf.length>=2){const ld=new Date((normD(rf[rf.length-1].date)||'2000-01-01')+'T00:00:00');const ws=new Date(ld.getTime()-7*24*60*60*1000);const wf=rf.filter(f=>{const fd=new Date((normD(f.date)||'2000-01-01')+'T00:00:00');return fd>=ws&&fd<=ld;});if(wf.length>=2){const wc=wf.reduce((s,f)=>s+parseFloat(f.cost||0),0);const od=wf.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);if(od.length>=2){const rng=Math.max(...od)-Math.min(...od);if(rng>=0.5)fCost=(wc/rng)*hrs;}}}
      const tot=pCost+fCost;
      const bdH=_bdH(p);
      return [normD(p.date),p.equipment||p.type||'',p.regId,p.hrOpening??'',p.hrClosing??'',p.activityStart||'',p.activityEnd||'',hrs.toFixed(2),parseFloat(p.idleHrs||0).toFixed(1),parseFloat(p.incWeather||0).toFixed(1),p.breakdown||'No',bdH.toFixed(2),p.weather||'',rType,baseRate,pCost.toFixed(2),fCost.toFixed(2),tot.toFixed(2),hrs>0?(tot/hrs).toFixed(2):'',p.status||'',p.activityCode||p.activityDesc||'',p.remarks||''];
    });
    this._downloadFile('Plant_Usage_Records.csv',this._toCSV(headers,rows),'text/csv');
  },

  exportExcel() {
    if(typeof XLSX==='undefined'){alert('Excel library not loaded. Use CSV export instead.');return;}
    const data=this._filter();
    if(!data.length){alert('No records to export');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const inv=DB.get('plantInventory',S.project)||[];
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const headers=['Date','Equipment','Reg/ID','Hr Open','Hr Close','Start','End','Hrs Worked','Idle Hrs','Incl Weather','Breakdown','Weather','Rate (E)','Plant Cost (E)','Fuel Cost (E)','Total (E)','Activity','Remarks'];
    const aoa=[headers,...data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(p=>{const hrs=_h(p);return [normD(p.date),p.equipment||p.type||'',p.regId,p.hrOpening,p.hrClosing,p.activityStart||'',p.activityEnd||'',+hrs.toFixed(2),+parseFloat(p.idleHrs||0).toFixed(1),+parseFloat(p.incWeather||0).toFixed(1),p.breakdown||'No',p.weather||'',parseFloat((PlantReports._pi(p.regId)||{}).minRate||0),0,0,0,p.activityCode||p.activityDesc||'',p.remarks||''];})];
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb,ws,'Plant Usage');
    XLSX.writeFile(wb,'Plant_Usage_Records.xlsx');
  },

  _kpis(items) {
    return '<table class="kpi-table" style="width:100%;border-collapse:collapse;margin:6px 0 8px">'
      +'<tr>'+items.map(function(x){return '<th>'+x[0]+'</th>';}).join('')+'</tr>'
      +'<tr>'+items.map(function(x){return '<td style="color:'+x[2]+'">'+x[1]+'</td>';}).join('')+'</tr>'
      +'</table>';
  },

  _printWithHeader(content, reportTitle) {
    const data=this._filter();
    if(!data.length){alert('No records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const inv=DB.get('plantInventory',S.project)||[];
    const sched=DB.get('schedule',S.project)||{};
    const _halfDays=sched.halfDays||[];
    const _projStart=sched.dayStart||'07:00';
    const _toMins=t=>{const[h,m]=(t||'0:0').split(':').map(Number);return h*60+(m||0);};
    const _halfMinH=dayName=>{
      const hd=_halfDays.find(h=>h.day===dayName);
      if(!hd) return null;
      return Math.max(1,(_toMins(hd.end||'12:00')-_toMins(_projStart))/60);
    };
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project;
    const contractNo=_proj.contractNo||S.project;
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const from=document.getElementById('rpt-from')?.value||'';
    const to=document.getElementById('rpt-to')?.value||'';
    const byReg={};
    data.forEach(p=>{if(!byReg[p.regId])byReg[p.regId]=[];byReg[p.regId].push(p);});
    let pages='';
    const _pp=Object.keys(byReg).sort();_pp.forEach((regId,_i)=>{
      const recs=byReg[regId];
      const pi=PlantReports._pi(regId)||{};
      const minHrs=PlantReports._minHrs(regId);
      const rateType=pi.rateType||'per_hr';
      const rate=pi.minRate||0;
      const rateRainy=pi.minRateRainy||0;
      const plantType=recs[0]?.equipment||recs[0]?.type||regId;
      const owner=pi.ownerSupplier||'';
      const fuelLhr=pi.fuelConsumption||0;
      const totW=recs.reduce((s,p)=>s+_h(p),0);
      const totBd=recs.reduce((s,p)=>s+_bdH(p),0);
      const totIW=recs.reduce((s,p)=>s+parseFloat(p.incWeather||0),0);
      const days=[...new Set(recs.map(p=>normD(p.date)))];
      const utilDenom=Math.max(0.01,days.length*minHrs-totIW-totBd);
      const util=minHrs>0?totW/utilDenom*100:0;
      const avail=totW>0?(totW-totBd)/totW*100:0;
      pages+=`<div class="page">
        ${ReportSettings.header(projName,contractNo,from,to,regId,pi,util,avail,'${reportTitle}','plant_usage_report','Page '+(_i+1)+' of '+_pp.length)}
        <div style="margin-top:10px;font-size:9px;font-weight:700;color:#555;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:6px">${reportTitle.toUpperCase()} — ${regId} (${plantType})</div>
        ${content.filter?.(p=>p.regId===regId).length>0?'':content}
      </div>`;
    });
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>'+reportTitle+'</title><style>'+ReportSettings.css('plant_usage_report')+'</style></head><body>'+pages+'</body></html>');
    w.document.close();
    setTimeout(()=>w.print(),300);
  },

  _lossCompute(data) {
    const normD=v=>v?String(v).slice(0,10):'';
    // Guarded worked hours for one record: real meter (opening>0, span ≤24) → clock → recorded,
    // everything capped at 24h so corrupt 0-opening meters can't produce impossible values.
    const _h=p=>{const ho=parseFloat(p.hrOpening),hc=parseFloat(p.hrClosing);if(isFinite(ho)&&isFinite(hc)&&ho>0&&hc>ho&&(hc-ho)<=24)return hc-ho;if(p.activityStart&&p.activityEnd){const s=String(p.activityStart).split(':').map(Number),e=String(p.activityEnd).split(':').map(Number);const h=Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;if(h>0&&h<=24)return h;}const w=parseFloat(p.hrsWorked)||0;return (w>0&&w<=24)?w:0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const _act=p=>{const a=parseFloat(p.activityHrs);if(isFinite(a)&&a>0)return a;const w=_h(p);const idl=parseFloat(p.idleHrs)||0;return Math.max(0,w-idl);};
    // Day worked hours from the meter envelope (max close − min open, blanks/0 ignored); else clock/recorded.
    const _dayWorked=dr=>{const opens=dr.map(x=>parseFloat(x.hrOpening)).filter(v=>isFinite(v)&&v>0);const closes=dr.map(x=>parseFloat(x.hrClosing)).filter(v=>isFinite(v)&&v>0);const mnO=opens.length?Math.min(...opens):null,mxC=closes.length?Math.max(...closes):null;if(mnO!=null&&mxC!=null&&mxC>mnO&&(mxC-mnO)<=24)return mxC-mnO;return dr.reduce((s,x)=>s+_h(x),0);};
    const byReg={};data.forEach(p=>{(byReg[p.regId]=byReg[p.regId]||[]).push(p);});
    const out=[];const excluded=[];
    Object.keys(byReg).sort().forEach(regId=>{
      const recs=byReg[regId];
      const pi=PlantReports._pi(regId)||{};
      const rateType=pi.rateType||'per_hr';
      const _vt=recs[0]?.type||recs[0]?.equipment||pi.plantType||'';
      if(Prod._isOverhead&&Prod._isOverhead(_vt)){excluded.push({regId,type:_vt||regId});return;} // support/overhead vehicle — utilisation/loss n/a regardless of billing
      const minHrs=PlantReports._minHrs(regId), rainyMin=PlantReports._minHrsRainy(regId);
      const isPerDay=rateType!=='per_hr';
      const byDate={};recs.forEach(p=>{(byDate[normD(p.date)]=byDate[normD(p.date)]||[]).push(p);});
      let tWork=0,tAct=0,tWx=0,tBd=0,tAvail=0,tBilledHrs=0,tBilledCost=0,tTopHrs=0,tTopCost=0,tIdleHrs=0,tIdleCost=0,tProdVal=0,anyAct=false;
      const days=[]; const actMap={};
      Object.keys(byDate).sort().forEach(d=>{
        const dr=byDate[d];
        const dWork=_dayWorked(dr);
        const dAct=Math.min(dWork,dr.reduce((s,x)=>s+_act(x),0));
        const dWx=dr.reduce((s,x)=>s+(parseFloat(x.incWeather)||0),0);
        const dBd=dr.reduce((s,x)=>s+_bdH(x),0);
        const dAvail=dr.reduce((s,x)=>s+(parseFloat(x.hrsAvailable)||0),0);
        if(dr.some(x=>isFinite(parseFloat(x.activityHrs))&&parseFloat(x.activityHrs)>0))anyAct=true;
        const dRainy=dWx>0, dDisrupted=dBd>0||dWx>0, dMinFor=dRainy?rainyMin:minHrs;
        let qty;
        if(dWork>0){ if(isPerDay)qty=dDisrupted?(dMinFor>0?Math.min(1,dWork/dMinFor):0):1; else qty=(dBd>0&&dWx<=0)?dWork:Math.max(dWork,dMinFor); }
        else qty=(dRainy&&rainyMin>0)?(isPerDay?1:rainyMin):0;
        const baseRate=dRainy?parseFloat(pi.minRateRainy||pi.minRate||0):parseFloat(pi.minRate||0);
        let billedHrs,billedCost,effHr;
        if(isPerDay){ billedHrs=qty*dMinFor; billedCost=qty*baseRate; effHr=dMinFor>0?baseRate/dMinFor:0; }
        else { billedHrs=qty; billedCost=qty*baseRate; effHr=baseRate; }
        const topHrs=Math.max(0,billedHrs-dWork);            // billed beyond worked (minimum / standby)
        const idleHrs=Math.max(0,dWork-dAct);                // worked but not productive
        const topCost=topHrs*effHr, idleCost=idleHrs*effHr;
        const prodVal=Math.max(0,billedCost-topCost-idleCost);
        const basis=dWork<=0?(dRainy?'Rainy standby':(dBd>0?'Breakdown':'No work')):(dRainy?'Rainy':(dBd>0?'Breakdown':'Normal'));
        dr.forEach(x=>{const k=x.activityCode||x.activityDesc||'(unassigned)';(actMap[k]=actMap[k]||{worked:0,act:0});actMap[k].worked+=_h(x);actMap[k].act+=_act(x);});
        days.push({date:d,worked:dWork,activity:dAct,billedHrs,billedCost,basis,topHrs,topCost,idleHrs,idleCost,minApplied:topHrs>0.01,rainy:dRainy,bd:dBd,qty,effHr,baseRate});
        tWork+=dWork;tAct+=dAct;tWx+=dWx;tBd+=dBd;tAvail+=dAvail;tBilledHrs+=billedHrs;tBilledCost+=billedCost;tTopHrs+=topHrs;tTopCost+=topCost;tIdleHrs+=idleHrs;tIdleCost+=idleCost;tProdVal+=prodVal;
      });
      const totLoss=tTopCost+tIdleCost;
      const util=tWork>0?(tAct/tWork*100):0;          // activity vs worked
      const payEff=tBilledHrs>0?(tAct/tBilledHrs*100):0; // productive vs paid
      const avail=tAvail>0?Math.min(100,tWork/tAvail*100):util;
      out.push({regId,type:recs[0]?.equipment||recs[0]?.type||regId,isPerDay,rateType,minHrs,rainyMin,pi,
        tWork,tAct,tWx,tBd,tAvail,tBilledHrs,tBilledCost,tTopHrs,tTopCost,tIdleHrs,tIdleCost,tProdVal,totLoss,util,payEff,avail,anyAct,
        days,actMap});
    });
    out._excluded=excluded;
    return out;
  },
  _lossReport(data) {
    const R=this._lossCompute(data);
    const _ex=R._excluded||[];
    const exNote=_ex.length?'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--text3)">🚚 '+_ex.length+' support/transport vehicle'+(_ex.length>1?'s':'')+' ('+_ex.map(x=>x.regId).join(', ')+') not shown — utilisation &amp; loss apply to production plant, not Supervision / Site Service / Site Transport vehicles.</div>':'';
    if(!R.length) return '<div style="padding:24px;text-align:center;color:var(--text3)">'+(exNote||'No records in selected range')+'</div>';
    const E=n=>'E '+Math.round(n).toLocaleString();
    const H=n=>(Math.round(n*10)/10)+'h';
    const sum=k=>R.reduce((s,o)=>s+o[k],0);
    const gB=sum('tBilledCost'),gL=sum('totLoss'),gP=sum('tProdVal'),gW=sum('tWork'),gA=sum('tAct');
    const gU=gW>0?gA/gW*100:0, lossPct=gB>0?gL/gB*100:0;
    const card=(l,v,c,sub)=>'<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid '+c+';border-radius:8px;padding:12px 14px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">'+l+'</div><div style="font-size:22px;font-weight:800;color:'+c+';margin-top:2px">'+v+'</div><div style="font-size:10px;color:var(--text3);margin-top:3px">'+sub+'</div></div>';
    const uCol=u=>u>=80?'var(--green)':u>=55?'var(--amber)':'var(--red)';
    let html='<div style="display:flex;flex-direction:column;gap:22px">'+exNote;
    html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'
      +card('Billed Cost',E(gB),'var(--blue)','agreed hrs/days × rate')
      +card('Productive Value',E(gP),'var(--green)','actual activity output')
      +card('Total Loss',E(gL),'var(--red)',lossPct.toFixed(0)+'% of billed cost')
      +card('Utilisation',gU.toFixed(0)+'%',uCol(gU),'activity ÷ worked')
      +'</div>';
    R.forEach(o=>{
      const billed=o.tBilledCost||1;
      const pP=Math.max(0,o.tProdVal)/billed*100, pT=o.tTopCost/billed*100, pI=o.tIdleCost/billed*100;
      const basis=o.isPerDay?('Per-Day · min '+o.minHrs+'h'+(o.rainyMin>0?' / rainy '+o.rainyMin+'h':'')):('Per-Hour · min '+o.minHrs+'h'+(o.rainyMin>0?' / rainy '+o.rainyMin+'h':''));
      html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
      html+='<div style="padding:12px 16px;background:linear-gradient(90deg,rgba(240,165,0,.15),transparent);border-bottom:2px solid var(--amber);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
        +'<div style="display:flex;align-items:center;gap:12px"><span style="font-family:var(--fh);font-size:20px;font-weight:700;color:var(--amber)">'+o.regId+'</span><span style="color:var(--text2);font-size:13px">'+o.type+'</span><span style="background:var(--surface2);color:var(--text2);font-size:10px;padding:2px 8px;border-radius:10px">'+basis+'</span></div>'
        +'<div style="display:flex;gap:10px;align-items:center"><span style="font-size:11px;color:var(--text3)">Loss</span><span style="font-size:20px;font-weight:800;color:var(--red)">'+E(o.totLoss)+'</span><span style="background:'+uCol(o.util)+';color:#000;font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px">'+o.util.toFixed(0)+'% util</span></div></div>';
      html+='<div style="padding:14px 16px">';
      // hours strip
      const chip=(l,v,c)=>'<div style="text-align:center;min-width:64px"><div style="font-size:9px;color:var(--text3);text-transform:uppercase">'+l+'</div><div style="font-size:15px;font-weight:700;color:'+(c||'var(--text)')+'">'+v+'</div></div>';
      html+='<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:space-between;margin-bottom:14px">'
        +chip('Available',H(o.tAvail),'var(--text2)')+chip('Worked',H(o.tWork),'var(--blue)')+chip('Activity',H(o.tAct),'var(--green)')
        +chip('Idle',H(o.tIdleHrs),'var(--orange)')+chip('Weather',H(o.tWx),'#38bdf8')+chip('Breakdown',H(o.tBd),'var(--red)')
        +chip('Billed',H(o.tBilledHrs),'var(--amber)')+'</div>';
      // efficiency bar
      html+='<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Cost composition (of '+E(o.tBilledCost)+' billed)</div>';
      html+='<div style="display:flex;height:20px;border-radius:5px;overflow:hidden;border:1px solid var(--border)">'
        +(pP>0?'<div title="Productive" style="width:'+pP+'%;background:var(--green)"></div>':'')
        +(pT>0?'<div title="Minimum / standby" style="width:'+pT+'%;background:var(--amber)"></div>':'')
        +(pI>0?'<div title="Idle / non-productive" style="width:'+pI+'%;background:var(--red)"></div>':'')
        +'</div>';
      html+='<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:7px;font-size:11px">'
        +'<span><b style="color:var(--green)">■</b> Productive '+E(o.tProdVal)+'</span>'
        +'<span><b style="color:var(--amber)">■</b> Min/Standby '+E(o.tTopCost)+' ('+H(o.tTopHrs)+')</span>'
        +'<span><b style="color:var(--red)">■</b> Idle '+E(o.tIdleCost)+' ('+H(o.tIdleHrs)+')</span></div>';
      // activity table
      const acts=Object.keys(o.actMap).sort((a,b)=>o.actMap[b].worked-o.actMap[a].worked);
      html+='<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px">Utilisation by activity</div>';
      html+='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface2)">'
        +'<th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">Activity</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Worked</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Activity</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Idle</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Used %</th></tr></thead><tbody>';
      acts.forEach(k=>{const a=o.actMap[k];const u=a.worked>0?a.act/a.worked*100:0;const idl=Math.max(0,a.worked-a.act);
        html+='<tr><td style="padding:5px 8px;border:1px solid var(--border)">'+k+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--blue)">'+H(a.worked)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--green)">'+H(a.act)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--orange)">'+H(idl)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);font-weight:700;color:'+uCol(u)+'">'+u.toFixed(0)+'%</td></tr>';});
      html+='</tbody></table>';
      // full per-date breakdown
      html+='<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px">Daily breakdown — worked vs activity vs billed &amp; loss</div>';
      html+='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface2)">'
        +'<th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">Date</th>'
        +'<th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">Basis</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Worked</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Activity</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Used %</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Billed</th>'
        +'<th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">Loss</th></tr></thead><tbody>';
      o.days.forEach(d=>{const dd=new Date(d.date+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
        const u=d.worked>0?d.activity/d.worked*100:0; const dLoss=d.topCost+d.idleCost;
        const bc=d.basis.indexOf('Rainy')>=0?'#38bdf8':(d.basis.indexOf('Break')>=0?'var(--red)':(d.basis.indexOf('No work')>=0?'var(--text3)':'var(--text2)'));
        html+='<tr><td style="padding:5px 8px;border:1px solid var(--border)">'+dd+'</td>'
          +'<td style="padding:5px 8px;border:1px solid var(--border);color:'+bc+'">'+d.basis+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--blue)">'+H(d.worked)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--green)">'+H(d.activity)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);font-weight:700;color:'+uCol(u)+'">'+(d.worked>0?u.toFixed(0)+'%':'—')+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);color:var(--amber)">'+H(d.billedHrs)+'</td>'
          +'<td style="padding:5px 8px;text-align:right;border:1px solid var(--border);font-weight:700;color:'+(dLoss>0.5?'var(--red)':'var(--text3)')+'">'+(dLoss>0.5?E(dLoss):'—')+'</td></tr>';});
      html+='<tr style="background:var(--surface2);font-weight:700"><td colspan="2" style="padding:6px 8px;border:1px solid var(--border);text-align:right">TOTAL</td>'
        +'<td style="padding:6px 8px;text-align:right;border:1px solid var(--border);color:var(--blue)">'+H(o.tWork)+'</td>'
        +'<td style="padding:6px 8px;text-align:right;border:1px solid var(--border);color:var(--green)">'+H(o.tAct)+'</td>'
        +'<td style="padding:6px 8px;text-align:right;border:1px solid var(--border);color:'+uCol(o.util)+'">'+o.util.toFixed(0)+'%</td>'
        +'<td style="padding:6px 8px;text-align:right;border:1px solid var(--border);color:var(--amber)">'+H(o.tBilledHrs)+'</td>'
        +'<td style="padding:6px 8px;text-align:right;border:1px solid var(--border);color:var(--red)">'+E(o.totLoss)+'</td></tr>';
      html+='</tbody></table>';
      html+='</div></div>';
    });
    html+='</div>';
    return html;
  },
  _printLoss() {
    const data=this._filter();
    if(!data.length){alert('No records to print');return;}
    const R=this._lossCompute(data);
    const _ex=R._excluded||[];
    if(!R.length){alert(_ex.length?'Only support/transport vehicles in range — utilisation/loss apply to production plant, not Supervision / Site Service / Site Transport vehicles.':'No records to print');return;}
    const exBanner=_ex.length?'<div style="margin:6px 0;padding:6px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:9px;color:#666">🚚 Excluded (support/transport vehicles): '+_ex.map(x=>x.regId).join(', ')+' — utilisation &amp; loss apply to production plant only.</div>':'';
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project, contractNo=_proj.contractNo||S.project;
    const from=document.getElementById('rpt-from')?.value||'', to=document.getElementById('rpt-to')?.value||'';
    const E=n=>'E '+Math.round(n).toLocaleString();
    const H=n=>(Math.round(n*10)/10)+'h';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    let pages='';
    R.forEach((o,_i)=>{
      const acts=Object.keys(o.actMap).sort((a,b)=>o.actMap[b].worked-o.actMap[a].worked);
      const mk=o.days.filter(d=>d.minApplied);
      pages+='<div class="page">'
        +ReportSettings.header(projName,contractNo,from,to,o.regId,o.pi,o.util,o.avail,'Loss & Utilisation Analysis','plant_usage_report','Page '+(_i+1)+' of '+R.length)
        +(_i===0?exBanner:'')
        +this._kpis([['Billed Cost',E(o.tBilledCost),'#1a56db'],['Productive Value',E(o.tProdVal),'#2d6a2d'],['Total Loss',E(o.totLoss),'#c00'],['Utilisation',o.util.toFixed(0)+'%','#c85000']])
        +'<div style="margin:8px 0 6px;font-size:10px;font-weight:700;color:#555;border-bottom:1px solid #ccc;padding-bottom:3px">LOSS &amp; UTILISATION — '+o.regId+' ('+o.type+') · '+(o.isPerDay?'Per-Day':'Per-Hour')+' min '+o.minHrs+'h'+(o.rainyMin>0?' / rainy '+o.rainyMin+'h':'')+'</div>'
        +'<table class="data-table"><thead><tr><th>Available</th><th>Worked</th><th>Activity</th><th>Idle</th><th>Weather</th><th>Breakdown</th><th>Billed</th></tr></thead>'
        +'<tbody><tr style="text-align:center;font-weight:700"><td>'+H(o.tAvail)+'</td><td style="color:#1a56db">'+H(o.tWork)+'</td><td style="color:#2d6a2d">'+H(o.tAct)+'</td><td style="color:#c85000">'+H(o.tIdleHrs)+'</td><td style="color:#0070c0">'+H(o.tWx)+'</td><td style="color:#c00">'+H(o.tBd)+'</td><td style="color:#7e22ce">'+H(o.tBilledHrs)+'</td></tr></tbody></table>'
        +(()=>{const billed=o.tBilledCost||1;const pP=Math.max(0,o.tProdVal)/billed*100,pT=o.tTopCost/billed*100,pI=o.tIdleCost/billed*100;return '<div style="margin:10px 0 4px;font-size:10px;font-weight:700;color:#555">Cost Composition — of '+E(o.tBilledCost)+' billed</div>'
          +'<div style="display:flex;height:16px;border:1px solid #bbb;border-radius:3px;overflow:hidden">'
          +(pP>0?'<div style="width:'+pP+'%;background:#2d6a2d"></div>':'')
          +(pT>0?'<div style="width:'+pT+'%;background:#c85000"></div>':'')
          +(pI>0?'<div style="width:'+pI+'%;background:#c00"></div>':'')
          +'</div>'
          +'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:5px;font-size:9px">'
          +'<span><b style="color:#2d6a2d">\u25a0</b> Productive '+E(o.tProdVal)+' ('+pP.toFixed(0)+'%)</span>'
          +'<span><b style="color:#c85000">\u25a0</b> Minimum / Standby '+E(o.tTopCost)+' ('+H(o.tTopHrs)+')</span>'
          +'<span><b style="color:#c00">\u25a0</b> Idle / non-productive '+E(o.tIdleCost)+' ('+H(o.tIdleHrs)+')</span></div>';})()
        +'<div style="margin:10px 0 4px;font-size:10px;font-weight:700;color:#555">Utilisation by Activity</div>'
        +'<table class="data-table"><thead><tr><th>Activity</th><th>Worked</th><th>Activity Hrs</th><th>Idle</th><th>Used %</th></tr></thead><tbody>'
        +acts.map(k=>{const a=o.actMap[k];const u=a.worked>0?a.act/a.worked*100:0;const idl=Math.max(0,a.worked-a.act);return '<tr><td>'+k+'</td><td style="text-align:right">'+H(a.worked)+'</td><td style="text-align:right">'+H(a.act)+'</td><td style="text-align:right">'+H(idl)+'</td><td style="text-align:right;font-weight:700">'+u.toFixed(0)+'%</td></tr>';}).join('')
        +'</tbody></table>'
        +'<div style="margin:10px 0 4px;font-size:10px;font-weight:700;color:#555">Daily Breakdown — Worked vs Activity vs Billed &amp; Loss</div>'
        +'<table class="data-table"><thead><tr><th>Date</th><th>Basis</th><th>Worked</th><th>Activity</th><th>Used %</th><th>Billed</th><th>Loss (E)</th></tr></thead><tbody>'
        +o.days.map(d=>{const u=d.worked>0?d.activity/d.worked*100:0;const dLoss=d.topCost+d.idleCost;return '<tr><td>'+fmtD(d.date)+'</td><td>'+d.basis+'</td><td style="text-align:right">'+H(d.worked)+'</td><td style="text-align:right">'+H(d.activity)+'</td><td style="text-align:right">'+(d.worked>0?u.toFixed(0)+'%':'—')+'</td><td style="text-align:right">'+H(d.billedHrs)+'</td><td style="text-align:right;font-weight:700;color:#c00">'+(dLoss>0.5?E(dLoss):'—')+'</td></tr>';}).join('')
        +'<tr class="rpt-total"><td colspan="2" style="text-align:right">TOTAL:</td><td style="text-align:right">'+H(o.tWork)+'</td><td style="text-align:right">'+H(o.tAct)+'</td><td style="text-align:right">'+o.util.toFixed(0)+'%</td><td style="text-align:right">'+H(o.tBilledHrs)+'</td><td style="text-align:right;font-weight:900;color:#c00">'+E(o.totLoss)+'</td></tr>'
        +'</tbody></table>'
        +'</div>';
    });
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Loss & Utilisation Analysis</title><style>'+ReportSettings.css('plant_usage_report')+'</style></head><body>'+pages+'</body></html>');
    w.document.close();setTimeout(()=>w.print(),300);
  },

  print() {
    if(this._activeType===4) return this._printLoss();
    if(this._activeType===2) return this._printCost();
    if(this._activeType===3) return this._printFull();
    const data=this._filter();
    if(!data.length){alert('No records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const inv=DB.get('plantInventory',S.project)||[];
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project;
    const contractNo=_proj.contractNo||S.project;
    const fuel=DB.get('fuelIssues',S.project)||[];
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const _bdH=p=>{if(p.breakdown!=='Yes'||!p.bdStartTime||!p.bdEndTime)return 0;const s=p.bdStartTime.split(':').map(Number),e=p.bdEndTime.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;};
    const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Group by regId
    const byReg={};
    data.forEach(p=>{if(!byReg[p.regId])byReg[p.regId]=[];byReg[p.regId].push(p);});

    // Get date range
    const from=document.getElementById('rpt-from')?.value||'';
    const to=document.getElementById('rpt-to')?.value||'';

    let pages='';
    const _pp=Object.keys(byReg).sort();_pp.forEach((regId,_i)=>{
      const recs=byReg[regId];
      const pi=PlantReports._pi(regId)||{};
      const minHrs=PlantReports._minHrs(regId);
      const rateType=pi.rateType||'per_hr';
      const rate=pi.minRate||0;
      const rateRainy=pi.minRateRainy||0;
      const plantType=recs[0]?.equipment||recs[0]?.type||regId;
      const owner=pi.ownerSupplier||'';
      const fuelLhr=pi.fuelConsumption||0;

      // Schedule for half-day calculation
      const _sched=DB.get('schedule',S.project)||{};
      const _hDays=_sched.halfDays||[];
      const _pStart=_sched.dayStart||'07:00';
      const _toM=t=>{const[h,m]=(t||'0:0').split(':').map(Number);return h*60+(m||0);};
      const _getMinH=dayName=>{
        const hd=_hDays.find(h=>h.day===dayName);
        return hd?Math.max(1,(_toM(hd.end||'12:00')-_toM(_pStart))/60):minHrs;
      };
      // Build daily rows - one per calendar day in range
      const allDates=[];
      if(from&&to){
        let d=new Date(from+'T00:00:00');
        const end=new Date(to+'T00:00:00');
        while(d<=end){allDates.push(d.toISOString().slice(0,10));d=new Date(d.getTime()+86400000);}
      } else {
        const recDates=[...new Set(recs.map(p=>normD(p.date)))].sort();
        allDates.push(...recDates);
      }

      // Charge basis (per-plant): per_hr → "Agreed Hours"; per_day/week/month → "Agreed Days";
      // per_km (transport/service vehicles) → "Agreed Km", billed on odometer distance.
      const isPerKm=rateType==='per_km';
      const isPerDay=!isPerKm&&rateType!=='per_hr';
      const rainyMin=PlantReports._minHrsRainy(regId);
      const agreedHdr=isPerKm?'Agreed Km':(isPerDay?'Agreed Days':'Agreed Hours');
      const agreedUnit=isPerKm?'km':(isPerDay?'days':'hrs');
      // Hours: use hour-meter; if meter malfunctioning/invalid, fall back to Opening/Closing Clock
      const _hD=p=>{const ho=parseFloat(p.hrOpening),hc=parseFloat(p.hrClosing);if(isFinite(ho)&&isFinite(hc)&&hc>ho)return hc-ho;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);const h=Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;if(h>0)return h;}if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;return 0;};

      // Totals
      let totHrs=0,totDown=0,totIdeal=0,totIW=0,totAgreed=0;
      const rows=allDates.map(dateStr=>{
        const dayRecs=recs.filter(p=>normD(p.date)===dateStr);
        const d=new Date(dateStr+'T00:00:00');
        const dayName=days[d.getDay()];
        const minH=_getMinH(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]);
        if(!dayRecs.length) return `<tr><td>${fmtD(dateStr)}</td><td>${dayName}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${minH}</td><td>—</td><td>—</td><td>—</td><td>—</td><td style="color:#aaa;font-size:9px">—</td><td style="color:#aaa;font-size:9px">—</td></tr>`;
        // Hour-meter envelope across all of the day's activities. A real meter never reads 0
        // here, so treat 0/blank as "not entered" — this lets the opening meter live on the
        // first activity and the closing meter on the last and still combine into one span.
        const _mOpen=dayRecs.map(p=>parseFloat(p.hrOpening)).filter(v=>isFinite(v)&&v>0);
        const _mClose=dayRecs.map(p=>parseFloat(p.hrClosing)).filter(v=>isFinite(v)&&v>0);
        const _minOpen=_mOpen.length?Math.min(..._mOpen):null;
        const _maxClose=_mClose.length?Math.max(..._mClose):null;
        // Hours = meter span (max closing − min opening) when the meter is usable; otherwise
        // fall back to each activity's own clock time, then its recorded hours.
        let hrs;
        if(_minOpen!=null&&_maxClose!=null&&_maxClose>_minOpen&&(isPerKm||(_maxClose-_minOpen)<=24)){
          hrs=_maxClose-_minOpen;  // per_km: odometer span is distance (km) and may exceed 24
        } else {
          hrs=dayRecs.reduce((s,p)=>{
            const a=String(p.activityStart||''),b=String(p.activityEnd||'');
            const ma=/^(\d{1,2}):(\d{2})/.exec(a),mb=/^(\d{1,2}):(\d{2})/.exec(b);
            if(ma&&mb){const h=((+mb[1])*60+(+mb[2])-((+ma[1])*60+(+ma[2])))/60;if(h>0&&h<=24)return s+h;}
            const w=parseFloat(p.hrsWorked)||0;  // ignore corrupt values: a day can't exceed 24h
            return s+(w>0&&w<=24?w:0);
          },0);
        }
        const down=dayRecs.reduce((s,p)=>s+_bdH(p),0);
        const iw=dayRecs.reduce((s,p)=>s+parseFloat(p.incWeather||0),0);
        const ideal=isPerKm?hrs:Math.max(0,hrs-down);
        // Disrupted = any downtime or inclement-weather hours logged
        const isDisrupted=down>0||iw>0;
        const isRainy=iw>0;
        // Applicable minimum for this day: rainy-day minimum on inclement-weather days, else normal Min Hours
        const minForDay=isRainy?rainyMin:minH;
        // Agreed charge:
        //  Worked hrs > 0 → per-day: 1 full day when clean; Hours÷(applicable min) days when disrupted (cap 1);
        //                   per-hour: max(Hours, applicable min) on clean/rainy days; pure breakdown → actual hours.
        //  Worked hrs = 0 → Inclement-Weather standby is chargeable when a rainy minimum is set
        //                   (per-day: 1 day, per-hour: rainy-min hours); Down Time / no work → 0.
        //  Applicable minimum 0 (i.e. both normal & rainy min unset) → 0.
        let agreed;
        if(isPerKm){
          agreed=hrs; // billed on distance travelled (km from the odometer)
        } else if(hrs>0){
          if(isPerDay) agreed=isDisrupted?(minForDay>0?Math.min(1,hrs/minForDay):0):1;
          else agreed=(down>0&&iw<=0)?hrs:Math.max(hrs,minForDay);
        } else {
          if(isRainy&&rainyMin>0) agreed=isPerDay?1:rainyMin;
          else agreed=0;
        }
        const remarks=dayRecs.map(p=>p.activityCode||p.activityDesc||'').filter(Boolean).join(' | ');
        const userRem=dayRecs.map(p=>p.remarks).filter(Boolean).join(' | ');
        // Multi-activity day: show the full envelope across all of the day's activities, ignoring blanks —
        // earliest Opening Clock / latest Closing Clock, lowest Opening Hr Meter / highest Closing Hr Meter.
        // (Lets the user enter the opening meter on the first activity and the closing meter on the last.)
        const _toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(t||''));return m?(+m[1])*60+(+m[2]):null;};
        const hrOpen=_minOpen!=null?_minOpen.toFixed(2):'—';
        const hrClose=_maxClose!=null?_maxClose.toFixed(2):'—';
        const _oClk=dayRecs.map(p=>p.activityStart).filter(t=>_toMin(t)!=null);
        const _cClk=dayRecs.map(p=>p.activityEnd).filter(t=>_toMin(t)!=null);
        const clkOpen=_oClk.length?_oClk.reduce((a,b)=>_toMin(b)<_toMin(a)?b:a):'—';
        const clkClose=_cClk.length?_cClk.reduce((a,b)=>_toMin(b)>_toMin(a)?b:a):'—';
        totHrs+=hrs;totDown+=down;totIdeal+=ideal;totIW+=iw;totAgreed+=agreed;
        const bdNote=dayRecs.find(p=>p.breakdown==='Yes')?'⚠ Breakdown':'';
        return `<tr>
          <td>${fmtD(dateStr)}</td><td>${dayName}</td>
          <td>${clkOpen}</td><td>${clkClose}</td>
          <td>${hrOpen}</td><td>${hrClose}</td>
          <td style="font-weight:700;color:#c85000">${hrs.toFixed(2)}</td>
          <td>${isPerKm?'—':minForDay}</td>
          <td style="color:#c00">${down>0?down.toFixed(2):'—'}</td>
          <td>${ideal.toFixed(2)}</td>
          <td style="color:#0070c0">${iw>0?iw.toFixed(2):'—'}</td>
          <td style="font-weight:700">${agreed.toFixed(2)}</td>
          <td style="font-size:9px;color:#555">${remarks||'—'}</td>
          <td style="font-size:9px;color:#555">${[bdNote,userRem].filter(Boolean).join(' | ')||'—'}</td>
        </tr>`;
      });

      const totalDays=allDates.length;
      const utilDenom=Math.max(0.01,totalDays*minHrs-totIW-totDown);
      const util=minHrs>0?totHrs/utilDenom*100:0;
      const avail=totHrs>0?(totHrs-totDown)/totHrs*100:0;

      pages+=`<div class="page">
        ${ReportSettings.header(projName,contractNo,from,to,regId,pi,util,avail,'Page 1 of 1','monthly_plant_return','Page '+(_i+1)+' of '+_pp.length)}
        <table class="data-table">
        <table class="data-table">
          <thead>
            <tr style="background:#2d6a2d;color:#fff">
              <th>Date</th><th>Day</th><th>Opening Clock</th><th>Closing Clock</th>
              <th>${isPerKm?'Opening Odo':'Opening Hr Meter'}</th><th>${isPerKm?'Closing Odo':'Closing Hr Meter'}</th>
              <th>${isPerKm?'Km':'Hours'}</th><th>Min Hours</th><th>Down Time</th>
              <th>${isPerKm?'Ideal Km':'Ideal Hours'}</th><th>Inclement Weather</th><th>${agreedHdr}</th><th>Activity</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
          <tfoot>
            <tr class="rpt-total">
              <td colspan="6" style="text-align:right">TOTALS:</td>
              <td style="color:#c85000">${totHrs.toFixed(2)}</td>
              <td>${totalDays*minHrs}</td>
              <td style="color:#c00">${totDown.toFixed(2)}</td>
              <td>${totIdeal.toFixed(2)}</td>
              <td style="color:#0070c0">${totIW.toFixed(2)}</td>
              <td style="font-weight:900;background:#2d6a2d;color:#fff">${totAgreed.toFixed(2)}</td>
              <td></td>
              <td>Final Agreed: ${totAgreed.toFixed(2)} ${agreedUnit}</td>
            </tr>
          </tfoot>
        </table>
        <div class="sign-section">
          <div class="sign-title">APPROVALS &amp; SIGN-OFF</div>
          <table class="sign-table">
            <thead>
              <tr><th class="role-col">&nbsp;</th><th>Name</th><th>Signature</th><th>Date</th></tr>
            </thead>
            <tbody>
              <tr><td class="role-col">Site Technician</td><td class="ln"></td><td class="ln"></td><td class="ln"></td></tr>
              <tr><td class="role-col">Site Agent</td><td class="ln"></td><td class="ln"></td><td class="ln"></td></tr>
              <tr><td class="role-col">Owner Representative</td><td class="ln"></td><td class="ln"></td><td class="ln"></td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    });

    const w=window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Monthly Plant Return</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:10px;color:#000;background:#fff}
      @page{size:297mm 210mm;margin:0}
      .page{width:297mm;min-height:210mm;padding:7mm 9mm;page-break-after:always;border:1px solid #ccc;
        display:flex;flex-direction:column}
      .page:last-child{page-break-after:auto}
      .header-bar{border-bottom:3px solid #2d6a2d;padding-bottom:6px;margin-bottom:8px}
      .info-table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9px}
      ${ReportSettings.css()}
      .data-table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:8px;table-layout:fixed}
      .data-table th,.data-table td{border:1px solid #999;padding:1px 3px;text-align:center;line-height:1.25}
      .data-table th{background:#2d6a2d;color:#fff;font-size:7.5px}
      .data-table td:first-child,.data-table td:last-child{text-align:left}
      .data-table tbody tr:nth-child(even){background:#f6f8f6}
      .sign-section{margin-top:auto;padding-top:8px;page-break-inside:avoid}
      .sign-title{font-size:9px;font-weight:700;letter-spacing:.6px;color:#2d6a2d;margin-bottom:5px;
        border-bottom:1.5px solid #2d6a2d;padding-bottom:3px}
      .sign-table{width:100%;border-collapse:collapse;font-size:9px}
      .sign-table th{text-align:left;font-size:8px;font-weight:700;letter-spacing:.4px;color:#555;
        text-transform:uppercase;padding:0 10px 4px;border-bottom:1px solid #bbb}
      .sign-table td{padding:16px 10px 4px;vertical-align:bottom}
      .sign-table td.role-col,.sign-table th.role-col{width:24%}
      .sign-table td.role-col{font-weight:700;color:#222;font-size:9.5px}
      .sign-table td.ln{border-bottom:1px solid #333;width:25.3%}
      @media print{
        body{margin:0}
        .page{border:none;page-break-after:always}
        .page:last-child{page-break-after:auto}
      }
    </style></head><body>${pages}</body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),300);
  },

  _fullReport(data) {
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const inv  = DB.get('plantInventory',S.project)||[];
    const fuel = DB.get('fuelIssues',S.project)||[];
    const meas = DB.get('dailyMeasurements',S.project)||[];
    const sorted=data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));

    // Get Final Qty from measurements matching activity+date
    const _getFinalQty=(p)=>{
      const d=normD(p.date);
      const actKey=p.activityCode||p.activityDesc||'';
      const matches=meas.filter(m=>normD(m.date)===d&&
        (m.activityCode===actKey||m.activityDescription===actKey||
         (actKey&&(m.activityDescription||'').trim().toLowerCase()===actKey.trim().toLowerCase())));
      if(!matches.length) return null;
      return matches.reduce((s,m)=>s+parseFloat(m.totalQty||0),0);
    };

    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px">'
      +'<thead><tr style="background:var(--surface2)">'
      +'<th style="padding:5px 8px;border:1px solid var(--border);text-align:left">Date</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Equip</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Reg/ID</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Hr Open</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Hr Close</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Start</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">End</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--blue)">Hrs Worked</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Idle</th>'+'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--blue)">Incl.Wx (hrs)</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Weather</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--blue)">Rate</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--blue)">Plant Cost (E)</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--orange)">Fuel Cost (E)</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:#a78bfa">Total (E)</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--green)">Final Qty</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);color:var(--green)">Rate (E/unit)</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border)">Status</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);text-align:left">Activity</th>'
      +'<th style="padding:5px 8px;border:1px solid var(--border);text-align:left">Remarks</th>'
      +'</tr></thead><tbody>'
      +sorted.map((p,i)=>{
        const pi=inv.find(x=>x.regId===p.regId);
        const hrs=_h(p);
        const baseRate=p.weather&&/rain/i.test(p.weather)?parseFloat(pi?.minRateRainy||pi?.minRate||0):parseFloat(pi?.minRate||0);
        const rType=pi?.rateType||'per_hr';
        const allDay=data.filter(x=>x.regId===p.regId&&normD(x.date)===normD(p.date));
        const totDH=allDay.reduce((s,x)=>s+this._hrs(x),0)||1;
        const effR=rType==='per_day'?baseRate/totDH:rType==='per_week'?baseRate/(5*totDH):baseRate;
        const pCost=hrs*effR;
        const rf=fuel.filter(f=>f.regId===p.regId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
        let fCost=0;
        if(rf.length>=2){
          const ld=new Date((normD(rf[rf.length-1].date)||'2000-01-01')+'T00:00:00');
          const ws=new Date(ld.getTime()-7*24*60*60*1000);
          const wf=rf.filter(f=>{const fd=new Date((normD(f.date)||'2000-01-01')+'T00:00:00');return fd>=ws&&fd<=ld;});
          if(wf.length>=2){
            const wc=wf.reduce((s,f)=>s+parseFloat(f.cost||0),0);
            const od=wf.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);
            if(od.length>=2){const rng=Math.max(...od)-Math.min(...od);if(rng>=0.5)fCost=(wc/rng)*hrs;}
          }
        }
        const tot=pCost+fCost;
        const finalQty=_getFinalQty(p);
        const ratePerUnit=finalQty&&finalQty>0&&tot>0?(tot/finalQty):null;
        return '<tr style="background:'+(i%2?'rgba(255,255,255,.02)':'transparent')+';border-bottom:1px solid var(--border)">'
          +'<td style="padding:4px 8px;border:1px solid var(--border)">'+fmtD(normD(p.date))+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:center">'+(p.equipment||p.type||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;color:var(--amber)">'+p.regId+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right">'+(p.hrOpening!=null?parseFloat(p.hrOpening).toFixed(1):'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right">'+(p.hrClosing!=null?parseFloat(p.hrClosing).toFixed(1):'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:center;font-family:monospace">'+(p.activityStart||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:center;font-family:monospace">'+(p.activityEnd||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--blue)">'+hrs.toFixed(2)+'h</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right">'+parseFloat(p.idleHrs||0).toFixed(1)+'h</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;color:var(--blue)">'+(p.incWeather>0?parseFloat(p.incWeather).toFixed(1)+'h':'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:center;color:'+(p.breakdown==='Yes'?'var(--red)':'var(--green)')+'">'+(p.breakdown==='Yes'?'⚠':'✓')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);font-size:9px">'+(p.weather||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-size:9px">E'+baseRate+'/'+rType.replace('per_','')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;color:var(--blue)">E '+pCost.toFixed(2)+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;color:var(--orange)">E '+fCost.toFixed(2)+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-weight:700;color:#a78bfa">E '+tot.toFixed(2)+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;color:var(--green)">'+(finalQty!=null?finalQty.toFixed(2):'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);text-align:right;color:var(--green)">'+(ratePerUnit!=null?'E '+ratePerUnit.toFixed(2):'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);font-size:9px">'+(p.status||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);font-size:9px">'+(p.activityCode||p.activityDesc||'—')+'</td>'
          +'<td style="padding:4px 8px;border:1px solid var(--border);font-size:9px;max-width:160px;white-space:normal">'+(p.remarks?String(p.remarks).replace(/</g,'&lt;'):'—')+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table></div>';
  }
,

  printRange(from, to) {
    const _origGet = DB.get.bind(DB);
    const norm = v => v ? String(v).slice(0,10) : '';
    DB.get = (sheet, proj) => {
      const data = _origGet(sheet, proj);
      if (!from && !to) return data;
      if (['plant','fuelIssues','plantInventory'].includes(sheet)) {
        if (sheet === 'plantInventory') return data;
        return data.filter(r => { const d=norm(r.date); return (!from||d>=from)&&(!to||d<=to); });
      }
      return data;
    };
    try { this.print(); } finally { DB.get = _origGet; }
  }
};

// ════════════════════════════════════════════════════════════════
// ⛽ FUEL DISBURSEMENTS — REPORTS
// ════════════════════════════════════════════════════════════════
const FuelReports = {
  open() {
    const fuel = DB.get('fuelIssues', S.project) || [];
    const inv  = DB.get('plantInventory', S.project) || [];
    const normD = v => v ? String(v).slice(0,10) : '';
    const regIds = [...new Set(fuel.map(f=>f.regId).filter(Boolean))].sort();
    const dates  = fuel.map(f=>normD(f.date)).filter(Boolean).sort();
    const minDate = dates[0]||'', maxDate = dates[dates.length-1]||'';

    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;align-items:flex-end">
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">FROM</label>
          <input type="date" id="frpt-from" value="${minDate}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">TO</label>
          <input type="date" id="frpt-to" value="${maxDate}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">PLANT</label>
          <select id="frpt-equip" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:12px">
            <option value="ALL">All Plants</option>
            ${regIds.map(r=>`<option value="${r}">${r}</option>`).join('')}
          </select></div>
        <div style="display:flex;gap:6px">
          <button onclick="FuelReports.run(1)" style="background:var(--orange);color:#fff;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Consumption Analysis</button>
          <button onclick="FuelReports.run(2)" style="background:var(--blue);color:#fff;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Cost Report</button>
          <button onclick="FuelReports.run(3)" style="background:var(--green);color:#000;border:none;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">Variance vs Inventory</button>
        </div>
      </div>
      <div id="frpt-output" style="max-height:65vh;overflow-y:auto"></div>`;

    Modal.open('<span class="material-icons-outlined" aria-hidden="true">local_gas_station</span> Fuel Disbursements — Reports', html,
      [{label:'🖨 Print',cls:'amber',fn:()=>FuelReports.print()},{label:'📥 Export CSV',cls:'ghost',fn:()=>FuelReports.exportCSV()},{label:'📊 Export Excel',cls:'ghost',fn:()=>FuelReports.exportExcel()},
       {label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)}],{fullscreen:true});
    setTimeout(()=>FuelReports.run(1),50);
  },

  _filter() {
    const fuel=DB.get('fuelIssues',S.project)||[];
    const normD=v=>v?String(v).slice(0,10):'';
    const from=document.getElementById('frpt-from')?.value||'';
    const to  =document.getElementById('frpt-to')?.value||'';
    const eq  =document.getElementById('frpt-equip')?.value||'ALL';
    return fuel.filter(f=>{
      const d=normD(f.date);
      if(from&&d<from) return false;
      if(to&&d>to)     return false;
      if(eq!=='ALL'&&f.regId!==eq) return false;
      return true;
    });
  },

  _activeType: 1,
  run(type) {
    this._activeType=type;
    const data=this._filter();
    const el=document.getElementById('frpt-output');
    if(!el) return;
    if(!data.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3)">No fuel records in selected range</div>';return;}
    if(type===1) el.innerHTML=this._consumptionReport(data);
    if(type===2) el.innerHTML=this._costReport(data);
    if(type===3) el.innerHTML=this._varianceReport(data);
  },

  _consumptionReport(data) {
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const byReg={};
    data.forEach(f=>{
      if(!byReg[f.regId]) byReg[f.regId]={type:f.plantType||'—',records:[]};
      byReg[f.regId].records.push(f);
    });

    let html='<div style="display:flex;flex-direction:column;gap:20px">';
    Object.entries(byReg).forEach(([regId,grp])=>{
      const recs=grp.records.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const totL=recs.reduce((s,f)=>s+parseFloat(f.litres||0),0);
      const totC=recs.reduce((s,f)=>s+parseFloat(f.cost||0),0);
      // Per-day analysis
      const byDate={};
      recs.forEach(f=>{
        const d=normD(f.date);
        if(!byDate[d]) byDate[d]={litres:0,cost:0,fills:0};
        byDate[d].litres+=parseFloat(f.litres||0);
        byDate[d].cost+=parseFloat(f.cost||0);
        byDate[d].fills++;
      });
      const dates=Object.keys(byDate).sort();
      // Rate per batch of 7 records — latest valid batch (needs >=4 records)
      const _fbR=calcFuelBatches(recs);
      const rate7d=_fbR.latestRate;
      const avgCostPerFill=totC/recs.length;
      const odos=recs.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0); // for Hr-range display

      html+=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:linear-gradient(90deg,rgba(249,115,22,.12) 0%,transparent);border-bottom:2px solid var(--orange);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-family:var(--fh);font-size:16px;font-weight:700;color:var(--orange)">${regId}</span>
            <span style="color:var(--text2);font-size:12px">${grp.type}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:11px;flex-wrap:wrap">
            <span>📋 <b>${recs.length}</b> fills</span>
            <span style="color:var(--amber)">💧 <b>${totL.toFixed(1)} L</b> total</span>
            <span style="color:var(--orange)">💰 <b>E ${totC.toFixed(2)}</b> total</span>
            <span style="color:var(--blue)">📈 Rate (latest 7) <b>${rate7d>0?'E '+rate7d.toFixed(2)+'/hr':'—'}</b></span>
            <span style="color:var(--text2)">⊘ Avg/fill <b>E ${avgCostPerFill.toFixed(2)}</b></span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Date</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Fills</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Litres</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Cost (E)</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">E/L avg</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Visual</th>
          </tr></thead>
          <tbody>
            ${dates.map(d=>{
              const r=byDate[d];
              const avgL=r.litres/r.fills;
              const uel=r.cost/r.litres;
              const maxL=Math.max(...dates.map(x=>byDate[x].litres));
              const barW=Math.min(100,Math.round(r.litres/maxL*100));
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:5px 10px">${fmtD(d)}</td>
                <td style="padding:5px 10px;text-align:right">${r.fills}</td>
                <td style="padding:5px 10px;text-align:right;font-weight:700;color:var(--amber)">${r.litres.toFixed(1)} L</td>
                <td style="padding:5px 10px;text-align:right;color:var(--orange)">E ${r.cost.toFixed(2)}</td>
                <td style="padding:5px 10px;text-align:right;color:var(--text2)">E ${uel.toFixed(2)}</td>
                <td style="padding:5px 10px"><div style="background:var(--surface2);border-radius:3px;height:12px;width:120px"><div style="background:var(--orange);height:12px;border-radius:3px;width:${barW}%"></div></div></td>
              </tr>`;
            }).join('')}
            <tr style="background:rgba(249,115,22,.06);font-weight:700;border-top:2px solid var(--orange)">
              <td style="padding:6px 10px">TOTAL</td>
              <td style="padding:6px 10px;text-align:right">${recs.length}</td>
              <td style="padding:6px 10px;text-align:right;color:var(--amber)">${totL.toFixed(1)} L</td>
              <td style="padding:6px 10px;text-align:right;color:var(--orange)">E ${totC.toFixed(2)}</td>
              <td style="padding:6px 10px;text-align:right">${(totC/totL).toFixed(2)}</td>
              <td style="padding:6px 10px;font-size:10px;color:var(--text3)">Hr range: ${odos.length>=2?(Math.min(...odos).toFixed(1)+' → '+Math.max(...odos).toFixed(1)):'—'}</td>
            </tr>
          </tbody>
        </table>
        <div style="padding:8px 14px;border-top:2px solid var(--border);background:var(--surface2)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Rate Batches (every 7 records · need ≥4 for a valid rate)</div>
          ${(()=>{
            const _bb=calcFuelBatches(recs).batches;
            const _lvIx=(()=>{for(let i=_bb.length-1;i>=0;i--){if(_bb[i].valid)return i;}return -1;})();
            if(!_bb.length) return '<span style="font-size:11px;color:var(--text3)">No records</span>';
            return '<div style="display:flex;flex-direction:column;gap:4px">'+_bb.map((b,i)=>{
              const used=i===_lvIx;
              return '<div style="display:flex;align-items:center;gap:10px;font-size:11px;padding:4px 8px;border-radius:5px;background:'+(used?'rgba(34,197,94,.12)':'var(--surface)')+';border:1px solid '+(used?'var(--green)':'var(--border)')+'">'
                +'<span style="font-weight:700;min-width:60px">Batch '+(i+1)+'</span>'
                +'<span style="color:var(--text2)">'+b.count+' rec</span>'
                +'<span style="font-family:monospace;color:'+(b.valid?'var(--green)':'var(--text3)')+';font-weight:700">'+(b.valid?'E '+b.rate.toFixed(2)+'/hr':'— (need ≥4)')+'</span>'
                +(b.valid?'<span style="color:var(--text3);font-size:10px">'+b.from.toFixed(1)+' → '+b.to.toFixed(1)+'  ·  E '+b.cost.toFixed(2)+'</span>':'')
                +(used?'<span style="margin-left:auto;background:var(--green);color:#000;padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700">USED FOR FUEL COST</span>':'')
                +'</div>';
            }).join('')+'</div>';
          })()}
        </div></div>`;
    });
    return html+'</div>';
  },

  _costReport(data) {
    const _h=p=>{if(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)return parseFloat(p.hrClosing)-parseFloat(p.hrOpening);if(p.hrsWorked)return parseFloat(p.hrsWorked)||0;if(p.activityStart&&p.activityEnd){const s=p.activityStart.split(':').map(Number),e=p.activityEnd.split(':').map(Number);return Math.max(0,(e[0]*60+(e[1]||0))-(s[0]*60+(s[1]||0)))/60;}return 0;};
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const sorted=data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const total={litres:0,cost:0};
    sorted.forEach(f=>{total.litres+=parseFloat(f.litres||0);total.cost+=parseFloat(f.cost||0);});

    return `<div style="margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:10px;color:var(--text3)">TOTAL LITRES</div>
        <div style="font-size:22px;font-weight:700;color:var(--amber)">${total.litres.toFixed(1)} L</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:10px;color:var(--text3)">TOTAL COST</div>
        <div style="font-size:22px;font-weight:700;color:var(--orange)">E ${total.cost.toFixed(2)}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:10px;color:var(--text3)">AVG UNIT COST</div>
        <div style="font-size:22px;font-weight:700;color:var(--blue)">E ${(total.cost/total.litres).toFixed(2)}/L</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:var(--surface2)">
        <th style="padding:6px 10px;text-align:left;border:1px solid var(--border)">Date</th>
        <th style="padding:6px 10px;text-align:center;border:1px solid var(--border)">Time</th>
        <th style="padding:6px 10px;border:1px solid var(--border)">Reg/ID</th>
        <th style="padding:6px 10px;border:1px solid var(--border)">Plant Type</th>
        <th style="padding:6px 10px;text-align:right;border:1px solid var(--border);color:var(--amber)">Litres</th>
        <th style="padding:6px 10px;text-align:right;border:1px solid var(--border)">Hr Meter</th>
        <th style="padding:6px 10px;text-align:right;border:1px solid var(--border)">Unit Cost (E/L)</th>
        <th style="padding:6px 10px;text-align:right;border:1px solid var(--border);color:var(--orange)">Total Cost (E)</th>
        <th style="padding:6px 10px;text-align:center;border:1px solid var(--border)">Recon</th>
        <th style="padding:6px 10px;border:1px solid var(--border)">Issued By</th>
      </tr></thead>
      <tbody>
        ${sorted.map((f,i)=>`<tr style="background:${i%2?'rgba(255,255,255,.02)':'transparent'};border-bottom:1px solid var(--border)">
          <td style="padding:4px 8px;border:1px solid var(--border)">${fmtD(normD(f.date))}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:center;font-size:10px;color:var(--text2)">${f.startTime||'—'} – ${f.endTime||'—'}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace">${f.regId}</td>
          <td style="padding:4px 8px;border:1px solid var(--border)">${f.plantType||'—'}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--amber)">${parseFloat(f.litres||0).toFixed(1)} L</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-family:monospace;color:var(--blue)">${f.odometer||'—'}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:right">E ${parseFloat(f.costPerLitre||0).toFixed(2)}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--orange)">E ${parseFloat(f.cost||0).toFixed(2)}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);text-align:center">${f.reconStatus==='OK'?'✅':f.reconStatus==='VARIANCE'?'❌':'—'}</td>
          <td style="padding:4px 8px;border:1px solid var(--border);font-size:10px">${f.issuedBy||'—'}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr style="background:rgba(249,115,22,.08);font-weight:700;border-top:2px solid var(--orange)">
        <td colspan="4" style="padding:6px 10px;border:1px solid var(--border)">TOTAL (${sorted.length} records)</td>
        <td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:var(--amber)">${total.litres.toFixed(1)} L</td>
        <td style="padding:6px 10px;border:1px solid var(--border)"></td>
        <td style="padding:6px 10px;border:1px solid var(--border);text-align:right">E ${(total.cost/total.litres).toFixed(2)}</td>
        <td style="padding:6px 10px;border:1px solid var(--border);text-align:right;color:var(--orange)">E ${total.cost.toFixed(2)}</td>
        <td colspan="2" style="padding:6px 10px;border:1px solid var(--border)"></td>
      </tfoot>
    </table>`;
  },

  _varianceReport(data) {
    const inv=DB.get('plantInventory',S.project)||[];
    const plant=DB.get('plant',S.project)||[];
    const normD=v=>v?String(v).slice(0,10):'';
    const byReg={};
    data.forEach(f=>{
      if(!byReg[f.regId]) byReg[f.regId]={type:f.plantType||'—',records:[]};
      byReg[f.regId].records.push(f);
    });

    let html='<div style="display:flex;flex-direction:column;gap:16px">';
    html+=`<div style="background:rgba(59,130,246,.08);border:1px solid var(--blue);border-radius:8px;padding:10px 14px;font-size:11px;color:var(--text2)">
      <b style="color:var(--blue)">ℹ Variance Analysis</b> — Compares <b>actual fuel consumption</b> (litres issued ÷ hr-meter range) against the <b>theoretical consumption</b> in Plant Inventory (Fuel L/hr). 
      A positive variance means actual &gt; theoretical (over-consuming). Unit cost comparison = actual E/L vs (Fuel L/hr × unit cost) per hr.
    </div>`;

    Object.entries(byReg).forEach(([regId,grp])=>{
      const pi=inv.find(x=>x.regId===regId);
      const recs=grp.records.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const totL=recs.reduce((s,f)=>s+parseFloat(f.litres||0),0);
      const totC=recs.reduce((s,f)=>s+parseFloat(f.cost||0),0);
      const odos=recs.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);
      const hrRange=odos.length>=2?Math.max(...odos)-Math.min(...odos):0;

      // Actual consumption rate (L/hr)
      const actualLhr=hrRange>=0.5?totL/hrRange:null;
      // Theoretical from inventory
      const theorLhr=parseFloat(pi?.fuelConsumption||0)||null;
      // Variance
      const variance=actualLhr!==null&&theorLhr?actualLhr-theorLhr:null;
      const varPct=variance!==null&&theorLhr?variance/theorLhr*100:null;

      // Actual unit cost (E/L avg)
      const actualUnitCost=totL>0?totC/totL:0;
      // Theoretical cost rate = theorLhr × actualUnitCost (E/hr if running at spec)
      const theorCostHr=theorLhr&&actualUnitCost?theorLhr*actualUnitCost:null;
      // Actual cost rate = actualLhr × actualUnitCost
      const actualCostHr=actualLhr&&actualUnitCost?actualLhr*actualUnitCost:null;

      // Total worked hrs for this plant in date range
      const plantRecs=plant.filter(p=>p.regId===regId);
      const totWrkHrs=plantRecs.reduce((s,p)=>{
        const d=normD(p.date);
        const from=document.getElementById('frpt-from')?.value||'';
        const to=document.getElementById('frpt-to')?.value||'';
        if(from&&d<from) return s;
        if(to&&d>to) return s;
        const h=(p.hrClosing!=null&&p.hrOpening!=null&&p.hrClosing>p.hrOpening)?parseFloat(p.hrClosing)-parseFloat(p.hrOpening):(parseFloat(p.hrsWorked||0)||0);
        return s+h;
      },0);
      // Expected fuel cost = theorLhr × avgUnitCost × totWrkHrs
      const expectedFuelCost=theorLhr&&actualUnitCost&&totWrkHrs?theorLhr*actualUnitCost*totWrkHrs:null;
      const costVariance=expectedFuelCost!==null?totC-expectedFuelCost:null;

      const vColor=variance===null?'var(--text3)':variance>0?'var(--red)':variance<0?'var(--green)':'var(--text)';
      const vIcon=variance===null?'—':variance>2?'🔴 Over':variance<-2?'🟢 Under':'🟡 On-spec';

      html+=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:linear-gradient(90deg,rgba(249,115,22,.1) 0%,transparent);border-bottom:2px solid var(--orange)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-family:var(--fh);font-size:15px;font-weight:700;color:var(--orange)">${regId}</span>
            <span style="color:var(--text2);font-size:12px">${grp.type}</span>
            <span style="font-size:18px;font-weight:700">${vIcon}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Actual L/hr</div>
              <div style="font-size:18px;font-weight:700;color:var(--amber)">${actualLhr!==null?actualLhr.toFixed(2):'N/A'}</div>
              <div style="font-size:9px;color:var(--text3)">from ${hrRange.toFixed(1)} hr range</div>
            </div>
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Inventory Spec L/hr</div>
              <div style="font-size:18px;font-weight:700;color:var(--blue)">${theorLhr||'Not set'}</div>
              <div style="font-size:9px;color:var(--text3)">from Plant Inventory</div>
            </div>
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Variance</div>
              <div style="font-size:18px;font-weight:700;color:${vColor}">${variance!==null?((variance>0?'+':'')+variance.toFixed(2)+' L/hr'):'—'}</div>
              <div style="font-size:9px;color:${vColor}">${varPct!==null?((varPct>0?'+':'')+varPct.toFixed(1)+'% vs spec'):'—'}</div>
            </div>
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Actual E/hr (fuel)</div>
              <div style="font-size:18px;font-weight:700;color:var(--orange)">${actualCostHr!==null?'E '+actualCostHr.toFixed(2):'—'}</div>
              <div style="font-size:9px;color:var(--text3)">Theoretical: ${theorCostHr?'E '+theorCostHr.toFixed(2):'—'}</div>
            </div>
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Total Fuel Cost</div>
              <div style="font-size:18px;font-weight:700;color:var(--orange)">E ${totC.toFixed(2)}</div>
              <div style="font-size:9px;color:var(--text3)">Expected: ${expectedFuelCost!==null?'E '+expectedFuelCost.toFixed(2):'—'}</div>
            </div>
            <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
              <div style="font-size:9px;color:var(--text3);text-transform:uppercase;margin-bottom:2px">Cost Variance</div>
              <div style="font-size:18px;font-weight:700;color:${costVariance===null?'var(--text3)':costVariance>0?'var(--red)':'var(--green)'}">${costVariance!==null?((costVariance>0?'+ ':'')+'E '+Math.abs(costVariance).toFixed(2)):'—'}</div>
              <div style="font-size:9px;color:var(--text3)">${totWrkHrs>0?totWrkHrs.toFixed(1)+' hrs worked':''}</div>
            </div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:5px 10px;border:1px solid var(--border);text-align:left">Date</th>
            <th style="padding:5px 10px;border:1px solid var(--border);text-align:right">Litres</th>
            <th style="padding:5px 10px;border:1px solid var(--border);text-align:right">Hr Meter</th>
            <th style="padding:5px 10px;border:1px solid var(--border);text-align:right">E/L</th>
            <th style="padding:5px 10px;border:1px solid var(--border);text-align:right">Total Cost (E)</th>
            <th style="padding:5px 10px;border:1px solid var(--border)">Issued By</th>
          </tr></thead>
          <tbody>
            ${recs.map(f=>`<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px 10px;border:1px solid var(--border)">${new Date((normD(f.date)||'2000-01-01')+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
              <td style="padding:4px 10px;border:1px solid var(--border);text-align:right;color:var(--amber)">${parseFloat(f.litres||0).toFixed(1)} L</td>
              <td style="padding:4px 10px;border:1px solid var(--border);text-align:right;font-family:monospace;color:var(--blue)">${f.odometer||'—'}</td>
              <td style="padding:4px 10px;border:1px solid var(--border);text-align:right">E ${parseFloat(f.costPerLitre||0).toFixed(2)}</td>
              <td style="padding:4px 10px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--orange)">E ${parseFloat(f.cost||0).toFixed(2)}</td>
              <td style="padding:4px 10px;border:1px solid var(--border);font-size:10px">${f.issuedBy||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    });
    return html+'</div>';
  },


  _toCSV(headers,rows){const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;};return[headers.map(esc).join(','),...rows.map(r=>r.map(esc).join(','))].join('\n');},
  _download(name,content,mime){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:mime}));a.download=name;a.click();URL.revokeObjectURL(a.href);},

  exportCSV() {
    const data=this._filter();
    if(!data.length){alert('No fuel records to export');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const headers=['Date','Time Start','Time End','Reg/ID','Plant Type','Litres','Hr Meter','Unit Cost (E/L)','Total Cost (E)','Bowser Total','Recon Status','Issued By'];
    const rows=data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(f=>[normD(f.date),f.startTime||'',f.endTime||'',f.regId,f.plantType||'',parseFloat(f.litres||0).toFixed(1),f.odometer||'',parseFloat(f.costPerLitre||0).toFixed(2),parseFloat(f.cost||0).toFixed(2),f.bowserTotal||'',f.reconStatus||'',f.issuedBy||'']);
    this._download('Fuel_Disbursements.csv',this._toCSV(headers,rows),'text/csv');
  },

  exportExcel() {
    if(typeof XLSX==='undefined'){alert('Excel library not loaded. Use CSV export instead.');return;}
    const data=this._filter();
    if(!data.length){alert('No fuel records to export');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const headers=['Date','Start','End','Reg/ID','Plant Type','Litres','Hr Meter','E/L','Total Cost (E)','Recon','Issued By'];
    const aoa=[headers,...data.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(f=>[normD(f.date),f.startTime||'',f.endTime||'',f.regId,f.plantType||'',+parseFloat(f.litres||0).toFixed(1),f.odometer||'',+parseFloat(f.costPerLitre||0).toFixed(2),+parseFloat(f.cost||0).toFixed(2),f.reconStatus||'',f.issuedBy||''])];
    const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(aoa);XLSX.utils.book_append_sheet(wb,ws,'Fuel Disbursements');XLSX.writeFile(wb,'Fuel_Disbursements.xlsx');
  },

  print() {
    if(this._activeType===2) return this._printFuelCost();
    if(this._activeType===3) return this._printVariance();
    return this._printConsumption();
  },

  _fuelPrintBase(data,regId) {
    const normD=v=>v?String(v).slice(0,10):'';
    const _proj=DB.getProject(S.project)||{};
    const projName=_proj.name||S.project;
    const contractNo=_proj.contractNo||S.project;
    const inv=DB.get('plantInventory',S.project)||[];
    const pi=inv.find(x=>x.regId===regId)||{};
    const from=document.getElementById('frpt-from')?.value||'';
    const to=document.getElementById('frpt-to')?.value||'';
    const recs=data.filter(f=>f.regId===regId);
    const totL=recs.reduce((s,f)=>s+parseFloat(f.litres||0),0);
    const totC=recs.reduce((s,f)=>s+parseFloat(f.cost||0),0);
    const odos=recs.map(f=>parseFloat(f.odometer||0)).filter(v=>v>0);
    const hrRange=odos.length>=2?Math.max(...odos)-Math.min(...odos):0;
    const actualLhr=hrRange>=0.5?totL/hrRange:null;
    const theorLhr=parseFloat(pi.fuelConsumption||0)||null;
    const variance=actualLhr!==null&&theorLhr?actualLhr-theorLhr:null;
    return {projName,contractNo,pi,from,to,recs,totL,totC,odos,hrRange,actualLhr,theorLhr,variance};
  },

  _kpis(items) {
    return '<table style="width:100%;border-collapse:collapse;margin:6px 0 8px;border:1.5px solid #333">'
      +'<tr style="background:#f0f0f0">'
      +items.map(function(x){return '<th style="padding:4px 10px;text-align:left;border:1px solid #ccc;font-size:9px;font-weight:700;text-transform:uppercase;color:#333">'+x[0]+'</th>';}).join('')
      +'</tr><tr>'
      +items.map(function(x){return '<td style="padding:5px 10px;border:1px solid #ccc;font-size:12px;font-weight:700;color:'+x[2]+'">'+x[1]+'</td>';}).join('')
      +'</tr></table>';
  },

  _openWin(title,pages,docId) {
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>'+title+'</title><style>'+ReportSettings.css(docId)+'</style></head><body>'+pages+'</body></html>');
    w.document.close();setTimeout(()=>w.print(),300);
  },

  _printConsumption() {
    const data=this._filter();
    if(!data.length){alert('No fuel records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'--';
    const regIds=[...new Set(data.map(f=>f.regId).filter(Boolean))].sort();
    let pages='';
    regIds.forEach(regId=>{
      const b=this._fuelPrintBase(data,regId);
      const byDate={};
      b.recs.forEach(f=>{const d=normD(f.date);if(!byDate[d])byDate[d]={litres:0,cost:0,fills:0};byDate[d].litres+=parseFloat(f.litres||0);byDate[d].cost+=parseFloat(f.cost||0);byDate[d].fills++;});
      const dates=Object.keys(byDate).sort();
      const maxL=Math.max(...dates.map(d=>byDate[d].litres),1);
      const rate7d=b.hrRange>=0.5?b.totC/b.hrRange:0;
      const rows=dates.map((d,i)=>{const r=byDate[d];const bw=Math.round(r.litres/maxL*80);return '<tr style="background:'+(i%2?'#f9f9f9':'#fff')+'"><td>'+fmtD(d)+'</td><td style="text-align:right">'+r.fills+'</td><td style="text-align:right;font-weight:700;color:#c85000">'+r.litres.toFixed(1)+' L</td><td style="text-align:right">E '+r.cost.toFixed(2)+'</td><td style="text-align:right">'+(r.litres>0?'E '+(r.cost/r.litres).toFixed(2):'--')+'</td><td><div style="background:#e5e7eb;border-radius:3px;height:10px;width:100px"><div style="background:#f97316;height:10px;border-radius:3px;width:'+bw+'px"></div></div></td></tr>';});
      pages+='<div class="page">'+ReportSettings.header(b.projName,b.contractNo,b.from,b.to,regId,b.pi,0,0,'Consumption Analysis','fuel_disbursements')
        +this._kpis([['Total Litres',b.totL.toFixed(1)+' L','#c85000'],['Total Cost','E '+b.totC.toFixed(2),'#c85000'],['7-Day Rate',rate7d>0?'E '+rate7d.toFixed(2)+'/hr':'N/A','#1a56db'],['Avg E/L',b.totL>0?'E '+(b.totC/b.totL).toFixed(2):'--','#555']])
        +'<table class="data-table"><thead><tr><th>Date</th><th>Fills</th><th>Litres</th><th>Cost (E)</th><th>E/L</th><th>Visual</th></tr></thead><tbody>'+rows.join('')+'</tbody>'
        +'<tfoot><tr class="rpt-total"><td>TOTAL</td><td style="text-align:right">'+b.recs.length+'</td><td style="text-align:right;color:#c85000">'+b.totL.toFixed(1)+' L</td><td style="text-align:right;color:#c85000">E '+b.totC.toFixed(2)+'</td><td style="text-align:right">'+(b.totL>0?'E '+(b.totC/b.totL).toFixed(2):'--')+'</td><td style="font-size:9px">Hr range: '+(b.odos.length>=2?Math.min(...b.odos).toFixed(1)+' to '+Math.max(...b.odos).toFixed(1):'--')+'</td></tr></tfoot></table></div>';
    });
    this._openWin('Fuel Consumption Report',pages,'fuel_disbursements');
  },

  _printFuelCost() {
    const data=this._filter();
    if(!data.length){alert('No fuel records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'--';
    const regIds=[...new Set(data.map(f=>f.regId).filter(Boolean))].sort();
    let pages='';
    regIds.forEach(regId=>{
      const b=this._fuelPrintBase(data,regId);
      const sorted=b.recs.slice().sort((a,x)=>String(a.date).localeCompare(String(x.date)));
      const rows=sorted.map((f,i)=>'<tr style="background:'+(i%2?'#f9f9f9':'#fff')+'"><td>'+fmtD(normD(f.date))+'</td><td style="text-align:center;font-size:9px">'+(f.startTime||'--')+' to '+(f.endTime||'--')+'</td><td style="font-family:monospace">'+regId+'</td><td>'+(f.plantType||'--')+'</td><td style="text-align:right;font-weight:700;color:#c85000">'+parseFloat(f.litres||0).toFixed(1)+' L</td><td style="text-align:right;font-family:monospace">'+(f.odometer||'--')+'</td><td style="text-align:right">E '+parseFloat(f.costPerLitre||0).toFixed(2)+'</td><td style="text-align:right;font-weight:700;color:#c85000">E '+parseFloat(f.cost||0).toFixed(2)+'</td><td style="text-align:center">'+(f.reconStatus==='OK'?'OK':f.reconStatus==='VARIANCE'?'VAR':'--')+'</td><td style="font-size:9px">'+(f.issuedBy||'--')+'</td></tr>');
      pages+='<div class="page">'+ReportSettings.header(b.projName,b.contractNo,b.from,b.to,regId,b.pi,0,0,'Fuel Cost Report','fuel_disbursements')
        +this._kpis([['Total Litres',b.totL.toFixed(1)+' L','#c85000'],['Total Cost','E '+b.totC.toFixed(2),'#c85000'],['Avg Unit Cost',b.totL>0?'E '+(b.totC/b.totL).toFixed(2)+'/L':'--','#1a56db']])
        +'<table class="data-table"><thead><tr><th>Date</th><th>Time</th><th>Reg/ID</th><th>Plant Type</th><th>Litres</th><th>Hr Meter</th><th>E/L</th><th>Total Cost</th><th>Recon</th><th>Issued By</th></tr></thead><tbody>'+rows.join('')+'</tbody>'
        +'<tfoot><tr class="rpt-total"><td colspan="4">TOTAL ('+sorted.length+')</td><td style="text-align:right;color:#c85000">'+b.totL.toFixed(1)+' L</td><td></td><td style="text-align:right">'+(b.totL>0?'E '+(b.totC/b.totL).toFixed(2):'--')+'</td><td style="text-align:right;color:#c85000">E '+b.totC.toFixed(2)+'</td><td colspan="2"></td></tr></tfoot></table></div>';
    });
    this._openWin('Fuel Cost Report',pages,'fuel_disbursements');
  },

  _printVariance() {
    const data=this._filter();
    if(!data.length){alert('No fuel records to print');return;}
    const normD=v=>v?String(v).slice(0,10):'';
    const fmtD=v=>v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'--';
    const regIds=[...new Set(data.map(f=>f.regId).filter(Boolean))].sort();
    let pages='';
    regIds.forEach(regId=>{
      const b=this._fuelPrintBase(data,regId);
      const actualUC=b.totL>0?b.totC/b.totL:0;
      const theorCHr=b.theorLhr&&actualUC?b.theorLhr*actualUC:null;
      const actualCHr=b.actualLhr&&actualUC?b.actualLhr*actualUC:null;
      const varPct=b.variance!==null&&b.theorLhr?b.variance/b.theorLhr*100:null;
      const vColor=b.variance===null?'#555':b.variance>2?'#c00':b.variance<-2?'#16a34a':'#c85000';
      const vLabel=b.variance===null?'N/A':(b.variance>2?'OVER-CONSUMING':b.variance<-2?'UNDER-CONSUMING':'ON-SPEC')+(varPct!==null?' ('+(varPct>0?'+':'')+varPct.toFixed(1)+'%)':'');
      const sorted=b.recs.slice().sort((a,x)=>String(a.date).localeCompare(String(x.date)));
      const rows=sorted.map((f,i)=>'<tr style="background:'+(i%2?'#f9f9f9':'#fff')+'"><td>'+fmtD(normD(f.date))+'</td><td style="text-align:right;color:#c85000">'+parseFloat(f.litres||0).toFixed(1)+' L</td><td style="text-align:right;font-family:monospace;color:#1a56db">'+(f.odometer||'--')+'</td><td style="text-align:right">E '+parseFloat(f.costPerLitre||0).toFixed(2)+'</td><td style="text-align:right;font-weight:700;color:#c85000">E '+parseFloat(f.cost||0).toFixed(2)+'</td><td style="font-size:9px">'+(f.issuedBy||'--')+'</td></tr>');
      pages+='<div class="page">'+ReportSettings.header(b.projName,b.contractNo,b.from,b.to,regId,b.pi,0,0,'Variance vs Inventory','fuel_variance')
        +this._kpis([['Actual L/hr',b.actualLhr!==null?b.actualLhr.toFixed(2)+' L/hr':'N/A',vColor],['Inventory Spec',b.theorLhr?b.theorLhr+' L/hr':'Not set','#1a56db'],['Status',vLabel,vColor],['Actual E/hr',actualCHr?'E '+actualCHr.toFixed(2):'--','#c85000'],['Theoretical E/hr',theorCHr?'E '+theorCHr.toFixed(2):'--','#1a56db'],['Total Cost','E '+b.totC.toFixed(2),'#7e22ce']])
        +'<table class="data-table"><thead><tr><th>Date</th><th>Litres</th><th>Hr Meter</th><th>E/L</th><th>Total Cost</th><th>Issued By</th></tr></thead><tbody>'+rows.join('')+'</tbody>'
        +'<tfoot><tr class="rpt-total"><td>TOTAL</td><td style="text-align:right;color:#c85000">'+b.totL.toFixed(1)+' L</td><td style="font-size:9px">Range: '+(b.odos.length>=2?Math.min(...b.odos).toFixed(1)+' to '+Math.max(...b.odos).toFixed(1):'--')+'</td><td style="text-align:right">'+(b.totL>0?'E '+(b.totC/b.totL).toFixed(2):'--')+'</td><td style="text-align:right;color:#c85000">E '+b.totC.toFixed(2)+'</td><td></td></tr></tfoot></table></div>';
    });
    this._openWin('Fuel Variance Report',pages,'fuel_variance');
  }
,

  printRange(from, to) {
    const _origGet = DB.get.bind(DB);
    const norm = v => v ? String(v).slice(0,10) : '';
    DB.get = (sheet, proj) => {
      const data = _origGet(sheet, proj);
      if (!from && !to) return data;
      if (['fuelIssues','plantInventory'].includes(sheet)) {
        if (sheet === 'plantInventory') return data;
        return data.filter(r => { const d=norm(r.date); return (!from||d>=from)&&(!to||d<=to); });
      }
      return data;
    };
    try { this.print(); } finally { DB.get = _origGet; }
  }
};

  // ── Mobile datalist fix: fire 'input' on 'change' for cross-platform reliability
  document.addEventListener('change', function(e) {
    if(e.target && e.target.getAttribute && e.target.getAttribute('list')) {
      e.target.dispatchEvent(new Event('input', {bubbles:true}));
    }
  });



(function(){
  function g(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function money(n){return 'E ' + Number(n||0).toLocaleString('en',{maximumFractionDigits:0});}
  function bdg(st){var k=(st==='active')?'active':(st==='trial')?'trial':(st==='suspended')?'suspended':'none';return '<span class="pa-badge '+k+'">'+esc(st)+'</span>';}
  function dleft(d){ if(!d) return null; var v=Math.ceil((Date.parse(d)-Date.now())/86400000); return isNaN(v)?null:v; }
  function daysCell(d){ var v=dleft(d); if(v===null) return '<span class="pa-mini">—</span>'; var cls=v<0?'over':(v<=14?'soon':'ok'); var txt=v<0?(Math.abs(v)+'d overdue'):(v+'d left'); return '<span class="pa-days '+cls+'">'+txt+'</span>'; }
  function fmtDate(d){ return d?new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'; }
  function seatCell(c){ var live=c.live||0; if(c.seats===null) return '<span class="pa-seat na">'+live+' / &infin;</span>'; var cls=live>c.seats?'over':(live>=c.seats?'full':'ok'); return '<span class="pa-seat '+cls+'">'+live+' / '+c.seats+'</span>'; }
  var ROLES=['Admin','Editor','Approver','DataEntry','Foreman','StoresAssistant','Viewer'];

  window.PA={
    _tab:'overview', _d:null, _q:'', _openId:null, _sOpen:null, _prices:{}, _storage:null, _tips:null, _tipEdit:null, _ann:null, _annEdit:null, _audit:null, _auditOrg:'',
    open:function(){ this._loadPrices(); g('pa-root').style.display='block'; this.reload(); },
    close:function(){ g('pa-root').style.display='none'; },
    _planList:function(){ return ['trial','starter','pro','max']; },
    _planOpts:function(cur){ var a=this._planList().slice(); if(cur && a.indexOf(cur)<0) a.unshift(cur); return a.map(function(p){return '<option value="'+p+'"'+(cur===p?' selected':'')+'>'+p+'</option>';}).join(''); },
    _fmtSize:function(b){ b=+b||0; if(b<1024)return b+' B'; if(b<1048576)return (b/1024).toFixed(1)+' KB'; if(b<1073741824)return (b/1048576).toFixed(2)+' MB'; return (b/1073741824).toFixed(2)+' GB'; },
    _loadPrices:function(){ try{ var p=JSON.parse(localStorage.getItem('pa_prices')||'{}'); var o={}; this._planList().forEach(function(k){ o[k]=+p[k]||0; }); this._prices=o; }catch(e){ this._prices={}; } },
    msg:function(t,ok){ var m=g('pa-msg'); if(!m)return; m.style.color=ok?'#166534':'#b91c1c'; m.textContent=t; },
    priceOf:function(c){ return c.price!=null?c.price:(+this._prices[c.plan]||0); },
    discOn:function(c){ if(!(c.discPct>0))return false; var t=Date.now(); if(c.discFrom && Date.parse(c.discFrom)>t)return false; if(c.discTo && (Date.parse(c.discTo)+86400000)<=t)return false; return true; },
    subOf:function(c){ return (c.seats||0)*this.priceOf(c); },
    totOf:function(c){ var s=this.subOf(c); return this.discOn(c)? Math.round(s*(1-c.discPct/100)) : s; },
    async reload(){
      var host=g('pa-content'); if(this._tab!=='companies') host.innerHTML='<div class="pa-empty">Loading…</div>';
      // Pull default pricing from the database (syncs across devices); localStorage is the fallback.
      try{ if(window.SB&&SB.platform&&SB.platform.getSetting){ var pv=await SB.platform.getSetting('pa_default_prices');
        if(pv){ var po=(typeof pv==='string')?JSON.parse(pv):pv; var o={}; var self=this; this._planList().forEach(function(k){ o[k]=+po[k]||0; }); this._prices=o; try{ localStorage.setItem('pa_prices',JSON.stringify(o)); }catch(e){} } } }catch(e){}
      try{ this._d=await SB.platform._load(); this.render(); }
      catch(e){ host.innerHTML='<div class="pa-sec" style="color:#b91c1c">Could not load platform data: '+esc(e.message)+'</div>'; }
    },
    render:function(){
      var tabs=document.querySelectorAll('.pa-tab');
      for(var i=0;i<tabs.length;i++){ tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab')===this._tab); }
      if(this._tab==='overview') this.renderOverview();
      else if(this._tab==='companies') this.renderCompanies();
      else if(this._tab==='logins') this.renderLogins();
      else if(this._tab==='billing') this.renderBilling();
      else if(this._tab==='storage') this.renderStorage();
      else if(this._tab==='tips') this.renderTips();
      else if(this._tab==='notices') this.renderNotices();
      else if(this._tab==='audit') this.renderAudit();
    },

    renderOverview:function(){
      var self=this, d=this._d, c=d.companies;
      var active=c.filter(function(x){return x.status==='active';}).length;
      var trial=c.filter(function(x){return x.status==='trial';}).length;
      var susp=c.filter(function(x){return x.status==='suspended';}).length;
      var logins=c.reduce(function(s,x){return s+x.logins;},0);
      var mrr=c.filter(function(x){return x.status==='active';}).reduce(function(s,x){return s+self.totOf(x);},0);
      var expiring=c.filter(function(x){ var v=dleft(x.activeUntil); return (x.status==='active'||x.status==='trial') && v!==null && v<=14; }).sort(function(a,b){return dleft(a.activeUntil)-dleft(b.activeUntil);});
      var overSeat=c.filter(function(x){ return x.seats!==null && x.logins>x.seats; });
      var renew=c.filter(function(x){return x.activeUntil;}).sort(function(a,b){return String(a.activeUntil).localeCompare(String(b.activeUntil));}).slice(0,6);
      var h='';
      h+='<p class="pa-eyebrow">At a glance</p><div class="pa-metrics">'
        +'<div class="pa-card"><div class="n">'+c.length+'</div><div class="l">Companies</div></div>'
        +'<div class="pa-card good"><div class="n">'+active+'</div><div class="l">Active</div></div>'
        +'<div class="pa-card warn"><div class="n">'+trial+'</div><div class="l">On trial</div></div>'
        +'<div class="pa-card bad"><div class="n">'+susp+'</div><div class="l">Suspended</div></div>'
        +'<div class="pa-card"><div class="n">'+logins+'</div><div class="l">Licensed users</div></div>'
        +'<div class="pa-card good"><div class="n">'+money(mrr)+'</div><div class="l">MRR</div></div>'
        +'</div>';
      h+='<div class="pa-sec"><h3>Needs attention</h3>'; var att='';
      if(d.unlinked.length){ att+='<div class="pa-row"><span class="pa-mini"><b>'+d.unlinked.length+'</b> login'+(d.unlinked.length>1?'s':'')+' not linked to a company.</span><button class="pa-btn sm" data-act="tab" data-tab="logins">Review</button></div>'; }
      overSeat.forEach(function(x){ att+='<div class="pa-row"><span class="pa-mini"><b>'+esc(x.name)+'</b> is over its licenses ('+x.logins+' users / '+x.seats+' seats).</span><button class="pa-btn sm" data-act="manage" data-id="'+esc(x.id)+'">Manage</button></div>'; });
      if(expiring.length){ att+='<table class="pa-tbl"><tbody>'; expiring.forEach(function(x){ att+='<tr><td class="pa-co">'+esc(x.name)+' '+bdg(x.status)+'</td><td>'+daysCell(x.activeUntil)+'</td><td class="num"><button class="pa-btn sm" data-act="manage" data-id="'+esc(x.id)+'">Manage</button></td></tr>'; }); att+='</tbody></table>'; }
      c.filter(function(x){return x.status==='suspended';}).forEach(function(x){ att+='<div class="pa-row"><span class="pa-mini"><b>'+esc(x.name)+'</b> is suspended.</span><button class="pa-btn sm" data-act="manage" data-id="'+esc(x.id)+'">Manage</button></div>'; });
      h+= att || '<div class="pa-mini">All good — nothing needs your attention.</div>'; h+='</div>';
      h+='<div class="pa-sec"><h3>Upcoming renewals</h3>';
      if(renew.length){ h+='<table class="pa-tbl"><thead><tr><th>Company</th><th>Next expiry</th><th>Standing</th><th></th></tr></thead><tbody>'; renew.forEach(function(x){ h+='<tr><td class="pa-co">'+esc(x.name)+' '+bdg(x.status)+'</td><td class="pa-mini">'+fmtDate(x.activeUntil)+'</td><td>'+daysCell(x.activeUntil)+'</td><td class="num"><button class="pa-btn sm" data-act="manage" data-id="'+esc(x.id)+'">Manage</button></td></tr>'; }); h+='</tbody></table>'; }
      else h+='<div class="pa-empty">No expiry dates set yet. Set a paid-through date on a company to track renewals.</div>';
      h+='</div>';
      g('pa-content').innerHTML=h;
    },

    renderCompanies:function(){
      var h='<div class="pa-row"><input class="pa-inp" data-act="filter" placeholder="Search companies…" value="'+esc(this._q)+'" style="max-width:280px"><div style="flex:1"></div><button class="pa-btn pri" data-act="addToggle">+ Add company</button></div>';
      h+='<div id="pa-addform" class="pa-form" style="display:none">'
        +'<div class="pa-fld"><label>Company name</label><input class="pa-inp" id="pa-new-name" placeholder="Acme Construction Ltd"></div>'
        +'<div class="pa-fld"><label>Company ID</label><input class="pa-inp" id="pa-new-id" placeholder="ORG-ACME"></div>'
        +'<div class="pa-fld"><label>Status</label><select class="pa-sel" id="pa-new-status"><option value="trial">trial</option><option value="active">active</option></select></div>'
        +'<div class="pa-fld"><label>Plan</label><select class="pa-sel" id="pa-new-plan">'+this._planOpts('trial')+'</select></div>'
        +'<div class="pa-fld"><label>Seats</label><input class="pa-inp" id="pa-new-seats" type="number" min="1" placeholder="4"></div>'
        +'<div class="pa-fld"><label>&nbsp;</label><button class="pa-btn pri" data-act="add">Create company</button></div>'
        +'</div>';
      h+='<div class="pa-sec" style="padding:6px 0"><div id="pa-ctable"></div></div><div id="pa-msg" class="pa-msg"></div>';
      g('pa-content').innerHTML=h; this.renderCompanyTable();
    },
    renderCompanyTable:function(){
      var self=this, q=this._q.toLowerCase();
      var list=this._d.companies.filter(function(x){ return !q || x.name.toLowerCase().indexOf(q)>=0 || x.id.toLowerCase().indexOf(q)>=0; });
      var rows='';
      list.forEach(function(x){
        rows+='<tr><td class="pa-co">'+esc(x.name)+'<div class="pa-id">'+esc(x.id)+'</div></td>'
          +'<td>'+bdg(x.status)+'</td><td>'+esc(x.plan)+'</td><td class="num">'+x.users+'</td><td>'+seatCell(x)+'</td>'
          +'<td class="num">'+x.projects+'</td><td class="num pa-mini">'+fmtDate(x.activeUntil)+'</td>'
          +'<td class="num"><button class="pa-btn sm" data-act="detail" data-id="'+esc(x.id)+'">'+(self._openId===x.id?'Close':'Manage')+'</button></td></tr>';
        if(self._openId===x.id){ rows+='<tr><td colspan="8" style="padding:0"><div id="pa-detailbox" class="pa-detail">Loading…</div></td></tr>'; }
      });
      g('pa-ctable').innerHTML='<table class="pa-tbl"><thead><tr><th>Company</th><th>Status</th><th>Plan</th><th class="num">Users</th><th>Live / seats</th><th class="num">Projects</th><th class="num">Next expiry</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="pa-empty">No companies match.</td></tr>')+'</tbody></table>';
      if(this._openId) this.fillDetail(this._openId);
    },
    async fillDetail(id){
      var self=this, c=null, arr=this._d.companies; for(var i=0;i<arr.length;i++){ if(arr[i].id===id){c=arr[i];break;} }
      if(!c) return; var box=g('pa-detailbox'); if(!box) return;
      var det={admins:[],projects:[]}; try{ det=await SB.platform.detail(id); }catch(e){}
      var planOpts=self._planOpts(c.plan);
      var admins=det.admins.length?det.admins.map(function(a){return '<div class="pa-mini"><b>'+esc(a.email)+'</b> — '+esc(a.role||'—')+'</div>';}).join(''):'<div class="pa-mini">No admins linked yet.</div>';
      var projs=det.projects.length?det.projects.map(function(p){return '<div class="pa-mini">'+esc(p.name||p.code)+' <span class="pa-id">'+esc(p.status||'')+'</span></div>';}).join(''):'<div class="pa-mini">No projects yet.</div>';
      var disc=self.discOn(c);
      box.innerHTML=
        '<div class="grp"><span class="lbl">Subscription</span><div class="flx">'+bdg(c.status)
          +'<button class="pa-btn sm" data-act="setactive" data-id="'+esc(id)+'">Activate</button>'
          +'<button class="pa-btn sm dang" data-act="suspend" data-id="'+esc(id)+'">Suspend</button>'
          +'<select class="pa-sel" data-act="plan" data-id="'+esc(id)+'" style="padding:5px 8px">'+planOpts+'</select></div></div>'
        +'<div class="grp"><span class="lbl">Paid-through date</span><div class="flx">'
          +'<input class="pa-inp" data-role="date" type="date" value="'+esc((c.activeUntil||'').slice(0,10))+'" style="padding:6px 8px">'
          +'<button class="pa-btn sm" data-act="savedate" data-id="'+esc(id)+'">Save date</button>'+daysCell(c.activeUntil)+'</div></div>'
        +'<div class="grp"><span class="lbl">Licenses &amp; billing &nbsp; ('+seatCell(c)+' signed in &middot; '+c.users+' users on file)</span>'
          +'<div class="pa-bgrid">'
            +'<div class="pa-fld"><label>Seats (licenses)</label><input class="pa-inp" data-role="seats" type="number" min="0" value="'+(c.seats===null?'':c.seats)+'"></div>'
            +'<div class="pa-fld"><label>Price / license (E)</label><input class="pa-inp" data-role="price" type="number" min="0" value="'+(c.price===null?'':c.price)+'" placeholder="plan default"></div>'
            +'<div class="pa-fld"><label>Discount %</label><input class="pa-inp" data-role="discpct" type="number" min="0" max="100" value="'+(c.discPct||'')+'"></div>'
            +'<div class="pa-fld"><label>Discount from</label><input class="pa-inp" data-role="discfrom" type="date" value="'+esc(c.discFrom||'')+'"></div>'
            +'<div class="pa-fld"><label>Discount to</label><input class="pa-inp" data-role="discto" type="date" value="'+esc(c.discTo||'')+'"></div>'
            +'<div class="pa-fld"><label>Billing note</label><input class="pa-inp" data-role="bnotes" value="'+esc(c.notes||'')+'" placeholder="PO / reference"></div>'
          +'</div>'
          +'<div class="flx" style="margin-top:10px"><button class="pa-btn pri sm" data-act="savebilling" data-id="'+esc(id)+'">Save licenses &amp; billing</button>'
            +'<span class="pa-tot">Subtotal '+money(self.subOf(c))+(disc?(' &nbsp;·&nbsp; <span class="pa-pill">-'+c.discPct+'% active</span>'):'')+' &nbsp;→&nbsp; Total <b>'+money(self.totOf(c))+'</b> /mo</span></div></div>'
        +'<div class="grp"><span class="lbl">Company name</span><div class="flx"><input class="pa-inp" data-role="name" value="'+esc(c.name)+'" style="min-width:220px"><button class="pa-btn sm" data-act="rename" data-id="'+esc(id)+'">Rename</button></div></div>'
        +'<div class="grp"><span class="lbl">Admins &amp; users</span>'+admins+'</div>'
        +'<div class="grp"><span class="lbl">Projects ('+det.projects.length+')</span>'+projs+'</div>'
        +'<div class="grp"><button class="pa-btn dang sm" data-act="del" data-id="'+esc(id)+'">Delete company</button> <span class="pa-mini">Removes company + subscription. Data rows remain.</span></div>'
        +'<div id="pa-msg" class="pa-msg"></div>';
    },

    renderLogins:function(){
      var d=this._d;
      var orgOpts=d.companies.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('');
      var roleOpts=ROLES.map(function(r){return '<option>'+r+'</option>';}).join('');
      var h='<div class="pa-note"><b>To create a login:</b> Supabase &rarr; Authentication &rarr; Add user (email + password, tick Auto Confirm). It appears below under “Unlinked”, then link it — you can only link within a company&#39;s seat count.</div>';
      h+='<div class="pa-sec"><h3>Unlinked logins ('+d.unlinked.length+')</h3>';
      if(d.unlinked.length){
        h+='<table class="pa-tbl"><thead><tr><th>Email</th><th>Company</th><th>Role</th><th></th></tr></thead><tbody>';
        d.unlinked.forEach(function(p){ h+='<tr data-row><td class="pa-co">'+esc(p.email)+'</td><td><select class="pa-sel" data-role="org">'+orgOpts+'</select></td><td><select class="pa-sel" data-role="role">'+roleOpts+'</select></td><td class="num"><button class="pa-btn pri sm" data-act="link" data-email="'+esc(p.email)+'">Link</button></td></tr>'; });
        h+='</tbody></table>';
      } else h+='<div class="pa-empty">No unlinked logins.</div>';
      h+='</div>';
      h+='<div class="pa-sec"><h3>All company logins ('+d.linked.length+')</h3>';
      if(d.linked.length){
        var nameById={}, seatById={}, useById={};
        d.companies.forEach(function(x){nameById[x.id]=x.name;seatById[x.id]=x.seats;useById[x.id]=x.logins;});
        h+='<table class="pa-tbl"><thead><tr><th>Email</th><th>Company</th><th>Role</th><th>Move to</th><th></th></tr></thead><tbody>';
        d.linked.forEach(function(p){
          var roleSel='<select class="pa-sel" data-act="role" data-email="'+esc(p.email)+'" style="padding:5px 8px">'+ROLES.map(function(r){return '<option'+(p.role===r?' selected':'')+'>'+r+'</option>';}).join('')+'</select>';
          var moveSel='<select class="pa-sel" data-act="move" data-email="'+esc(p.email)+'" style="padding:5px 8px"><option value="">move…</option>'+d.companies.map(function(x){return x.id===p.orgId?'':'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('')+'</select>';
          h+='<tr data-row><td class="pa-co">'+esc(p.email)+'</td><td class="pa-mini"><b>'+esc(nameById[p.orgId]||p.orgId)+'</b></td><td>'+roleSel+'</td><td>'+moveSel+'</td><td class="num"><button class="pa-btn dang sm" data-act="unlink" data-email="'+esc(p.email)+'">Unlink</button></td></tr>';
        });
        h+='</tbody></table>';
      } else h+='<div class="pa-empty">No company logins yet.</div>';
      h+='</div><div id="pa-msg" class="pa-msg"></div>';
      g('pa-content').innerHTML=h;
    },

    _tipTabs:function(){ return [
      {key:'*',label:'General (all screens)'},
      {key:'dashboard',label:'Dashboard'},
      {key:'production',label:'Production'},
      {key:'payroll',label:'Payroll'},
      {key:'accounting',label:'Accounting'},
      {key:'organization',label:'Organization'},
      {key:'settings-main',label:'Settings'},
      {key:'role-permissions',label:'Role Permissions'}
    ]; },
    _tipForm:function(t){
      t=t||{}; var id=t.id||'';
      return '<div class="pa-detail" data-tipform="'+esc(id||('new:'+(t.tab||'*')))+'">'
        +'<div class="pa-fld"><label>Heading</label><input class="pa-inp" data-f="heading" value="'+esc(t.heading||'')+'" placeholder="e.g. Assign Assistants"></div>'
        +'<div class="pa-fld"><label>Wording</label><textarea class="pa-inp" data-f="body" rows="3" placeholder="The tip text your users will read…">'+esc(t.body||'')+'</textarea></div>'
        +'<div class="pa-fld"><label>Screenshot</label><div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">'
          +'<div id="tipimg-prev" style="width:132px;height:80px;border-radius:7px;border:1px solid #e2e8f0;overflow:hidden;background:#f8fafc;flex:none">'+(t.image?'<img src="'+esc(t.image)+'" style="width:100%;height:100%;object-fit:cover">':'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">no image</div>')+'</div>'
          +'<div style="flex:1;min-width:220px"><input type="file" accept="image/*" data-act="tipimgfile" style="font-size:11px">'
          +'<div class="pa-mini" style="margin:4px 0">Upload a screenshot (auto-compressed), or paste an image URL:</div>'
          +'<input class="pa-inp" data-f="image" value="'+esc(t.image||'')+'" placeholder="https://…"></div>'
        +'</div></div>'
        +'<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:4px">'
          +'<label style="font-size:12px;color:#334155;display:flex;align-items:center;gap:6px"><input type="checkbox" data-f="published" '+(t.published!==false?'checked':'')+'> Published (visible to Pro / Max)</label>'
          +'<div class="pa-fld" style="max-width:88px;margin:0"><label>Order</label><input class="pa-inp" data-f="sort" type="number" value="'+(t.sort||0)+'"></div>'
        +'</div>'
        +'<div style="display:flex;gap:8px;margin-top:10px"><button class="pa-btn pri sm" data-act="tipsave" data-id="'+esc(id)+'" data-tab="'+esc(t.tab||'*')+'">Save tip</button>'
          +'<button class="pa-btn sm" data-act="tipcancel">Cancel</button></div>'
        +'</div>';
    },
    async renderTips(){
      var self=this, host=g('pa-content');
      host.innerHTML='<div class="pa-empty">Loading tips…</div>';
      try{ this._tips=await SB.platform.tipsAll(); }
      catch(e){ host.innerHTML='<div class="pa-sec" style="color:#b91c1c">Could not load tips: '+esc(e.message)+'<div class="pa-mini" style="margin-top:6px">Run <b>civmetrix_step12_tips.sql</b> in Supabase, then reopen this tab.</div></div>'; return; }
      var byTab={}; (this._tips||[]).forEach(function(t){ (byTab[t.tab]=byTab[t.tab]||[]).push(t); });
      var total=(this._tips||[]).length, pub=(this._tips||[]).filter(function(t){return t.published;}).length;
      var h='<p class="pa-eyebrow">Tips shown to Pro / Max users</p>'
        +'<div class="pa-metrics">'
        +'<div class="pa-card"><div class="n">'+total+'</div><div class="l">Total tips</div></div>'
        +'<div class="pa-card good"><div class="n">'+pub+'</div><div class="l">Published</div></div>'
        +'<div class="pa-card warn"><div class="n">'+(total-pub)+'</div><div class="l">Drafts</div></div>'
        +'</div>'
        +'<div class="pa-mini" style="margin:-4px 2px 12px">Users see tips for the tab they\u2019re on (plus General). Write the wording, attach a screenshot, tick Published \u2014 changes reach Pro/Max users on their next sign-in.</div>';
      this._tipTabs().forEach(function(tt){
        var arr=(byTab[tt.key]||[]).slice().sort(function(a,b){return (a.sort||0)-(b.sort||0);});
        h+='<div class="pa-sec"><div style="display:flex;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1">'+esc(tt.label)+' <span class="pa-mini">('+arr.length+')</span></h3>'
          +'<button class="pa-btn pri sm" data-act="tipadd" data-tab="'+esc(tt.key)+'">+ Add tip</button></div>';
        if(self._tipEdit==='new:'+tt.key) h+=self._tipForm({tab:tt.key});
        if(arr.length){
          h+='<table class="pa-tbl"><tbody>';
          arr.forEach(function(t){
            h+='<tr><td style="width:58px">'+(t.image?'<img src="'+esc(t.image)+'" style="width:48px;height:34px;object-fit:cover;border-radius:5px;border:1px solid #e2e8f0">':'<div style="width:48px;height:34px;border-radius:5px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px">&#128247;</div>')+'</td>'
              +'<td><div class="pa-co">'+esc(t.heading||'(no heading)')+(t.published?'':' <span class="pa-badge none">draft</span>')+'</div><div class="pa-mini">'+esc((t.body||'').slice(0,96))+((t.body||'').length>96?'\u2026':'')+'</div></td>'
              +'<td class="num" style="white-space:nowrap"><button class="pa-btn sm" data-act="tipedit" data-id="'+esc(t.id)+'">Edit</button> <button class="pa-btn dang sm" data-act="tipdel" data-id="'+esc(t.id)+'">Delete</button></td></tr>';
            if(self._tipEdit===t.id) h+='<tr><td colspan="3" style="padding:0 0 8px">'+self._tipForm(t)+'</td></tr>';
          });
          h+='</tbody></table>';
        } else if(self._tipEdit!=='new:'+tt.key) h+='<div class="pa-empty">No tips yet \u2014 add one.</div>';
        h+='</div>';
      });
      h+='<div id="pa-msg" class="pa-msg"></div>';
      host.innerHTML=h;
    },
    _tipImgFile:function(input){
      var file=input.files&&input.files[0]; if(!file)return;
      var form=input.closest('[data-tipform]'); if(!form)return;
      var rd=new FileReader();
      rd.onload=function(){ var img=new Image(); img.onload=function(){
        var mx=1000, w=img.width, h=img.height; if(w>mx){ h=Math.round(h*mx/w); w=mx; }
        var c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
        var data=c.toDataURL('image/jpeg',0.82);
        var inp=form.querySelector('[data-f="image"]'); if(inp) inp.value=data;
        var prev=form.querySelector('#tipimg-prev'); if(prev) prev.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover">';
      }; img.src=rd.result; };
      rd.readAsDataURL(file);
    },
    async saveTip(id, tab){
      var form=document.querySelector('#pa-content [data-tipform]'); if(!form)return;
      var val=function(k){ var el=form.querySelector('[data-f="'+k+'"]'); if(!el)return ''; if(el.type==='checkbox')return el.checked; return el.value; };
      var t={ id:id||'', tab:tab||'*', heading:val('heading'), body:val('body'), image:val('image'), sort:+val('sort')||0, published:val('published')!==false };
      if(!t.heading && !t.body){ alert('Add a heading or some wording first.'); return; }
      try{ await SB.platform.tipSave(t); this._tipEdit=null; await this.renderTips(); this.msg('Tip saved.',true); }
      catch(e){ alert(e.message); }
    },
    async deleteTip(id){
      if(!confirm('Delete this tip?'))return;
      try{ await SB.platform.tipDelete(id); if(this._tipEdit===id)this._tipEdit=null; await this.renderTips(); this.msg('Tip deleted.',true); }
      catch(e){ alert(e.message); }
    },
    _annForm:function(a){
      a=a||{}; var id=a.id||'';
      var typeOpt=['info','warning','success'].map(function(t){return '<option value="'+t+'"'+((a.type||'info')===t?' selected':'')+'>'+t+'</option>';}).join('');
      var audOpt=[['all','Everyone'],['trial','Trial only'],['starter','Starter only'],['pro','Pro only'],['max','Max only']].map(function(o){return '<option value="'+o[0]+'"'+((a.audience||'all')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');
      return '<div class="pa-detail" data-annform="'+esc(id||'new')+'">'
        +'<div class="pa-fld"><label>Title (optional)</label><input class="pa-inp" data-f="title" value="'+esc(a.title||'')+'" placeholder="e.g. Scheduled maintenance"></div>'
        +'<div class="pa-fld"><label>Message</label><textarea class="pa-inp" data-f="message" rows="2" placeholder="What all users should see…">'+esc(a.message||'')+'</textarea></div>'
        +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
          +'<div class="pa-fld" style="max-width:150px"><label>Style</label><select class="pa-sel" data-f="type">'+typeOpt+'</select></div>'
          +'<div class="pa-fld" style="max-width:170px"><label>Audience</label><select class="pa-sel" data-f="audience">'+audOpt+'</select></div>'
          +'<div class="pa-fld" style="max-width:180px"><label>Show until (optional)</label><input class="pa-inp" data-f="endAt" type="date" value="'+esc((a.endAt||'').slice(0,10))+'"></div>'
        +'</div>'
        +'<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:4px">'
          +'<label style="font-size:12px;color:#334155;display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="active" '+(a.active!==false?'checked':'')+'> Active</label>'
          +'<label style="font-size:12px;color:#334155;display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="dismissible" '+(a.dismissible!==false?'checked':'')+'> Users can dismiss</label>'
        +'</div>'
        +'<div style="display:flex;gap:8px;margin-top:10px"><button class="pa-btn pri sm" data-act="annsave" data-id="'+esc(id)+'">Save notice</button>'
          +'<button class="pa-btn sm" data-act="anncancel">Cancel</button></div>'
        +'</div>';
    },
    async renderNotices(){
      var self=this, host=g('pa-content');
      host.innerHTML='<div class="pa-empty">Loading notices…</div>';
      try{ this._ann=await SB.platform.annAll(); }
      catch(e){ host.innerHTML='<div class="pa-sec" style="color:#b91c1c">Could not load notices: '+esc(e.message)+'<div class="pa-mini" style="margin-top:6px">Run <b>civmetrix_step13_notices_audit.sql</b> in Supabase, then reopen.</div></div>'; return; }
      var arr=this._ann||[]; var live=arr.filter(function(a){return a.active;}).length;
      var h='<p class="pa-eyebrow">Broadcast banners shown across the app</p>'
        +'<div class="pa-metrics">'
        +'<div class="pa-card"><div class="n">'+arr.length+'</div><div class="l">Notices</div></div>'
        +'<div class="pa-card good"><div class="n">'+live+'</div><div class="l">Active</div></div>'
        +'</div>'
        +'<div class="pa-sec"><div style="display:flex;align-items:center;margin-bottom:8px"><h3 style="margin:0;flex:1">Notices</h3>'
        +'<button class="pa-btn pri sm" data-act="annadd">+ New notice</button></div>';
      if(this._annEdit==='new') h+=this._annForm({});
      if(arr.length){
        h+='<table class="pa-tbl"><tbody>';
        arr.forEach(function(a){
          var col={info:'#2563eb',warning:'#d97706',success:'#16a34a'}[a.type||'info']||'#2563eb';
          h+='<tr><td style="width:8px;padding:0"><div style="width:5px;height:34px;border-radius:3px;background:'+col+'"></div></td>'
            +'<td><div class="pa-co">'+esc(a.title||a.message||'(empty)')+(a.active?'':' <span class="pa-badge none">off</span>')+'</div>'
            +'<div class="pa-mini">'+esc((a.message||'').slice(0,90))+' · '+esc(a.audience||'all')+'</div></td>'
            +'<td class="num" style="white-space:nowrap"><button class="pa-btn sm" data-act="annedit" data-id="'+esc(a.id)+'">Edit</button> <button class="pa-btn dang sm" data-act="anndel" data-id="'+esc(a.id)+'">Delete</button></td></tr>';
          if(self._annEdit===a.id) h+='<tr><td colspan="3" style="padding:0 0 8px">'+self._annForm(a)+'</td></tr>';
        });
        h+='</tbody></table>';
      } else if(this._annEdit!=='new') h+='<div class="pa-empty">No notices yet.</div>';
      h+='</div><div id="pa-msg" class="pa-msg"></div>';
      host.innerHTML=h;
    },
    async saveAnn(id){
      var form=document.querySelector('#pa-content [data-annform]'); if(!form)return;
      var val=function(k){ var el=form.querySelector('[data-f="'+k+'"]'); if(!el)return ''; if(el.type==='checkbox')return el.checked; return el.value; };
      var a={ id:id||'', title:val('title'), message:val('message'), type:val('type'), audience:val('audience'),
              active:val('active')!==false, dismissible:val('dismissible')!==false, endAt:val('endAt')||null };
      if(!a.message){ alert('Add a message first.'); return; }
      try{ await SB.platform.annSave(a); this._annEdit=null; await this.renderNotices(); this.msg('Notice saved.',true); }
      catch(e){ alert(e.message); }
    },
    async deleteAnn(id){
      if(!confirm('Delete this notice?'))return;
      try{ await SB.platform.annDelete(id); if(this._annEdit===id)this._annEdit=null; await this.renderNotices(); this.msg('Notice deleted.',true); }
      catch(e){ alert(e.message); }
    },
    async renderAudit(){
      var self=this, host=g('pa-content');
      host.innerHTML='<div class="pa-empty">Loading audit log…</div>';
      var byId={}; (this._d?this._d.companies:[]).forEach(function(c){ byId[c.id]=c.name; });
      try{ this._audit=await SB.platform.auditRecent(this._auditOrg||'', 300); }
      catch(e){ host.innerHTML='<div class="pa-sec" style="color:#b91c1c">Could not load audit log: '+esc(e.message)+'<div class="pa-mini" style="margin-top:6px">Run <b>civmetrix_step13_notices_audit.sql</b> in Supabase, then reopen.</div></div>'; return; }
      var rows=this._audit||[];
      var opts='<option value="">All companies</option>'+((this._d?this._d.companies:[]).map(function(c){return '<option value="'+esc(c.id)+'"'+(self._auditOrg===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join(''));
      var h='<p class="pa-eyebrow">Recent activity across all companies</p>'
        +'<div class="pa-sec"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap">'
        +'<select class="pa-sel" data-act="auditfilter" style="max-width:220px">'+opts+'</select>'
        +'<button class="pa-btn sm" data-act="auditrefresh">&#8635; Refresh</button>'
        +'<span class="pa-mini" style="flex:1;text-align:right">'+rows.length+' most-recent events</span></div>';
      if(rows.length){
        h+='<table class="pa-tbl"><thead><tr><th>When</th><th>Company</th><th>User</th><th>Action</th><th>Item</th></tr></thead><tbody>';
        rows.forEach(function(r){
          var when=r.at?new Date(r.at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
          var actCol={login:'#2563eb',save:'#16a34a',delete:'#dc2626'}[r.action]||'#64748b';
          h+='<tr><td class="pa-mini" style="white-space:nowrap">'+esc(when)+'</td>'
            +'<td>'+esc(byId[r.org_id]||r.org_id||'—')+'</td>'
            +'<td class="pa-mini">'+esc(r.actor_name||r.actor||'')+'</td>'
            +'<td><span style="color:'+actCol+';font-weight:700;text-transform:capitalize">'+esc(r.action||'')+'</span></td>'
            +'<td class="pa-mini">'+esc(r.entity||'')+(r.entityId?(' · '+esc(String(r.entityId).slice(0,20))):'')+'</td></tr>';
        });
        h+='</tbody></table>';
      } else h+='<div class="pa-empty">No activity recorded yet.</div>';
      h+='</div>';
      host.innerHTML=h;
    },

    async renderStorage(){
      var self=this, host=g('pa-content');
      host.innerHTML='<div class="pa-empty">Measuring storage…</div>';
      var st=this._storage;
      if(!st){ try{ st=await SB.platform.storage(); this._storage=st; }
        catch(e){ host.innerHTML='<div class="pa-sec" style="color:#b91c1c">Could not measure storage: '+esc(e.message)+'<div class="pa-mini" style="margin-top:6px">Run <b>civmetrix_step11_storage.sql</b> in Supabase, then reopen this tab.</div></div>'; return; } }
      var byId={}; this._d.companies.forEach(function(x){ byId[x.id]=x; });
      var rows=Object.keys(st).map(function(oid){ var s=st[oid]||{}; var c=byId[oid]||{};
        return { id:oid, name:(c.name||oid), plan:(c.plan||'—'), users:(c.users||0), projects:(c.projects||0),
                 records:+s.records||0, bytes:+s.bytes||0, tables:s.tables||{} }; });
      var totalRec=rows.reduce(function(s,x){return s+x.records;},0);
      var totalByt=rows.reduce(function(s,x){return s+x.bytes;},0);
      var maxByt=rows.reduce(function(m,x){return Math.max(m,x.bytes);},0)||1;
      rows.sort(function(a,b){return b.bytes-a.bytes;});
      var largest=rows.length?rows[0]:null;
      var h='<p class="pa-eyebrow">Data &amp; storage</p><div class="pa-metrics">'
        +'<div class="pa-card"><div class="n">'+this._d.companies.length+'</div><div class="l">Companies</div></div>'
        +'<div class="pa-card"><div class="n">'+totalRec.toLocaleString('en')+'</div><div class="l">Total records</div></div>'
        +'<div class="pa-card good"><div class="n">'+self._fmtSize(totalByt)+'</div><div class="l">Est. data size</div></div>'
        +'<div class="pa-card warn"><div class="n" style="font-size:16px;line-height:1.2">'+(largest?esc(largest.name):'—')+'</div><div class="l">Largest — '+(largest?self._fmtSize(largest.bytes):'0')+'</div></div>'
        +'</div>';
      h+='<div class="pa-sec"><h3>Usage by company</h3>';
      if(rows.length){
        h+='<table class="pa-tbl"><thead><tr><th>Company</th><th>Plan</th><th class="num">Users</th><th class="num">Projects</th><th class="num">Records</th><th class="num">Est. size</th><th>Share of storage</th><th></th></tr></thead><tbody>';
        rows.forEach(function(x){
          var pct=totalByt?Math.round(x.bytes/totalByt*100):0; var bw=Math.round(x.bytes/maxByt*100);
          h+='<tr><td class="pa-co">'+esc(x.name)+'<div class="pa-id">'+esc(x.id)+'</div></td>'
            +'<td>'+esc(x.plan)+'</td><td class="num">'+x.users+'</td><td class="num">'+x.projects+'</td>'
            +'<td class="num">'+x.records.toLocaleString('en')+'</td><td class="num"><b>'+self._fmtSize(x.bytes)+'</b></td>'
            +'<td style="min-width:130px"><div style="background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden"><div style="width:'+bw+'%;height:8px;background:#f97316"></div></div><span class="pa-mini">'+pct+'%</span></td>'
            +'<td class="num"><button class="pa-btn sm" data-act="storagedetail" data-id="'+esc(x.id)+'">'+(self._sOpen===x.id?'Hide':'Breakdown')+'</button></td></tr>';
          if(self._sOpen===x.id){
            var ts=Object.keys(x.tables).map(function(t){return {t:t,r:+x.tables[t].records||0,b:+x.tables[t].bytes||0};}).sort(function(a,b){return b.b-a.b;}).slice(0,12);
            var tb=ts.map(function(z){return '<tr><td class="pa-mini">'+esc(z.t)+'</td><td class="num pa-mini">'+z.r.toLocaleString('en')+'</td><td class="num pa-mini">'+self._fmtSize(z.b)+'</td></tr>';}).join('');
            h+='<tr><td colspan="8" style="padding:0"><div class="pa-detail"><span class="lbl">Heaviest tables — '+esc(x.name)+'</span><table class="pa-tbl"><thead><tr><th>Table</th><th class="num">Records</th><th class="num">Est. size</th></tr></thead><tbody>'+(tb||'<tr><td class="pa-empty" colspan="3">No data.</td></tr>')+'</tbody></table></div></td></tr>';
          }
        });
        h+='</tbody></table>';
      } else h+='<div class="pa-empty">No tenant data yet.</div>';
      h+='<div class="pa-mini" style="margin-top:10px">“Est. size” is the approximate size of each company’s rows in the shared database (uncompressed) — a reliable way to compare tenants and spot heavy accounts. Actual disk use is lower once Postgres compresses.</div></div>';
      // ── Infrastructure health: the numbers that tell you when to upgrade ──
      var infra=null;
      try{ infra = this._dbh || (this._dbh = await SB.platform.dbHealth()); }catch(e){ infra=null; }
      if(infra){
        var cUsed=+infra.connections||0, cMax=+infra.maxConnections||0;
        var cPct=cMax?Math.round(cUsed/cMax*100):0;
        var cls=cPct>=85?'bad':(cPct>=70?'warn':'good');
        var dbSize=self._fmtSize(+infra.dbBytes||0);
        h+='<p class="pa-eyebrow" style="margin-top:18px">Infrastructure</p><div class="pa-metrics">'
          +'<div class="pa-card '+cls+'"><div class="n">'+cUsed+' / '+cMax+'</div><div class="l">Connections ('+cPct+'%)</div></div>'
          +'<div class="pa-card"><div class="n">'+(+infra.idle||0)+'</div><div class="l">Idle connections</div></div>'
          +'<div class="pa-card"><div class="n">'+dbSize+'</div><div class="l">Database size on disk</div></div>'
          +'</div>';
        if(cPct>=70) h+='<div class="pa-sec" style="color:#b45309"><b>⚠ Connections are '+cPct+'% used.</b> '
          +'Use Supabase\'s connection pooler, or move to a larger instance, before you add more tenants.</div>';
      }
      h+='<div class="pa-row"><button class="pa-btn" data-act="storagerefresh">&#8635; Re-measure</button></div>';
      host.innerHTML=h;
    },

    renderBilling:function(){
      var self=this, p=this._prices, c=this._d.companies;
      var mrr=c.filter(function(x){return x.status==='active';}).reduce(function(s,x){return s+self.totOf(x);},0);
      var seats=c.reduce(function(s,x){return s+(x.seats||0);},0);
      var h='<p class="pa-eyebrow">Revenue</p><div class="pa-metrics">'
        +'<div class="pa-card good"><div class="n">'+money(mrr)+'</div><div class="l">MRR (active)</div></div>'
        +'<div class="pa-card"><div class="n">'+c.filter(function(x){return x.status==='active';}).length+'</div><div class="l">Paying companies</div></div>'
        +'<div class="pa-card"><div class="n">'+seats+'</div><div class="l">Seats sold</div></div>'
        +'</div>';
      var priceFlds=self._planList().map(function(k){ return '<div class="pa-fld"><label style="text-transform:capitalize">'+k+'</label><input class="pa-inp" id="pa-price-'+k+'" type="number" min="0" value="'+(p[k]||'')+'" style="max-width:110px"></div>'; }).join('');
      h+='<div class="pa-sec"><h3>Default plan pricing (E / license / month)</h3><div class="pa-row">'
        +priceFlds
        +'<div class="pa-fld"><label>&nbsp;</label><button class="pa-btn pri" data-act="saveprices">Save defaults</button></div>'
        +'<span class="pa-mini">Used when a company has no custom price. Set custom price/discount per company under Companies → Manage.</span></div></div>';
      h+='<div class="pa-sec"><h3>Subscriptions &amp; invoicing</h3><table class="pa-tbl"><thead><tr><th>Company</th><th>Status</th><th class="num">Seats</th><th class="num">Price/lic</th><th>Discount</th><th class="num">Subtotal</th><th class="num">Total /mo</th><th>Next expiry</th><th>Standing</th></tr></thead><tbody>';
      c.forEach(function(x){ var disc=self.discOn(x);
        h+='<tr><td class="pa-co">'+esc(x.name)+'</td><td>'+bdg(x.status)+'</td>'
          +'<td class="num">'+(x.seats===null?'—':x.seats)+'</td>'
          +'<td class="num pa-mini">'+money(self.priceOf(x))+'</td>'
          +'<td class="pa-mini">'+(x.discPct>0?((disc?'<span class="pa-pill">-'+x.discPct+'%</span> ':'-'+x.discPct+'% ')+(x.discFrom||'…')+' → '+(x.discTo||'…')):'—')+'</td>'
          +'<td class="num pa-mini">'+money(self.subOf(x))+'</td>'
          +'<td class="num"><b>'+money(self.totOf(x))+'</b></td>'
          +'<td class="pa-mini">'+fmtDate(x.activeUntil)+'</td>'
          +'<td>'+daysCell(x.activeUntil)+'</td></tr>';
      });
      h+='</tbody></table></div><div id="pa-msg" class="pa-msg"></div>';
      g('pa-content').innerHTML=h;
    },

    // ---- actions ----
    _seatBlock:function(orgId){ var c=null,a=this._d.companies; for(var i=0;i<a.length;i++){if(a[i].id===orgId){c=a[i];break;}} if(c && c.seats!==null && c.logins>=c.seats){ return c; } return null; },
    async addCompany(){
      var name=g('pa-new-name').value.trim();
      var id=g('pa-new-id').value.trim() || (name?('ORG-'+name.split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g,'')):'');
      var seats=g('pa-new-seats').value;
      if(!name||!id){ this.msg('Enter a company name.',false); return; }
      try{ await SB.platform.createCompany(id,name,g('pa-new-status').value,g('pa-new-plan').value); if(seats!=='') await SB.platform.setBilling(id,seats,'',0,'','',''); this.msg('Created '+name+'.',true); this._q=''; await this.reload(); }
      catch(e){ this.msg(e.message,false); }
    },
    async setActive(id){ try{ await SB.platform.setStatus(id,'active'); await this.reload(); }catch(e){ alert(e.message); } },
    async suspend(id){ if(!confirm('Suspend this company? They will be locked out until reactivated.'))return; try{ await SB.platform.setStatus(id,'suspended'); await this.reload(); }catch(e){ alert(e.message); } },
    async setPlan(id,plan){ try{ await SB.platform.setPlan(id,plan); await this.reload(); }catch(e){ alert(e.message); } },
    async saveDate(id,v){ try{ await SB.platform.setStatus(id,'active',v||''); this.msg('Paid-through date saved.',true); await this.reload(); }catch(e){ this.msg(e.message,false); } },
    async saveBilling(id,o){ try{ await SB.platform.setBilling(id,o.seats,o.price,o.discPct,o.discFrom,o.discTo,o.notes); this.msg('Licenses & billing saved.',true); await this.reload(); }catch(e){ this.msg(e.message,false); } },
    async rename(id,name){ name=(name||'').trim(); if(!name)return; try{ await SB.platform.rename(id,name); this.msg('Renamed.',true); await this.reload(); }catch(e){ this.msg(e.message,false); } },
    async deleteCompany(id){ if(!confirm('Delete this company and its subscription? This cannot be undone.'))return; try{ await SB.platform.removeCompany(id); this._openId=null; await this.reload(); }catch(e){ alert('Could not delete: '+e.message); } },
    async link(email,org,role){ if(!org){ this.msg('Pick a company.',false); return; } try{ await SB.platform.linkAdmin(email,org,role); this.msg(email+' linked.',true); await this.reload(); }catch(e){ this.msg(e.message,false); } },
    async setRole(email,role){ try{ await SB.platform.setRole(email,role); this.msg('Role updated for '+email+'.',true); }catch(e){ this.msg(e.message,false); } },
    async move(email,org){ try{ await SB.platform.linkAdmin(email,org,'Admin'); this.msg(email+' moved.',true); await this.reload(); }catch(e){ this.msg(e.message,false); } },
    async unlink(email){ if(!confirm('Unlink '+email+'? They lose access until re-linked.'))return; try{ await SB.platform.unlink(email); await this.reload(); }catch(e){ alert(e.message); } },
    toggleDetail:function(id){ this._openId=(this._openId===id)?null:id; this.renderCompanyTable(); },
    manage:function(id){ this._tab='companies'; this._openId=id; this.render(); },
    savePrices:function(){ var o={}; this._planList().forEach(function(k){ var el=g('pa-price-'+k); o[k]=el?(+el.value||0):0; }); this._prices=o; try{ localStorage.setItem('pa_prices',JSON.stringify(o)); }catch(e){} var self=this; if(window.SB&&SB.platform&&SB.platform.saveSetting){ SB.platform.saveSetting('pa_default_prices',o).then(function(){ self.msg('Default pricing saved (synced to all devices).',true); }).catch(function(e){ self.msg('Saved on this device — cloud sync failed: '+e.message,false); }); } else { this.msg('Default pricing saved.',true); } this.renderBilling(); }
  };

  var root=g('pa-root');
  root.addEventListener('click',function(e){
    var el=e.target.closest('[data-act]'); if(!el)return;
    var a=el.getAttribute('data-act'), id=el.getAttribute('data-id'), email=el.getAttribute('data-email');
    if(a==='close'){ PA.close(); return; }
    if(a==='tab'){ PA._tab=el.getAttribute('data-tab'); PA.render(); return; }
    if(a==='addToggle'){ var f=g('pa-addform'); if(f) f.style.display=(f.style.display==='none'?'grid':'none'); return; }
    if(a==='add'){ PA.addCompany(); return; }
    if(a==='detail'){ PA.toggleDetail(id); return; }
    if(a==='manage'){ PA.manage(id); return; }
    if(a==='setactive'){ PA.setActive(id); return; }
    if(a==='suspend'){ PA.suspend(id); return; }
    if(a==='savedate'){ var di=g('pa-detailbox').querySelector('[data-role=date]'); PA.saveDate(id, di?di.value:''); return; }
    if(a==='savebilling'){ var b=g('pa-detailbox'); PA.saveBilling(id,{seats:b.querySelector('[data-role=seats]').value,price:b.querySelector('[data-role=price]').value,discPct:b.querySelector('[data-role=discpct]').value,discFrom:b.querySelector('[data-role=discfrom]').value,discTo:b.querySelector('[data-role=discto]').value,notes:b.querySelector('[data-role=bnotes]').value}); return; }
    if(a==='rename'){ var ni=g('pa-detailbox').querySelector('[data-role=name]'); PA.rename(id, ni?ni.value:''); return; }
    if(a==='del'){ PA.deleteCompany(id); return; }
    if(a==='link'){ var row=el.closest('[data-row]'); PA.link(email, row.querySelector('[data-role=org]').value, row.querySelector('[data-role=role]').value); return; }
    if(a==='unlink'){ PA.unlink(email); return; }
    if(a==='saveprices'){ PA.savePrices(); return; }
    if(a==='storagedetail'){ PA._sOpen=(PA._sOpen===id)?null:id; PA.renderStorage(); return; }
    if(a==='storagerefresh'){ PA._storage=null; PA._dbh=null; PA._sOpen=null; PA.renderStorage(); return; }
    if(a==='tipadd'){ PA._tipEdit='new:'+el.getAttribute('data-tab'); PA.renderTips(); return; }
    if(a==='tipedit'){ PA._tipEdit=id; PA.renderTips(); return; }
    if(a==='tipcancel'){ PA._tipEdit=null; PA.renderTips(); return; }
    if(a==='tipsave'){ PA.saveTip(id, el.getAttribute('data-tab')); return; }
    if(a==='tipdel'){ PA.deleteTip(id); return; }
    if(a==='annadd'){ PA._annEdit='new'; PA.renderNotices(); return; }
    if(a==='annedit'){ PA._annEdit=id; PA.renderNotices(); return; }
    if(a==='anncancel'){ PA._annEdit=null; PA.renderNotices(); return; }
    if(a==='annsave'){ PA.saveAnn(id); return; }
    if(a==='anndel'){ PA.deleteAnn(id); return; }
    if(a==='auditrefresh'){ PA._audit=null; PA.renderAudit(); return; }
  });
  root.addEventListener('change',function(e){
    var el=e.target.closest('[data-act]'); if(!el)return;
    var a=el.getAttribute('data-act');
    if(a==='plan'){ PA.setPlan(el.getAttribute('data-id'), el.value); }
    else if(a==='role'){ PA.setRole(el.getAttribute('data-email'), el.value); }
    else if(a==='move'){ if(el.value) PA.move(el.getAttribute('data-email'), el.value); }
    else if(a==='tipimgfile'){ PA._tipImgFile(el); }
    else if(a==='auditfilter'){ PA._auditOrg=el.value; PA._audit=null; PA.renderAudit(); }
  });
  root.addEventListener('input',function(e){
    var el=e.target.closest('[data-act]'); if(!el)return;
    if(el.getAttribute('data-act')==='filter'){ PA._q=el.value; PA.renderCompanyTable(); }
  });
  document.getElementById('pa-launch').addEventListener('click',function(){ PA.open(); });
  setInterval(function(){ var b=document.getElementById('pa-launch'); if(!b)return; var me=(window.SB&&SB._me)?SB._me:null; var li=document.getElementById('li-email'); var onAuth=!!(li&&li.offsetParent!==null); b.style.display=(me&&me.role==='Platform'&&!onAuth)?'block':'none'; },800);
})();


(function(){
  var LOADED=null, loading=false, list=[], idx=0, curKey='', dismissed={}, lastUid=null;
  function host(){ return document.getElementById('cm-ann'); }
  function authVisible(){ var li=document.getElementById('li-email'); return !!(li&&li.offsetParent!==null); }
  function appVisible(){ var a=document.getElementById('screen-app'); return !!(a&&a.classList.contains('active')); }
  function me(){ return (window.SB&&SB._me)?SB._me:null; }
  function icon(t){ return t==='warning'?'\u26A0':(t==='success'?'\u2713':'\u2139'); }
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function applicable(a){
    if(!a||a.active===false) return false;
    var u=me(); var plan=(u&&u.plan)||'';
    if(a.audience && a.audience!=='all' && a.audience!==plan) return false;
    var now=Date.now();
    if(a.startAt && new Date(a.startAt).getTime()>now) return false;
    if(a.endAt && new Date(a.endAt).getTime()<now) return false;
    if(dismissed[a.id]) return false;
    return true;
  }
  function load(){ if(LOADED||loading||!(window.SB&&SB.getAnnouncements))return; loading=true;
    Promise.resolve(SB.getAnnouncements()).then(function(r){ LOADED=r||[]; loading=false; }).catch(function(){ loading=false; }); }
  function rebuild(){ list=(LOADED||[]).filter(applicable); if(idx>=list.length) idx=0; }
  function paintBar(){
    var h=host(); if(!h)return;
    var a=list[idx];
    if(!a){ if(h.innerHTML){ h.innerHTML=''; curKey=''; } return; }
    var key=a.id+'#'+idx+'#'+list.length;
    if(key===curKey) return;
    curKey=key;
    var many=list.length>1;
    h.innerHTML='<div class="cm-ann-bar '+esc(a.type||'info')+'"><span class="cm-ann-ic">'+icon(a.type)+'</span>'
      +'<span class="cm-ann-tx">'+(a.title?'<b>'+esc(a.title)+'</b> ':'')+esc(a.message||'')+'</span>'
      +(many?'<span class="cm-ann-count">'+(idx+1)+' / '+list.length+'</span>':'')
      +(a.dismissible!==false?'<button class="cm-ann-x" title="Dismiss">&times;</button>':'')+'</div>';
    var x=h.querySelector('.cm-ann-x');
    if(x)x.addEventListener('click',function(){ dismissed[a.id]=1; rebuild(); curKey=''; paintBar(); });
  }
  // Poll: clear on the login screen; reset dismissals whenever a new session signs in.
  setInterval(function(){
    if(!me()||!appVisible()){ var h=host(); if(h&&h.innerHTML){ h.innerHTML=''; curKey=''; } lastUid=null; return; }
    var u=me();
    if(u.id!==lastUid){ lastUid=u.id; dismissed={}; idx=0; curKey=''; }  // fresh login → show all notices again
    load(); rebuild(); paintBar();
  },1500);
  // Auto-cycle when several notices are active.
  setInterval(function(){ if(list.length>1){ idx=(idx+1)%list.length; paintBar(); } },6500);
})();


(function(){
  function g(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  var TIPS=[], loaded=false, loading=false;
  var LBL={dashboard:'Dashboard',production:'Production',payroll:'Payroll',accounting:'Accounting',organization:'Organization','settings-main':'Settings','role-permissions':'Role Permissions'};
  var list=[], i=0, timer=null, shown=false, lastTab=null, off=false;
  function planOK(){ var me=(window.SB&&SB._me)?SB._me:null; var su=(typeof S!=='undefined'&&S&&S.user)?S.user:null; var p=(me&&me.plan)||(su&&su.plan)||''; return p==='pro'||p==='max'; }
  function authVisible(){ var li=document.getElementById('li-email'); return !!(li&&li.offsetParent!==null); }
  function appVisible(){ var a=document.getElementById('screen-app'); return !!(a&&a.classList.contains('active')); }
  function curTab(){ try{ return (typeof S!=='undefined' && S && S.mainTab) || '*'; }catch(e){ return '*'; } }
  function build(t){ var spec=TIPS.filter(function(x){return x.tab===t;}); var gen=TIPS.filter(function(x){return x.tab==='*';}); list=spec.concat(gen); if(!list.length) list=gen; i=0; }
  function dots(){ var d=g('cmt-dots'); if(!d)return; var h=''; for(var k=0;k<list.length;k++){h+='<span class="cmt-dot'+(k===i?' on':'')+'" data-k="'+k+'"></span>';} d.innerHTML=h; }
  function paint(){
    var tip=list[i], t=g('cmt-tip'), art=g('cmt-art'), ctx=g('cmt-ctx');
    if(ctx) ctx.textContent='For the '+(LBL[lastTab]||'app')+' area';
    if(!tip){ if(t)t.innerHTML=''; if(art){art.style.display='none';art.innerHTML='';} dots(); return; }
    if(art){ if(tip.image){ art.innerHTML='<img src="'+tip.image+'" alt="">'; art.style.display='block'; } else { art.style.display='none'; art.innerHTML=''; } }
    if(t){ t.style.animation='none'; void t.offsetWidth; t.style.animation=''; t.innerHTML=(tip.heading?'<b>'+esc(tip.heading)+'</b> ':'')+esc(tip.body||''); }
    var bk=g('cmt-back'); if(bk) bk.disabled=(list.length<2);
    var nx=g('cmt-next'); if(nx) nx.disabled=(list.length<2);
    dots();
  }
  function next(){ if(!list.length)return; i=(i+1)%list.length; paint(); }
  function prev(){ if(!list.length)return; i=(i-1+list.length)%list.length; paint(); }
  function reArm(){ if(timer){clearInterval(timer);} timer=setInterval(next,8000); }
  function refresh(force){ var tb=curTab(); if(force||tb!==lastTab){ lastTab=tb; build(tb); paint(); } }
  function show(){ if(shown)return; lastTab=null; refresh(true); if(!list.length) return; shown=true; var me=(window.SB&&SB._me)?SB._me:null; var pb=g('cmt-plan'); if(pb&&me)pb.textContent=(me.plan||'pro').toUpperCase(); var b=g('cm-tips'); b.style.display='block'; requestAnimationFrame(function(){ b.classList.add('in'); }); reArm(); }
  function hide(){ var b=g('cm-tips'); if(!b)return; b.classList.remove('in'); setTimeout(function(){ b.style.display='none'; },400); if(timer){clearInterval(timer);timer=null;} }
  function close(){ off=true; hide(); shown=false; }
  function openFromFab(){ off=false; var f=g('cm-tips-fab'); if(f)f.style.display='none'; show(); }
  function loadTips(){ if(loaded||loading||!(window.SB&&SB.getTips))return; loading=true;
    try{ Promise.resolve(SB.getTips()).then(function(rows){
      TIPS=(rows||[]).map(function(r){return {tab:r.tab||'*',heading:r.heading||'',body:r.body||'',image:r.image||'',sort:+r.sort||0};});
      loaded=true; loading=false; if(shown){ lastTab=null; refresh(true); }
    }).catch(function(){ loading=false; }); }catch(e){ loading=false; }
  }

  var xb=g('cmt-x'); if(xb)xb.addEventListener('click',close);
  var nb=g('cmt-next'); if(nb)nb.addEventListener('click',function(){ next(); reArm(); });
  var bb=g('cmt-back'); if(bb)bb.addEventListener('click',function(){ prev(); reArm(); });
  var fb=g('cm-tips-fab'); if(fb)fb.addEventListener('click',openFromFab);
  // Keep tips aligned to the CURRENT tab — re-check periodically so switching tabs
  // (including with the card open) always shows that tab's tips, never a stale one.
  setInterval(function(){ if(shown) refresh(); }, 1000);
  document.addEventListener('click',function(e){ var d=e.target.closest&&e.target.closest('#cmt-dots .cmt-dot'); if(d){ i=+d.getAttribute('data-k')||0; paint(); reArm(); } });
  try{ localStorage.removeItem('cm_tips_off'); }catch(e){}

  // ── Draggable tips card (touch + mouse) — move it out of the way anywhere ──
  (function(){
    var box=g('cm-tips'); if(!box) return;
    var handle=box.querySelector('.cmt-top'); if(!handle) return;
    handle.style.cursor='move'; handle.style.touchAction='none';
    var dragging=false, sx=0, sy=0, ox=0, oy=0;
    function pt(e){ return (e.touches&&e.touches[0])?e.touches[0]:e; }
    function down(e){
      if(e.target.closest && e.target.closest('.cmt-x,.cmt-nav,button')) return;
      dragging=true; var p=pt(e); sx=p.clientX; sy=p.clientY;
      var r=box.getBoundingClientRect(); ox=r.left; oy=r.top;
      box.style.right='auto'; box.style.bottom='auto'; box.style.left=ox+'px'; box.style.top=oy+'px';
      document.addEventListener('mousemove',move,{passive:false});
      document.addEventListener('touchmove',move,{passive:false});
      document.addEventListener('mouseup',up); document.addEventListener('touchend',up);
    }
    function move(e){
      if(!dragging) return; var p=pt(e);
      var w=box.offsetWidth, h=box.offsetHeight;
      var nx=Math.min(Math.max(4, ox+(p.clientX-sx)), window.innerWidth-w-4);
      var ny=Math.min(Math.max(4, oy+(p.clientY-sy)), window.innerHeight-h-4);
      box.style.left=nx+'px'; box.style.top=ny+'px';
      if(e.cancelable) e.preventDefault();
    }
    function up(){
      dragging=false;
      document.removeEventListener('mousemove',move); document.removeEventListener('touchmove',move);
      document.removeEventListener('mouseup',up); document.removeEventListener('touchend',up);
      try{ localStorage.setItem('cm_tips_pos',JSON.stringify({left:box.style.left,top:box.style.top})); }catch(e){}
    }
    handle.addEventListener('mousedown',down);
    handle.addEventListener('touchstart',down,{passive:true});
    try{ var pos=JSON.parse(localStorage.getItem('cm_tips_pos')||'null'); if(pos&&pos.left){ box.style.right='auto'; box.style.bottom='auto'; box.style.left=pos.left; box.style.top=pos.top; } }catch(e){}
  })();

  setInterval(function(){
    var elig = planOK() && appVisible();
    var fab = g('cm-tips-fab');
    if(!elig){ if(shown){ hide(); shown=false; } if(fab) fab.style.display='none'; return; }
    loadTips();
    if(off){ if(shown){ hide(); shown=false; } if(fab) fab.style.display='block'; return; }
    if(fab) fab.style.display='none';
    if(!shown) show(); else refresh(false);
  },1200);
})();


window.SFModal={ show:function(info){
  function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var t=document.getElementById('sf-text'), l=document.getElementById('sf-list');
  t.innerHTML='<b>'+e(info.company||'Your company')+'</b> has '+info.seats+' license'+(info.seats>1?'s':'')+', all currently in use. Someone must sign out before you can sign in.';
  var rows=(info.list||[]).map(function(s){ var since=s.loginAt?new Date(s.loginAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—'; return '<tr><td><b>'+e(s.name||s.email||'User')+'</b><br><span style="color:#94a3b8;font-size:11px">'+e(s.email||'')+'</span></td><td style="text-align:right;color:#64748b">since '+since+'</td></tr>'; }).join('');
  l.innerHTML='<table><thead><tr><th>Currently signed in</th><th style="text-align:right">Since</th></tr></thead><tbody>'+(rows||'<tr><td colspan="2" style="color:#94a3b8">—</td></tr>')+'</tbody></table>';
  document.getElementById('sf-modal').style.display='block';
}};

