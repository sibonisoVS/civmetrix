/* CivMetrix — 05-organization.js
 * Organization, app settings, accounting
 *
 * Part 5 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */

const Org = {
  _activeOrg: null,   // selected org id
  _activeSection: 'overview',

  render() {
    if(!_canDo('<span class="material-icons-outlined" aria-hidden="true">business</span> Organization','view')){
      ge('org-body').innerHTML='<div class="empty"><div class="ico">🔒</div><p>You don\'t have access to the Organization tab.<br><span style="font-size:11px;color:var(--text3)">Ask your Admin to update your permissions.</span></p></div>'; return;
    }
    const orgs = DB.organizations||[];
    // If no org selected and we have orgs, pick first
    if(!this._activeOrg && orgs.length) this._activeOrg = orgs[0].id;
    const org  = DB.getOrg(this._activeOrg);

    ge('org-body').innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title"><span class="material-icons-outlined" aria-hidden="true">business</span> Organizations</div>
        <div class="sec-actions">
          <button class="btn amber sm" id="btn-new-org">＋ New Organization</button>
        </div>
      </div>

      <!-- Org switcher -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${orgs.map(o=>`
          <button class="btn ${this._activeOrg===o.id?'amber':'ghost'} sm" data-orgswitch="${o.id}" style="display:flex;align-items:center;gap:6px">
            🏢 <span>${o.name}</span>
          </button>`).join('')}
        ${!orgs.length?'<span style="font-size:12px;color:var(--text3)">No organizations yet — click ＋ New Organization</span>':''}
      </div>

      ${org ? `
      <!-- Org header card -->
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:20px;font-weight:700;font-family:var(--fh);letter-spacing:1px">${org.name}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${org.type||'—'} · ${org.country||'—'} · ${org.currency||'SZL'}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${org.address||''} ${org.phone?'· '+org.phone:''} ${org.email?'· '+org.email:''}</div>
          </div>
          <button class="btn ghost sm" id="btn-edit-org">✏ Edit</button>
        </div>
      </div>

      <!-- Section tabs -->
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;overflow-x:auto">
        ${['overview','users','projects','cost-codes','app-settings'].map(s=>`
          <div class="org-tab ${this._activeSection===s?'active':''}" data-osec="${s}"
            style="padding:9px 16px;font-size:12px;font-weight:600;cursor:pointer;
            border-bottom:2px solid ${this._activeSection===s?'var(--amber)':'transparent'};
            color:${this._activeSection===s?'var(--amber)':'var(--text2)'};white-space:nowrap">
            ${{overview:'🏠 Overview',users:'👥 Users',projects:'🏗 Projects','cost-codes':'🏷 Cost Codes','app-settings':'⚙ App Settings'}[s]}
          </div>`).join('')}
      </div>
      <div id="org-section-body"></div>` : ''}
    `;

    ge('btn-new-org')?.addEventListener('click', ()=>this._openOrgForm());
    ge('btn-edit-org')?.addEventListener('click', ()=>this._openOrgForm(org||{}));
    ge('org-body').querySelectorAll('[data-orgswitch]').forEach(btn=>btn.addEventListener('click',()=>{
      this._activeOrg=btn.dataset.orgswitch; this.render();
    }));
    ge('org-body').querySelectorAll('[data-osec]').forEach(el=>el.addEventListener('click',()=>{
      this._activeSection=el.dataset.osec; this.render();
    }));
    if(org) this._renderSection();
  },

  async _renderSection() {
    const el = ge('org-section-body'); if(!el) return;
    const s  = this._activeSection;
    if(s==='overview')    this._renderOverview(el);
    if(s==='users')       await this._renderUsers(el);
    if(s==='projects')    this._renderProjects(el);
    if(s==='cost-codes')  this._renderCostCodeTemplates(el);
    if(s==='app-settings') this._renderAppSettings(el);
  },

  _renderDrawingTemplates(el){
    const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const fmtD=v=>{ try{ return v?new Date(v).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'; }catch(e){ return '—'; } };
    const tpls=(typeof Prod!=='undefined'&&Prod._dtAll)?Prod._dtAll():[];
    if(!tpls.length){
      el.innerHTML='<div class="empty" style="padding:40px;text-align:center">'
        +'<div class="ico" style="font-size:34px">📐</div>'
        +'<p style="font-size:13px;margin:8px 0 4px"><b>No drawing templates yet</b></p>'
        +'<p style="font-size:12px;color:var(--text3);max-width:560px;margin:0 auto;line-height:1.6">'
        +'A drawing template is a saved take-off structure — sections, elements, units and quantities — '
        +'that any project in your organization can start from.<br><br>'
        +'Build a register in <b>Analysis &amp; Outputs → 📐 Drawing Control</b>, then use '
        +'<b>💾 Save as Template</b>. Categorise it by project type (Irrigation, Roads, Potable Water…) '
        +'so the right one is easy to find when a new project starts.</p></div>';
      return;
    }
    const cats={}; tpls.forEach(t=>{ const k=t.category||'Uncategorised'; (cats[k]=cats[k]||[]).push(t); });
    let h='<div style="font-size:12px;color:var(--text2);margin-bottom:12px">'
      +tpls.length+' template'+(tpls.length===1?'':'s')+' available to every project in this organization. '
      +'Apply them from <b>Analysis &amp; Outputs → 📐 Drawing Control → 📋 Apply Template</b>.</div>';
    Object.keys(cats).sort().forEach(cat=>{
      h+='<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--amber);margin:14px 0 6px">'
        +'🏗 '+esc(cat)+' <span style="color:var(--text3);font-weight:400;text-transform:none">— '+cats[cat].length+'</span></div>'
        +'<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        +'<th>Template</th><th>Notes</th><th style="text-align:right">Items</th><th>Sections</th>'
        +'<th>Saved by</th><th>Saved</th><th>Actions</th></tr></thead><tbody>';
      cats[cat].forEach(t=>{
        const items=Prod._dtItems(t);
        const secs=[...new Set(items.map(i=>i.section||'Unsectioned'))];
        h+='<tr>'
          +'<td class="bold">'+esc(t.name||'—')+'</td>'
          +'<td style="font-size:11px;color:var(--text3);max-width:260px;white-space:normal">'+esc(t.description||'—')+'</td>'
          +'<td style="text-align:right;font-weight:700">'+(t.itemCount||items.length)+'</td>'
          +'<td style="font-size:11px;max-width:230px;white-space:normal">'+secs.map(x=>esc(x)).join(' · ')+'</td>'
          +'<td style="font-size:11px">'+esc(t.createdByName||'—')+'</td>'
          +'<td style="font-size:11px;color:var(--text3)">'+fmtD(t.createdAt)+'</td>'
          +'<td style="white-space:nowrap">'
            +'<button class="btn ghost sm ico" title="View items" onclick="Org._dtView(\''+t.id+'\')">👁</button> '
            +'<button class="btn ghost sm ico" title="Rename / recategorise" onclick="Org._dtEditMeta(\''+t.id+'\')">✎</button> '
            +'<button class="btn danger sm ico" title="Delete template" onclick="Org._dtDelete(\''+t.id+'\')">✕</button></td>'
          +'</tr>';
      });
      h+='</tbody></table></div>';
    });
    el.innerHTML=h;
  },
  _dtView(id){
    const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const t=Prod._dtAll().find(x=>x.id===id); if(!t) return;
    const items=Prod._dtItems(t);
    const secs={}; items.forEach(i=>{ const k=i.section||'Unsectioned'; (secs[k]=secs[k]||[]).push(i); });
    let b='<div style="font-size:12px;color:var(--text2);margin-bottom:10px"><b>'+esc(t.category||'')+'</b> · '
      +items.length+' items'+(t.description?('<br>'+esc(t.description)):'')+'</div>';
    Object.keys(secs).sort().forEach(sec=>{
      b+='<div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin:10px 0 4px">'+esc(sec)+'</div>'
        +'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Element</th><th>Description</th><th>Unit</th><th style="text-align:right">Qty</th></tr></thead><tbody>'
        +secs[sec].map(i=>'<tr><td class="mono bold" style="font-size:11px">'+esc(i.elementId||'—')+'</td>'
          +'<td style="font-size:11.5px">'+esc(i.description||'—')+'</td>'
          +'<td style="font-size:11px;color:var(--text3)">'+esc(i.unit||'')+'</td>'
          +'<td style="text-align:right">'+(parseFloat(i.qty)||0).toFixed(2)+'</td></tr>').join('')
        +'</tbody></table></div>';
    });
    Modal.open('📐 '+esc(t.name||'Template'), b, [{label:'Close',cls:'ghost',fn:Modal.close.bind(Modal)}], {wide:true});
  },
  _dtEditMeta(id){
    const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const t=Prod._dtAll().find(x=>x.id===id); if(!t) return;
    const cats=Prod._orgList('projectTypes');
    const body='<div class="form-grid cols-2">'
      +'<div class="field full"><label class="flabel">Template Name <span style="color:var(--red)">*</span></label>'
        +'<input class="finput" id="dtm-name" value="'+esc(t.name||'')+'"></div>'
      +'<div class="field full"><label class="flabel">Project Type <span style="color:var(--red)">*</span></label>'
        +'<select class="finput" id="dtm-cat" style="background:var(--surface2);color:var(--text)">'
        +cats.map(c=>'<option'+(t.category===c?' selected':'')+'>'+esc(c)+'</option>').join('')
        +(cats.indexOf(t.category)<0&&t.category?('<option selected>'+esc(t.category)+'</option>'):'')
        +'</select></div>'
      +'<div class="field full"><label class="flabel">Notes</label>'
        +'<textarea class="ftextarea" id="dtm-desc" rows="2">'+esc(t.description||'')+'</textarea></div></div>';
    Modal.open('✎ Edit Template', body, [
      {label:'Save', cls:'amber', fn:()=>{
        const gv=x=>{const el=ge(x);return el?el.value.trim():'';};
        if(!gv('dtm-name')){ toast('Enter a name','err'); return; }
        const rec={...t, name:gv('dtm-name'), category:gv('dtm-cat'),
          description:gv('dtm-desc'), updatedAt:new Date().toISOString()};
        DB.save('drawingTemplates', rec);
        Modal.close(); toast('Template updated ✅','ok');
        Org._renderDrawingTemplates(ge('app-sub-body'));
      }},
      {label:'Cancel', cls:'ghost', fn:Modal.close.bind(Modal)}
    ], {wide:true});
  },
  _dtDelete(id){
    const t=Prod._dtAll().find(x=>x.id===id); if(!t) return;
    if(!confirm('Delete template "'+(t.name||'')+'"?\n\nProjects already created from it are unaffected — only the template is removed.')) return;
    DB.remove('drawingTemplates', id);
    toast('Template deleted','ok');
    Org._renderDrawingTemplates(ge('app-sub-body'));
  },

  _renderAppSettings(el){
    this._appSub = this._appSub || 'general';
    const subs=[
      {k:'general',label:'⚙ General'},
      {k:'doc',label:'📄 Document Control'},
      {k:'types',label:'🧩 Types & Templates'},
      {k:'dwgtpl',label:'📐 Drawing Templates'},
      {k:'links',label:'🔗 Auto-Record Links'},
      {k:'backup',label:'💾 Backup / Export'},
    ];
    el.innerHTML=`<div class="inn-tabs" style="border-bottom:1px solid var(--border);margin-bottom:14px;display:flex;gap:4px;overflow-x:auto">
        ${subs.map(x=>`<button class="inn-tab ${this._appSub===x.k?'active':''}" data-appsub="${x.k}" style="white-space:nowrap">${x.label}</button>`).join('')}
      </div><div id="app-sub-body"></div>`;
    el.querySelectorAll('[data-appsub]').forEach(b=>b.addEventListener('click',()=>{ this._appSub=b.dataset.appsub; this._renderAppSettings(el); }));
    const body=ge('app-sub-body'); if(!body) return;
    if(this._appSub==='general') SettingsMain.renderInto(body);
    else if(this._appSub==='doc') DocumentControl.renderInto(body);
    else if(this._appSub==='types') this._renderTypeTemplates(body);
    else if(this._appSub==='dwgtpl') this._renderDrawingTemplates(body);
    else if(this._appSub==='links') this._renderAutoLinks(body);
    else if(this._appSub==='backup') this._renderBackup(body);
  },

  _renderBackup(el){
    el.innerHTML=`
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.6">Download a full backup of your organization's data as a JSON file. Keep a copy off-platform for safety, audit, or migration. The file contains every record your organization owns across all projects.</div>
      <button class="btn amber" id="bk-json">⬇ Download full JSON backup</button>
      <button class="btn ghost" id="bk-csv" style="margin-left:8px">⬇ Export current project (CSV)</button>
      <div style="font-size:11px;color:var(--text3);margin-top:12px">Tip: back up before large imports or role changes. This export is read-only and does not alter any data.</div>`;
    ge('bk-json')?.addEventListener('click',()=>Prod._exportBackupJSON());
    ge('bk-csv')?.addEventListener('click',()=>Prod._exportProjectCSV());
  },


  _renderAutoLinks(el){
    const cats=Prod._orgList('plantCategories'), cts=Prod._orgCostTypes(), sts=Prod._orgServiceTypes();
    const links=Prod._plantLinks();
    const rowHTML=(name,kind,i)=>{ const l=links[name]||{}; const lct=l.costType||''; const lsts=Array.isArray(l.serviceTypes)?l.serviceTypes:(l.serviceType?[l.serviceType]:[]);
      const svcBoxes=sts.map(sv=>`<label style="font-size:10px;display:inline-flex;align-items:center;gap:3px;margin:2px 8px 2px 0;white-space:nowrap"><input type="checkbox" data-lsv="${i}" value="${String(sv).replace(/"/g,'&quot;')}" ${lsts.indexOf(sv)>=0?'checked':''}>${sv}</label>`).join('');
      return `<div style="padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:12px;min-width:150px">${kind==='plant'?'🚜':'💰'} ${name}</span>
          <span style="font-size:11px;color:var(--text3)">Cost Type:</span>
          <select class="fselect" data-lct="${i}" style="font-size:12px;width:160px"><option value="">— default —</option>${cts.map(c=>`<option ${lct===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div style="margin-top:6px;font-size:10px;color:var(--text3)"><b>Service Types</b> (tick all that apply — the operator picks one per entry): ${svcBoxes||'<i>add Service Types first</i>'}</div>
      </div>`; };
    const allKeys=cats.concat(['Labour','Material','Sub Contractor']);
    el.innerHTML=`
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Map each cost source to its default <b>Cost Type</b> and the <b>Service Types</b> it can be booked against. In the Daily Report, the operator picks one of these Service Types per entry, so the cost is directed to the right place in Costing automatically. Leave blank to use built-in behaviour.</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin-bottom:2px">🚜 Plant / Equipment</div>
      ${cats.map((c,i)=>rowHTML(c,'plant',i)).join('')}
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber);margin:14px 0 2px">💰 Other Cost Sources</div>
      ${['Labour','Material','Sub Contractor'].map((c,j)=>rowHTML(c,'cost',cats.length+j)).join('')}
      <button class="btn amber" id="links-save" style="margin-top:14px">💾 Save Auto-Record Links</button>`;
    ge('links-save')?.addEventListener('click',()=>{
      const m={};
      allKeys.forEach((key,i)=>{ const ct=(el.querySelector('[data-lct="'+i+'"]')||{}).value||''; const svs=[...el.querySelectorAll('[data-lsv="'+i+'"]:checked')].map(c=>c.value); if(ct||svs.length) m[key]={costType:ct,serviceTypes:svs}; });
      Prod._tplSave({plantLinks:m});
      toast('Auto-record links saved ✅','ok');
    });
  },

  _renderTypeTemplates(el){
    const defs=[
      {key:'costTypes',label:'🏷 Cost Types',hint:'Budget Cost Type & Manual Cost Category'},
      {key:'serviceTypes',label:'🔧 Service Types',hint:'Service Type suggestions in Costing'},
      {key:'units',label:'📏 Units of Measure',hint:'Unit fields (cost line items, BOQ)'},
      {key:'projectTypes',label:'🏗 Project Types',hint:'Categories for Drawing Control templates'},
      {key:'plantCategories',label:'🚜 Plant / Equipment Categories',hint:'Plant register equipment'},
      {key:'supplierCategories',label:'🏭 Supplier Categories',hint:'Supplier register'},
      {key:'documentTypes',label:'📄 Document Types',hint:'Document register / control'},
      {key:'incidentTypes',label:'⚠ Incident / NCR Types',hint:'SHEQ incidents & NCRs'},
      {key:'skillLevels',label:'🎓 Skill Levels',hint:'Employment skill level'},
      {key:'contractTypes',label:'📃 Contract Types',hint:'Employment contract type'},
      {key:'trades',label:'👷 Trades / Occupations',hint:'Worker trade / occupation'},
      {key:'rateTypes',label:'⏱ Rate Types',hint:'Labour / plant rate basis'},
      {key:'consumptionUnits',label:'⛽ Consumption Units',hint:'Fuel / energy consumption'},
    ];
    const listHTML=(d)=>{ const arr=Prod._orgList(d.key); return `
      <div class="panel" style="flex:1;min-width:250px;max-width:340px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-weight:700;font-size:13px">${d.label}</div>
          <button class="btn amber sm" data-add="${d.key}" style="font-size:12px;padding:2px 9px">＋</button>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${d.hint}</div>
        <div>${arr.map((v,i)=>`<div style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text3);font-size:10px;width:16px">${i+1}</span>
          <input class="finput" data-k="${d.key}" value="${String(v).replace(/"/g,'&quot;')}" style="flex:1;font-size:12px">
          <button class="btn ghost sm" data-move="${d.key}:${i}:-1" style="padding:1px 5px;font-size:10px">▲</button>
          <button class="btn ghost sm" data-move="${d.key}:${i}:1" style="padding:1px 5px;font-size:10px">▼</button>
          <button class="btn danger sm" data-del="${d.key}:${i}" style="padding:1px 6px;font-size:10px">✕</button>
        </div>`).join('')||'<div style="font-size:11px;color:var(--text3);padding:6px">Using built-in defaults.</div>'}</div>
      </div>`;
    };
    el.innerHTML=`
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Define your organization's own templates, in your preferred order. These are used across the app for this organization only. Leave a list empty to use the built-in defaults.</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">${defs.map(listHTML).join('')}</div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn amber" id="tpl-save">💾 Save Templates</button>
        <button class="btn ghost" id="tpl-reset">↺ Reset all to defaults</button>
      </div>`;
    const readAll=()=>{ const o={}; defs.forEach(d=>{ o[d.key]=[...el.querySelectorAll('[data-k="'+d.key+'"]')].map(i=>i.value.trim()).filter(Boolean); }); return o; };
    const persist=(data,reRender)=>{ const patch={}; defs.forEach(d=>{ patch[d.key]=data[d.key]; }); Prod._tplSave(patch); if(reRender) this._renderTypeTemplates(el); };
    el.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{ const data=readAll(); data[b.dataset.add].push('New'); persist(data,true); }));
    el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const p=b.dataset.del.split(':'); const data=readAll(); data[p[0]].splice(+p[1],1); persist(data,true); }));
    el.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{ const p=b.dataset.move.split(':'); const data=readAll(); const a=data[p[0]],j=+p[1]+ +p[2]; if(j<0||j>=a.length)return; const t=a[+p[1]];a[+p[1]]=a[j];a[j]=t; persist(data,true); }));
    ge('tpl-save')?.addEventListener('click',()=>{ persist(readAll(),false); toast('Templates saved ✅','ok'); });
    ge('tpl-reset')?.addEventListener('click',()=>{ const patch={}; defs.forEach(d=>patch[d.key]=[]); Prod._tplSave(patch); toast('Reset to defaults','ok'); this._renderTypeTemplates(el); });
  },


  _openOrgForm(e={}) {
    Modal.open(e.id?`✏ Edit: ${e.name}`:'＋ New Organization',`
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--amber);margin-bottom:8px">Identity</div>
      <div class="form-grid">
        <div class="field full"><label class="flabel">Organization Name <span style="color:var(--red)">*</span></label>
          <input class="finput" id="of-name" value="${e.name||''}" placeholder="e.g. ConSite Pty (Ltd)"></div>
        <div class="field"><label class="flabel">Type</label>
          <input class="finput" id="of-type" list="of-type-list" value="${e.type||'Main Contractor'}">
          <datalist id="of-type-list"><option>Main Contractor<option>Sub-Contractor<option>JV Partner<option>Consultant<option>Client<option>Supplier</datalist>
        </div>
        <div class="field"><label class="flabel">Reg. No.</label>
          <input class="finput" id="of-reg" value="${e.regNo||''}" placeholder="C001/2020"></div>
        <div class="field"><label class="flabel">Country</label>
          <input class="finput" id="of-country" list="of-country-list" value="${e.country||'Eswatini'}">
          <datalist id="of-country-list"><option>Eswatini<option>South Africa<option>Mozambique<option>Zimbabwe<option>Botswana</datalist>
        </div>
        <div class="field"><label class="flabel">Currency</label>
          <input class="finput" id="of-currency" list="of-cur-list" value="${e.currency||'SZL'}">
          <datalist id="of-cur-list"><option>SZL<option>ZAR<option>USD<option>EUR<option>MZN</datalist>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--amber);margin:12px 0 8px">Contact</div>
      <div class="form-grid">
        <div class="field full"><label class="flabel">Physical Address <span class="pa-mini" style="color:var(--text3)">(up to 3 lines)</span></label>
          <textarea class="ftextarea" id="of-addr" rows="3" placeholder="Building / Street&#10;Town / City&#10;Region, Country">${e.address||''}</textarea></div>
        <div class="field full"><label class="flabel">Postal Address <span class="pa-mini" style="color:var(--text3)">(up to 2 lines)</span></label>
          <textarea class="ftextarea" id="of-postal" rows="2" placeholder="P.O. Box 1234&#10;Town, Postal Code">${e.postal||''}</textarea></div>
        <div class="field"><label class="flabel">Phone</label>
          <input class="finput" id="of-phone" value="${e.phone||''}" placeholder="+268 2505 0000"></div>
        <div class="field"><label class="flabel">Email</label>
          <input class="finput" id="of-email" type="email" value="${e.email||''}" placeholder="info@company.com"></div>
        <div class="field"><label class="flabel">Website</label>
          <input class="finput" id="of-web" value="${e.website||''}" placeholder="www.company.com"></div>
      </div>
    `,[{label:e.id?'Save Changes':'Create Organization',cls:'amber',fn:async()=>{
      const name=ge('of-name').value.trim();
      if(!name){toast('Organization name required','err');return;}
      const rec=Object.assign({}, e, {
        id:e.id||'ORG-'+uid(), name, type:ge('of-type').value,
        regNo:ge('of-reg').value, country:ge('of-country').value, currency:ge('of-currency').value,
        address:ge('of-addr').value, postal:ge('of-postal').value, phone:ge('of-phone').value,
        email:ge('of-email').value, website:ge('of-web').value,
        logo:e.logo||'', createdBy:e.createdBy||S.user?.id||'',
        createdAt:e.createdAt||new Date().toISOString()
      });
      if(!DB.organizations) DB.organizations=[];
      const idx=DB.organizations.findIndex(o=>o.id===rec.id);
      if(idx>=0) DB.organizations[idx]=rec; else DB.organizations.push(rec);
      this._activeOrg=rec.id;
      // Keep the in-session org current so the letterhead updates immediately
      if(!S.org || S.org.id===rec.id || S.user?.orgId===rec.id) S.org=rec;
      try{ App.updateOrgCrumb && App.updateOrgCrumb(); }catch(_){}
      // Mirror letterhead details into ReportSettings — this persists via the
      // reliable app_settings channel (same path that syncs logos), so the
      // report letterhead shows even if the organizations-table write is blocked.
      try{
        const _rs = ReportSettings.get();
        _rs.companyName = rec.name;
        _rs.address = rec.address||''; _rs.postal = rec.postal||'';
        _rs.phone = rec.phone||''; _rs.email = rec.email||'';
        _rs.website = rec.website||''; _rs.regNo = rec.regNo||'';
        ReportSettings.save(_rs);
      }catch(_){}
      let dbErr='';
      if(!S.isDemo&&S.scriptUrl){
        try{ await GAS.post({action:'save',sheet:'Organizations',record:rec}); }
        catch(err){ dbErr=(err&&err.message)||String(err); }
      }
      Modal.close();
      if(dbErr) toast('⚠ Letterhead saved, but org-table write failed: '+dbErr,'err');
      else toast(`Organization ${e.id?'updated':'created'} ✅`,'ok');
      this.render();
    }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  },

  _renderOverview(el) {
    const org  = DB.getOrg(this._activeOrg)||{};
    // Count items belonging to this org
    const orgProjects = DB.projects.filter(p=>!p.orgId||p.orgId===org.id);
    const orgUsers    = DB.users.filter(u=>!u.orgId||u.orgId===org.id);
    const orgCC       = (DB.costcodeTemplates||[]).filter(t=>!t.orgId||t.orgId===org.id);
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
        <div class="panel" style="text-align:center;padding:18px 10px">
          <div style="font-size:28px;margin-bottom:4px">👥</div>
          <div style="font-size:26px;font-weight:700;font-family:var(--fh);color:var(--amber)">${orgUsers.length}</div>
          <div style="font-size:11px;color:var(--text3)">Users</div>
        </div>
        <div class="panel" style="text-align:center;padding:18px 10px">
          <div style="font-size:28px;margin-bottom:4px">🏗</div>
          <div style="font-size:26px;font-weight:700;font-family:var(--fh);color:var(--green)">${orgProjects.length}</div>
          <div style="font-size:11px;color:var(--text3)">Projects</div>
        </div>
        <div class="panel" style="text-align:center;padding:18px 10px">
          <div style="font-size:28px;margin-bottom:4px">🏷</div>
          <div style="font-size:26px;font-weight:700;font-family:var(--fh);color:var(--blue)">${orgCC.length}</div>
          <div style="font-size:11px;color:var(--text3)">Cost Code Templates</div>
        </div>
        <div class="panel" style="text-align:center;padding:18px 10px">
          <div style="font-size:28px;margin-bottom:4px">🏢</div>
          <div style="font-size:26px;font-weight:700;font-family:var(--fh);color:var(--text)">${(DB.organizations||[]).length}</div>
          <div style="font-size:11px;color:var(--text3)">Organizations</div>
        </div>
      </div>
      <div class="panel" style="margin-bottom:12px">
        <div class="panel-title">Quick Actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <button class="btn amber sm" onclick="Org._activeSection='users';Org.render()">👥 Users</button>
          <button class="btn ghost sm" onclick="Org._activeSection='projects';Org.render()">🏗 Projects</button>
          <button class="btn ghost sm" onclick="Org._activeSection='cost-codes';Org.render()">🏷 CC Templates</button>
          <button class="btn ghost sm" onclick="Prod.openProjectForm()">＋ New Project</button>
          <button class="btn ghost sm" onclick="Org._openMoveItems()">🔀 Move Items</button>
        </div>
      </div>
      ${(()=>{
        const allOrgs = DB.organizations||[];
        if(allOrgs.length <= 1) return ''; // single org — nothing to show
        // Show projects that belong to OTHER orgs (not this one)
        const otherProjs = DB.projects.filter(p=>p.orgId && p.orgId!==org.id);
        if(!otherProjs.length) return '';
        return `<div class="panel">
          <div class="panel-title">🏗 Projects in Other Organizations</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            ${otherProjs.map(p=>{
              const pOrg = (allOrgs.find(o=>o.id===p.orgId)||{}).name||'Other org';
              return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px">
                🏗 <b>${p.code}</b> — ${p.name}
                <span style="font-size:10px;color:var(--text3)"> · ${pOrg}</span>
              </div>`;}).join('')}
          </div>
        </div>`;
      })()}`;
    el.querySelectorAll('[data-assignitem]')?.forEach(btn=>btn.addEventListener('click',()=>{
      Org._assignItem(btn.dataset.type, btn.dataset.id);
    }));
  },

  _openMoveItems() {
    const orgs = DB.organizations||[];
    if(orgs.length<2){toast('Create at least 2 organizations first to move items between them','info');return;}
    const fromId  = this._activeOrg;
    const orgOpts = orgs.map(o=>`<option value="${o.id}" ${o.id===fromId?'selected':''}>${o.name}</option>`).join('');
    const toOpts  = orgs.map(o=>`<option value="${o.id}" ${o.id!==fromId?'selected':''}>${o.name}</option>`).join('');

    // Helper: render a section of checkboxes
    const section = (title, items, cls, keyFn, labelFn, orgLabelFn) =>
      items.length ? `<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
          color:var(--amber);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <span>${title} <span style="color:var(--text3);font-weight:400">(${items.length})</span></span>
          <label style="cursor:pointer;font-size:11px;color:var(--text2)">
            <input type="checkbox" class="mv-all" data-cls="${cls}" style="accent-color:var(--amber)">
            Select all
          </label>
        </div>
        ${items.map(item=>`
          <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface);
            border-radius:5px;margin-bottom:3px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" value="${keyFn(item)}" class="${cls}" style="accent-color:var(--amber)">
            ${labelFn(item)}
            <span style="font-size:10px;color:var(--text3);margin-left:auto">${orgLabelFn(item)}</span>
          </label>`).join('')}
      </div>` : '';

    Modal.open('🔀 Move All Settings Between Organizations',`
      <p style="font-size:12px;color:var(--text2);margin-bottom:14px">
        Move projects, users, cost codes, plant inventory, BOQ data and cost code templates from one organization to another.
        Select the destination then tick items to move.
      </p>
      <div class="form-grid cols-2" style="margin-bottom:14px">
        <div class="field"><label class="flabel">Move FROM</label>
          <select class="fselect" id="mv-from">${orgOpts}</select></div>
        <div class="field"><label class="flabel">Move TO <span style="color:var(--red)">*</span></label>
          <select class="fselect" id="mv-to">${toOpts}</select></div>
      </div>
      <div style="max-height:380px;overflow-y:auto;padding-right:4px">
        ${section('Projects', DB.projects, 'mv-proj',
          p=>p.code,
          p=>`<span class="mono" style="color:var(--amber);font-size:12px">${p.code}</span><span style="font-size:12px;margin-left:6px">${p.name}</span>`,
          p=>(orgs.find(o=>o.id===p.orgId)||{}).name||'Unassigned')}
        ${section('Users', DB.users, 'mv-user',
          u=>u.id,
          u=>`<span style="font-size:12px;font-weight:600">${u.name}</span><span style="font-size:11px;color:var(--text2);margin-left:6px">${u.role}</span>`,
          u=>(orgs.find(o=>o.id===u.orgId)||{}).name||'Unassigned')}
        ${section('Cost Codes', DB.get('costcodes','').concat(DB.get('costcodes',DB.projects.map(p=>p.code).join(','))), 'mv-cc',
          cc=>cc.id,
          cc=>`<span class="mono" style="color:var(--amber);font-size:12px">${cc.code}</span><span style="font-size:12px;margin-left:6px">${cc.description}</span>`,
          cc=>{const p=DB.projects.find(x=>x.code===cc.project);return p?(orgs.find(o=>o.id===p.orgId)||{}).name||'Unassigned':'Unassigned';})}
        ${section('Cost Code Templates', DB.costcodeTemplates||[], 'mv-tpl',
          t=>t.id,
          t=>`<span class="mono" style="color:var(--blue);font-size:12px">${t.code}</span><span style="font-size:12px;margin-left:6px">${t.description}</span>`,
          t=>(orgs.find(o=>o.id===t.orgId)||{}).name||'(Global template)')}
      </div>
    `,[{label:'🔀 Move Selected',cls:'amber',fn:async()=>{
      const toOrgId=ge('mv-to').value;
      const fromOrgId=ge('mv-from').value;
      if(!toOrgId){toast('Select destination organization','err');return;}
      if(toOrgId===fromOrgId){toast('FROM and TO must be different organizations','err');return;}
      const toOrg=orgs.find(o=>o.id===toOrgId);
      let moved=0;

      // Projects: reassign orgId (removes from source org, belongs to dest)
      [...ge('modal-body').querySelectorAll('.mv-proj:checked')].forEach(cb=>{
        const p=DB.projects.find(x=>x.code===cb.value);
        if(p){ p.orgId=toOrgId; moved++;
          if(!S.isDemo&&S.scriptUrl)GAS.post({action:'save',sheet:'Projects',record:p}).catch(()=>{});}
      });
      // Users: reassign orgId
      [...ge('modal-body').querySelectorAll('.mv-user:checked')].forEach(cb=>{
        const u=DB.users.find(x=>x.id===cb.value);
        if(u){ u.orgId=toOrgId; moved++;
          if(!S.isDemo&&S.scriptUrl)GAS.post({action:'save',sheet:'Users',record:{...u,projects:(u.projects||[]).join(',')}}).catch(()=>{});}
      });
      // Cost codes: update project if applicable
      [...ge('modal-body').querySelectorAll('.mv-cc:checked')].forEach(cb=>{
        const cc=(DB.costcodes||[]).find(x=>x.id===cb.value);
        if(cc){ moved++;
          if(!S.isDemo&&S.scriptUrl)GAS.post({action:'save',sheet:'CostCodes',record:cc}).catch(()=>{});}
      });
      // Cost code templates: move to dest org, remove from source
      [...ge('modal-body').querySelectorAll('.mv-tpl:checked')].forEach(cb=>{
        const tpl=(DB.costcodeTemplates||[]).find(x=>x.id===cb.value);
        if(tpl){ tpl.orgId=toOrgId; moved++; }
      });

      Modal.close();
      toast(`${moved} item${moved!==1?'s':''} moved from ${(orgs.find(o=>o.id===fromOrgId)||{}).name||'source'} → ${toOrg?.name||toOrgId} ✅`,'ok');
      this.render();
    }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);

    // Wire "select all" checkboxes
    setTimeout(()=>{
      ge('modal-body').querySelectorAll('.mv-all').forEach(cb=>{
        cb.addEventListener('change',()=>{
          ge('modal-body').querySelectorAll('.'+cb.dataset.cls).forEach(c2=>c2.checked=cb.checked);
        });
      });
    },50);
  },

  _assignItem(type, id) {
    const orgs=(DB.organizations||[]);
    const orgOpts=orgs.map(o=>`<option value="${o.id}" ${o.id===this._activeOrg?'selected':''}>${o.name}</option>`).join('');
    Modal.open(`Assign to Organization`,`
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Assign <b>${id}</b> to:</p>
      <select class="fselect" id="ai-org">${orgOpts}</select>
    `,[{label:'Assign',cls:'amber',fn:async()=>{
      const toOrg=ge('ai-org').value;
      if(type==='project'){const p=DB.projects.find(x=>x.code===id);if(p){p.orgId=toOrg;DB.save('projects',p);if(!S.isDemo&&S.scriptUrl)GAS.post({action:'save',sheet:'Projects',record:p}).catch(()=>{});}}
      Modal.close(); toast('Assigned ✅','ok'); this.render();
    }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  },

  async _renderUsers(el) {
    el.innerHTML='<div class="empty"><div class="ico">⏳</div><p>Loading users…</p></div>';
    // Fetch live from GAS
    if(!S.isDemo && S.scriptUrl){
      try {
        const rows = await GAS.get({action:'getData', sheet:'Users', project:''});
        if(Array.isArray(rows)){
          DB.users = rows.map(u=>({...u,
            projects:typeof u.projects==='string'?u.projects.split(',').map(s=>s.trim()).filter(Boolean):(u.projects||[])
          }));
        }
      } catch(e){ toast('Could not refresh users','err'); }
    }
    // ── Fetch the DATABASE roles (profiles.role) so we can flag drift ──
    // users.role drives what the APP shows; profiles.role is what database security
    // actually enforces. If they disagree, someone looks like an admin in the UI but
    // every write is refused (or worse, has more rights than the UI suggests).
    let _profs=[];
    if(!S.isDemo && S.scriptUrl){
      try{ const pr=await GAS.get({action:'getData', sheet:'Profiles', project:''}); if(Array.isArray(pr)) _profs=pr; }catch(e){}
    }
    // The app links a user to their profile by ID (profiles.id = the auth user id, and
    // users.id holds that same id as text). Email is only a fallback, because profiles
    // may not store an email at all — matching on it alone produced false alarms.
    const _pById={}, _pByEmail={};
    _profs.forEach(p=>{
      if(p.id) _pById[String(p.id).trim().toLowerCase()]=p;
      if(p.email) _pByEmail[String(p.email).toLowerCase().trim()]=p;
    });
    const _profOf=u=>_pById[String(u.id||'').trim().toLowerCase()]
                  || _pByEmail[String(u.email||'').toLowerCase().trim()]
                  || null;
    const _dbRoleOf=u=>{ const p=_profOf(u); return p?(p.role||''):null; };
    // The database only distinguishes three levels: Admin (full), Viewer (read-only),
    // and everything else (normal write access). Compare on that basis.
    const _mismatch=u=>{
      const db=_dbRoleOf(u);
      if(db===null) return 'No sign-in account — this person is on the staff list but has never registered. Harmless if they are not meant to log in.';
      const app=u.role||'';
      if(app==='Admin' && db!=='Admin')  return 'App shows Admin, but database role is "'+db+'" — admin actions will be refused';
      if(app!=='Admin' && db==='Admin')  return 'Database grants FULL ADMIN though app role is "'+app+'" — more rights than intended';
      if(app==='Viewer' && db!=='Viewer') return 'App shows Viewer, but database role is "'+db+'" — this account can still write';
      if(app!=='Viewer' && db==='Viewer') return 'Database role is Viewer — all writes will be refused';
      return '';
    };
    const _bad=DB.users.filter(u=>_mismatch(u));
    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:12px;color:var(--text2)">${DB.users.length} users registered</span>
      </div>
      ${_bad.length?`<div style="border:1px solid var(--orange);background:rgba(249,115,22,.08);border-radius:8px;padding:10px 12px;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;color:var(--orange);margin-bottom:4px">⚠ ${_bad.length} account${_bad.length===1?'':'s'} need attention</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.5">Either the <b>App Role</b> and <b>DB Role</b> disagree, or the person has no sign-in account yet. Staff who only appear on timesheets and payroll do <b>not</b> need a sign-in account — only people who actually log in do.</div>
      </div>`:''}
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>App Role</th><th>DB Role</th><th>Company</th><th>Projects</th><th>Actions</th></tr></thead>
          <tbody>${DB.users.map(u=>{
            const _db=_dbRoleOf(u); const _m=_mismatch(u);
            return `<tr${_m?' style="background:rgba(249,115,22,.06)"':''}>
            <td class="bold">${u.name}</td>
            <td style="font-size:11px">${u.email}</td>
            <td><span style="font-size:11px">${u.role}</span></td>
            <td style="font-size:11px">${_db===null?'<span style="color:var(--red)">— none —</span>':(_m?'<span style="color:var(--orange)">'+_db+' ⚠</span>':'<span style="color:var(--green)">'+_db+'</span>')}${_m?'<div style="font-size:9.5px;color:var(--orange);line-height:1.35;margin-top:2px;white-space:normal;max-width:230px">'+_m+'</div>':''}</td>
            <td style="font-size:11px">${u.company||'—'}</td>
            <td style="font-size:11px">${u.role==='Admin'?'<span style="color:var(--green)">All</span>':(u.projects||[]).join(', ')||'<span style="color:var(--text3)">None</span>'}</td>
            <td><button class="btn ghost sm" data-uid="${u.id}">✏ Edit</button></td>
          </tr>`;}).join('')}</tbody>
        </table>
      </div>
      ${_bad.length?`<div style="font-size:10.5px;color:var(--text3);margin-top:8px;line-height:1.6">
        <b>To fix:</b> the database role lives in the <code>profiles</code> table and is what security actually checks. In Supabase → SQL Editor:<br>
        <code style="font-size:10px">update public.profiles set role = 'Admin' where email = 'user@example.com';</code><br>
        Use <code>'Admin'</code> for full rights, <code>'Viewer'</code> for read-only, or any other role name for normal write access.
      </div>`:''}`;
    el.querySelectorAll('[data-uid]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const u=DB.users.find(x=>x.id===btn.dataset.uid); if(!u) return;
        Modal.open(`✏ Edit User: ${u.name}`,`
          <div class="form-grid">
            <div class="field full"><label class="flabel">Full Name</label><input class="finput" id="eu-name" value="${u.name||''}"></div>
            <div class="field"><label class="flabel">Role</label>
              <select class="fselect" id="eu-role">${['Admin','Editor','Approver','Data Entry','Foreman','Gang Leader','Site Agent','Site Admin','Site Supervisor','Technician','SHEQ Officer','Stores / Procurement','Stores Assistant','Foreman Assistant','SHEQ Assistant','Plant Assistant','Data Entry Assistant','Viewer'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select></div>
            <div class="field"><label class="flabel">Company</label><input class="finput" id="eu-company" value="${u.company||''}"></div>
          </div>
          <div style="margin-top:12px"><label class="flabel" style="display:block;margin-bottom:8px">Project Access</label>
            ${DB.projects.map(p=>`
              <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface);border-radius:6px;margin-bottom:5px;cursor:pointer">
                <input type="checkbox" value="${p.code}" class="proj-cb" ${(u.projects||[]).includes(p.code)?'checked':''} style="accent-color:var(--amber)">
                <span style="font-size:12px"><b>${p.code}</b> — ${p.name}</span>
              </label>`).join('')}
            ${!DB.projects.length?'<p style="color:var(--text3);font-size:12px">No projects yet.</p>':''}
          </div>
        `,[{label:'Save',cls:'amber',fn:async()=>{
          u.name=ge('eu-name').value; u.role=ge('eu-role').value; u.company=ge('eu-company').value;
          u.projects=[...ge('modal-body').querySelectorAll('.proj-cb:checked')].map(i=>i.value);
          u.orgId = Org._activeOrg||u.orgId||'';  // assign to current org
          const rec={...u,projects:u.projects.join(','),password:u.password||''};
          if(!S.isDemo&&S.scriptUrl) await GAS.post({action:'save',sheet:'Users',record:rec}).catch(()=>{});
          Modal.close(); toast('User updated ✅','ok'); Org._renderUsers(ge('org-section-body'));
        }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
      });
    });
  },

  _renderProjects(el) {
    const projs = DB.projects;
    const thisOrg = DB.getOrg(this._activeOrg);
    const allOrgs = DB.organizations||[];
    // Show all projects — highlight those in current org, dim others
    const allProjs = DB.projects;
    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <span style="font-size:12px;color:var(--text2)">${allProjs.length} total project${allProjs.length!==1?'s':''}</span>
          ${thisOrg?`<span style="font-size:11px;color:var(--amber);margin-left:8px">🏢 ${thisOrg.name}</span>`:''}
        </div>
        <button class="btn amber sm" onclick="Prod.openProjectForm()">＋ New Project</button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Code</th><th>Name</th><th>Organization</th><th>Client</th><th>Contract No.</th><th>Value (R)</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${allProjs.map(p=>{
            const pOrg = DB.getOrg(p.orgId);
            const inThisOrg = p.orgId===this._activeOrg;
            return `<tr style="${inThisOrg?'':'opacity:.6'}">
              <td class="mono bold">${p.code}</td>
              <td>${p.name}</td>
              <td>
                ${pOrg
                  ? `<span style="font-size:11px;color:var(--amber);font-weight:600">${pOrg.name}</span>`
                  : `<span style="font-size:11px;color:var(--orange)">⚠ Unassigned</span>`}
              </td>
              <td>${p.client||'—'}</td><td class="mono" style="font-size:11px">${p.contractNo||'—'}</td>
              <td class="bold">${fmtR(p.value||0)}</td>
              <td>${fmtD(p.startDate)}</td><td>${fmtD(p.endDate)}</td>
              <td>${pill(p.status==='In Progress'?'Active':p.status==='Completed'?'blue':'amber')}<span style="font-size:11px;margin-left:4px">${p.status}</span></td>
              <td style="display:flex;gap:4px">
                <button class="btn ghost sm" data-editproj="${p.code}">✏ Edit</button>
                ${!inThisOrg&&thisOrg?`<button class="btn amber sm" style="font-size:10px" data-assignproj="${p.code}">+ Assign here</button>`:''}
              </td>
            </tr>`;}).join('')||'<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text3)">No projects yet — click ＋ New Project</td></tr>'}
          </tbody>
        </table>
      </div>`;
    el.querySelectorAll('[data-editproj]').forEach(btn=>btn.addEventListener('click',()=>{
      Prod.openProjectForm(DB.projects.find(p=>p.code===btn.dataset.editproj)||{});
    }));
    el.querySelectorAll('[data-assignproj]').forEach(btn=>btn.addEventListener('click',async()=>{
      const p=DB.projects.find(x=>x.code===btn.dataset.assignproj);
      if(p){ p.orgId=this._activeOrg; DB.save('projects',p);
        if(!S.isDemo&&S.scriptUrl) await GAS.post({action:'save',sheet:'Projects',record:p}).catch(()=>{});
        toast(`${p.code} assigned to ${DB.getOrg(this._activeOrg)?.name||'org'} ✅`,'ok');
        this._renderSection();
      }
    }));
  },

  _renderCostCodeTemplates(el) {
    const orgId = this._activeOrg;
    const org   = DB.getOrg(orgId)||{};
    // Show templates belonging to this org
    const tpls  = (DB.costcodeTemplates||[]).filter(t=>!t.orgId||t.orgId===orgId);
    const otherOrgs = (DB.organizations||[]).filter(o=>o.id!==orgId);

    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:600">🏷 Cost Code Templates — ${org.name||'Org'}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">
            Org-level library. Templates here auto-suggest when creating project cost codes.
            Mark as <b>Standard</b> to suggest globally; unmarked templates stay within this org.
          </div>
        </div>
        <div style="display:flex;gap:6px">
          ${otherOrgs.length?`<button class="btn ghost sm" id="btn-copy-cc-org">📋 Copy From…</button>`:''}
          <button class="btn amber sm" id="btn-new-cc-tpl">＋ Add Template</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Scope</th><th>Budget Lines</th><th>Actions</th></tr></thead>
          <tbody>${tpls.map(t=>`<tr>
            <td class="mono bold" style="color:var(--amber)">${t.code}</td>
            <td>${t.description}</td>
            <td>${t.category||'—'}</td>
            <td>${t.standard
              ?'<span style="font-size:10px;background:rgba(34,197,94,.12);color:var(--green);padding:2px 6px;border-radius:3px;font-weight:600">🌐 Standard</span>'
              :'<span style="font-size:10px;background:rgba(240,165,0,.1);color:var(--amber);padding:2px 6px;border-radius:3px">🏢 This Org</span>'
            }</td>
            <td style="font-size:11px;color:var(--text3)">${(()=>{try{const bl=JSON.parse(t.budgetLines||'[]');return bl.length?bl.length+' line'+( bl.length!==1?'s':''):'—';}catch{return'—';}})()}</td>
            <td style="display:flex;gap:4px">
              <button class="btn ghost sm ico" data-edittpl="${t.id}">✏</button>
              ${otherOrgs.length?`<button class="btn ghost sm" style="font-size:10px" data-copytpl="${t.id}">→ Copy</button>`:''}
              <button class="btn danger sm ico" data-deltpl="${t.id}">🗑</button>
            </td>
          </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">No templates yet — click ＋ Add Template</td></tr>'}</tbody>
        </table>
      </div>
      <div style="background:rgba(240,165,0,.06);border:1px solid rgba(240,165,0,.15);border-radius:6px;padding:10px 12px;font-size:11px;color:var(--text2);margin-top:10px">
        💡 <b>Standard</b> templates appear as suggestions in all organizations.<br>
        <b>This Org</b> templates appear only when creating cost codes in projects belonging to <em>${org.name||'this org'}</em>.
      </div>
    `;

    ge('btn-new-cc-tpl')?.addEventListener('click',()=>Org._openTemplateForm({orgId}));
    ge('btn-copy-cc-org')?.addEventListener('click',()=>Org._openCopyTemplatesFrom(orgId));

    el.querySelectorAll('[data-edittpl]').forEach(btn=>btn.addEventListener('click',()=>
      Org._openTemplateForm({...(DB.costcodeTemplates||[]).find(t=>t.id===btn.dataset.edittpl)||{}, orgId})));

    el.querySelectorAll('[data-copytpl]').forEach(btn=>btn.addEventListener('click',()=>{
      const tpl=(DB.costcodeTemplates||[]).find(t=>t.id===btn.dataset.copytpl);
      if(!tpl||otherOrgs.length===0) return;
      Org._copyTemplateTo(tpl, otherOrgs);
    }));

    el.querySelectorAll('[data-deltpl]').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm('Delete this template?')) return;
      DB.costcodeTemplates=(DB.costcodeTemplates||[]).filter(t=>t.id!==btn.dataset.deltpl);
      toast('Template removed','ok'); Org._renderSection();
    }));
  },

  _openCopyTemplatesFrom(destOrgId) {
    const destOrg  = DB.getOrg(destOrgId)||{};
    const srcOrgs  = (DB.organizations||[]).filter(o=>o.id!==destOrgId);
    const [srcOrg] = srcOrgs;
    if(!srcOrg) return;
    // Pick first other org, or let user choose if multiple
    const srcId  = srcOrgs.length===1 ? srcOrg.id : null;
    const srcTpls = (DB.costcodeTemplates||[]).filter(t=>t.orgId===srcId||(srcOrgs.length===1&&t.orgId===srcOrg.id));
    Modal.open(`📋 Copy Templates to ${destOrg.name}`,`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <div class="field" style="flex:1">
          <label class="flabel">Copy FROM organization</label>
          <select class="fselect" id="cpf-src">${srcOrgs.map(o=>`<option value="${o.id}">${o.name}</option>`).join('')}</select>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text2);margin-bottom:10px">
        Select templates to copy to <b>${destOrg.name}</b>. Copies are independent — changes after copying don't sync back.
      </p>
      <div id="cpf-list" style="max-height:300px;overflow-y:auto">
        ${(DB.costcodeTemplates||[]).filter(t=>t.orgId!==destOrgId).map(t=>`
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border-radius:5px;margin-bottom:4px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" value="${t.id}" class="cpf-cb" style="accent-color:var(--amber);width:16px;height:16px">
            <span class="mono" style="color:var(--amber)">${t.code}</span>
            <span style="font-size:12px">${t.description}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto">${(DB.getOrg(t.orgId)||{}).name||'Global'}</span>
          </label>`).join('')||'<p style="color:var(--text3);font-size:12px;text-align:center;padding:12px">No templates to copy from.</p>'}
      </div>
    `,[{label:'Copy Selected',cls:'amber',fn:async()=>{
      const sel=[...ge('cpf-list').querySelectorAll('.cpf-cb:checked')].map(i=>i.value);
      if(!sel.length){toast('Select at least one template','err');return;}
      let copied=0;
      sel.forEach(id=>{
        const orig=(DB.costcodeTemplates||[]).find(t=>t.id===id);
        if(!orig) return;
        const copy={...orig, id:'CCT-'+uid(), orgId:destOrgId};
        if(!DB.costcodeTemplates) DB.costcodeTemplates=[];
        DB.costcodeTemplates.push(copy);
        if(!S.isDemo&&S.scriptUrl)
          GAS.post({action:'save',sheet:'CostCodeTemplates',record:copy}).catch(()=>{});
        copied++;
      });
      Modal.close(); toast(`${copied} template${copied!==1?'s':''} copied to ${destOrg.name} ✅`,'ok');
      Org._renderSection();
    }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  },

  _copyTemplateTo(tpl, targetOrgs) {
    if(targetOrgs.length===1) {
      const copy={...tpl, id:'CCT-'+uid(), orgId:targetOrgs[0].id};
      if(!DB.costcodeTemplates) DB.costcodeTemplates=[];
      DB.costcodeTemplates.push(copy);
      if(!S.isDemo&&S.scriptUrl)
        GAS.post({action:'save',sheet:'CostCodeTemplates',record:copy}).catch(()=>{});
      toast(`Copied to ${targetOrgs[0].name} ✅`,'ok'); Org._renderSection(); return;
    }
    // Multiple orgs — let user pick
    Modal.open('Copy Template To…',`
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Copy <b>${tpl.code}</b> to:</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${targetOrgs.map(o=>`<button class="btn ghost sm" data-copyto="${o.id}" style="text-align:left;justify-content:flex-start">${o.name}</button>`).join('')}
      </div>
    `,[{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
    setTimeout(()=>{
      ge('modal-body').querySelectorAll('[data-copyto]').forEach(btn=>btn.addEventListener('click',()=>{
        const copy={...tpl,id:'CCT-'+uid(),orgId:btn.dataset.copyto};
        if(!DB.costcodeTemplates) DB.costcodeTemplates=[];
        DB.costcodeTemplates.push(copy);
        if(!S.isDemo&&S.scriptUrl)
          GAS.post({action:'save',sheet:'CostCodeTemplates',record:copy}).catch(()=>{});
        Modal.close(); toast(`Copied ✅`,'ok'); Org._renderSection();
      }));
    },50);
  },


  _openTemplateForm(e={}) {
    Modal.open(e.id?'✏ Edit Template':'＋ New Cost Code Template',`
      <div class="form-grid">
        <div class="field"><label class="flabel">Code <span style="color:var(--red)">*</span></label>
          <input class="finput" id="tpl-code" value="${e.code||''}" placeholder="EW, PAVE, STRUCT…"></div>
        <div class="field"><label class="flabel">Category</label>
          <input class="finput" id="tpl-cat" list="tpl-cat-list" value="${e.category||'Civil'}">
          <datalist id="tpl-cat-list">${['Civil','Structural','SHEQ','Preliminaries','Provisional','Plant','Labour'].map(s=>`<option value="${s}">`).join('')}</datalist>
        </div>
        <div class="field full"><label class="flabel">Description</label>
          <input class="finput" id="tpl-desc" value="${e.description||''}" placeholder="e.g. Earthworks & Bulk Grading"></div>
        <div class="field full">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text2)">
            <input type="checkbox" id="tpl-std" ${e.standard?'checked':''} style="accent-color:var(--amber)">
            Mark as <b>Standard</b> (suggested by default on all projects)
          </label>
        </div>
      </div>
    `,[{label:'Save',cls:'amber',fn:()=>{
      const code=ge('tpl-code').value.trim();
      if(!code){toast('Code required','err');return;}
      const rec={id:e.id||'CCT-'+uid(),code,description:ge('tpl-desc').value,
        category:ge('tpl-cat').value,standard:ge('tpl-std').checked};
      if(!DB.costcodeTemplates) DB.costcodeTemplates=[];
      const idx=DB.costcodeTemplates.findIndex(t=>t.id===rec.id);
      if(idx>=0) DB.costcodeTemplates[idx]=rec; else DB.costcodeTemplates.push(rec);
      Modal.close(); toast('Template saved ✅','ok'); Org._renderSection();
    }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
  }
};

/* ═══════════════════════════════════════════════════
   SETTINGS (Admin-only main tab)
═══════════════════════════════════════════════════ */
const SettingsMain = {
  render() {
    const body = ge('settings-main-body');
    if(!body) return;
    if(!_canDo('<span class="material-icons-outlined" aria-hidden="true">settings</span> Settings','view')){ body.innerHTML='<div class="empty"><div class="ico">🔒</div><p>You don\'t have access to Settings.<br><span style="font-size:11px;color:var(--text3)">Ask your Admin to update your permissions.</span></p></div>'; return; }
    this.renderInto(body);
  },

  async renderInto(el) {
    const proj = S.project ? (DB.getProject(S.project)||{}) : null;
    // Fetch live users for security management
    if(!S.isDemo && S.scriptUrl){
      try {
        const rows=await GAS.get({action:'getData',sheet:'Users',project:''});
        if(Array.isArray(rows)) DB.users=rows.map(u=>({...u,
          projects:typeof u.projects==='string'?u.projects.split(',').map(s=>s.trim()).filter(Boolean):(u.projects||[])}));
      } catch(e){}
    }
    const allUsers = DB.users;

    el.innerHTML=`
      <div class="sec-hdr"><div class="sec-title">⚙ Application Settings</div></div>

      ${proj ? `
      <div class="panel">
        <div class="panel-title">🏗 Active Project Details — ${proj.code}</div>
        <div class="form-grid">
          <div class="field"><label class="flabel">Project Name</label><input class="finput" id="sp-name" value="${proj.name||''}"></div>
          <div class="field"><label class="flabel">Project Code</label><input class="finput ro" value="${proj.code||''}" readonly></div>
          <div class="field"><label class="flabel">Client / Employer</label><input class="finput" id="sp-client" value="${proj.client||''}"></div>
          <div class="field"><label class="flabel">Contract No.</label><input class="finput" id="sp-contract" value="${proj.contractNo||''}"></div>
          <div class="field"><label class="flabel">Contract Value (R)</label><input class="finput" id="sp-value" type="number" value="${proj.value||0}"></div>
          <div class="field"><label class="flabel">Start Date</label><input class="finput" id="sp-start" type="date" value="${proj.startDate||''}"></div>
          <div class="field"><label class="flabel">End Date</label><input class="finput" id="sp-end" type="date" value="${proj.endDate||''}"></div>
          <div class="field"><label class="flabel">Project Manager</label><input class="finput" id="sp-pm" value="${proj.pm||''}"></div>
          <div class="field"><label class="flabel">Location</label><input class="finput" id="sp-loc" value="${proj.location||''}"></div>
          <div class="field"><label class="flabel">Status</label>
            <select class="fselect" id="sp-stat">${['In Progress','Completed','On Hold','Tendering'].map(s=>`<option ${proj.status===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
        </div>
        <button class="btn amber sm" id="btn-save-proj-set">💾 Save Project</button>
      </div>` : `
      <div class="panel">
        <div style="color:var(--text2);font-size:13px;padding:4px 0">Select a project from the dropdown to edit its details.</div>
      </div>`}

      <!-- ── Month-End Costing Sign-off ─────────────── -->
      <div class="panel">
        <div class="panel-title">🧾 Month-End Costing Sign-off</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Require the <b>Site Agent</b> and <b>Technician</b> to review and approve the Costing Report each month-end. They'll be prompted from the review day onward until both have approved every completed month.</div>
        <div class="form-grid">
          <div class="field"><label class="flabel">Require monthly sign-off</label>
            <select class="fselect" id="ca-enabled">
              <option value="yes" ${Prod._caEnabled()?'selected':''}>Yes — prompt Site Agent &amp; Technician</option>
              <option value="no" ${!Prod._caEnabled()?'selected':''}>No — off</option>
            </select></div>
          <div class="field"><label class="flabel">Review due from day of month</label>
            <input class="finput" id="ca-day" type="number" min="1" max="28" value="${Prod._caReviewDay()}" placeholder="e.g. 1">
            <div style="font-size:10px;color:var(--text3);margin-top:3px">From this day, last month's costing must be signed off.</div></div>
        </div>
        <button class="btn amber sm" id="btn-save-ca" style="margin-top:8px">💾 Save Sign-off Settings</button>
      </div>

      <!-- ── Connection & Offline Sync ─────────────── -->
      <div class="panel">
        <div class="panel-title">🔌 Connection &amp; Offline Sync</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Every save is written to this device first, then to the database. If the database can't be reached, the entry is <b>held safely on the device</b> and syncs automatically when the connection returns — you'll see a red alert and a <b>PENDING SYNC</b> badge (top-right). Nothing is ever lost or falsely reported as saved.</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Browser status: <b id="conn-status">${navigator.onLine===false?'🔴 Offline':'🟢 Online'}</b> &nbsp;·&nbsp; Pending on this device: <b>${(window.SB&&SB.pendingCount)?SB.pendingCount():0}</b></div>
        <button class="btn ghost sm" id="btn-test-sync">🔌 Run a safe test (show me how it behaves)</button>
        <button class="btn ghost sm" id="btn-inspect-sync" style="margin-left:6px">🔎 What's pending?</button>
        <button class="btn ghost sm" id="btn-clear-sync" style="margin-left:6px">🗑 Clear stuck queue</button>
        <div style="font-size:11px;color:var(--text3);margin-top:8px">Real test: open your browser's <b>DevTools → Network → Offline</b>, save any form (you'll get the red alert + PENDING badge), refresh (still pending), then set it back to <b>Online</b> — it syncs and the badge returns to LIVE.</div>
      </div>

      <!-- ── Users (replaces DB Connection for security) ─────────────── -->
      <div class="panel">
        <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>👥 Users</span>
          <span style="font-size:10px;color:var(--text3)">${allUsers.length} registered · Role & project access managed here</span>
        </div>
        <p style="font-size:11px;color:var(--text2);margin-bottom:10px">
          Manage user roles and project access. The database connection URL is not exposed here for security.
          To reconfigure the database, use the <b>Setup screen</b> accessible only via the sign-out button.
        </p>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Organization</th><th>Projects</th><th>Actions</th></tr></thead>
            <tbody>
              ${allUsers.map(u=>`<tr>
                <td class="bold">${u.name}</td>
                <td style="font-size:11px">${u.email}</td>
                <td><span style="font-size:11px">${u.role}</span></td>
                <td style="font-size:11px;color:var(--amber)">${(DB.getOrg(u.orgId)||{}).name||'<span style="color:var(--orange)">⚠ Unassigned</span>'}</td>
                <td style="font-size:11px">${u.role==='Admin'?'<span style="color:var(--green)">All</span>':(u.projects||[]).join(', ')||'<span style="color:var(--text3)">None</span>'}</td>
                <td><button class="btn ghost sm" data-suid="${u.id}">✏ Edit</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px;padding:10px 12px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:6px;font-size:11px;color:var(--text2)">
          🔐 <b>Database connection URL</b> is intentionally not shown here to prevent unauthorized access.
          Only the person who set up the system knows the Apps Script URL.
          <button class="btn ghost sm" style="margin-left:8px;font-size:10px" onclick="if(confirm('Sign out to access setup?'))Auth.logout()">Sign out to reconfigure</button>
        </div>
      </div>
    `;

    // Wire save project
    const saveBtn=ge('btn-save-proj-set');
    if(saveBtn && proj) saveBtn.addEventListener('click', async()=>{
      proj.name=ge('sp-name').value; proj.client=ge('sp-client').value;
      proj.contractNo=ge('sp-contract').value; proj.value=+ge('sp-value').value;
      proj.startDate=ge('sp-start').value; proj.endDate=ge('sp-end').value;
      proj.pm=ge('sp-pm').value; proj.location=ge('sp-loc').value; proj.status=ge('sp-stat').value;
      const opt=[...ge('proj-sel').options].find(o=>o.value===S.project);
      if(opt) opt.textContent=`${proj.code} · ${proj.name}`;
      if(!S.isDemo&&S.scriptUrl) await GAS.post({action:'save',sheet:'Projects',record:proj}).catch(e=>toast(e.message,'err'));
      toast('Project saved ✅','ok');
    });

    const caBtn=ge('btn-save-ca');
    if(caBtn) caBtn.addEventListener('click', ()=>{
      const enabled=ge('ca-enabled').value==='yes';
      let day=parseInt(ge('ca-day').value)||1; if(day<1)day=1; if(day>28)day=28;
      if(Prod._tplSave) Prod._tplSave({ costingReviewEnabled:enabled, costingReviewDay:day });
      toast('Costing sign-off settings saved ✅','ok');
    });

    const tsBtn=ge('btn-test-sync');
    if(tsBtn) tsBtn.addEventListener('click', ()=>{ if(window.SB&&SB._testSync) SB._testSync(); });
    const inspBtn=ge('btn-inspect-sync');
    if(inspBtn) inspBtn.addEventListener('click', ()=>{ if(window.SB&&SB._outboxInfo) alert('Pending changes on this device:\n\n'+SB._outboxInfo()); });
    const clrBtn=ge('btn-clear-sync');
    if(clrBtn) clrBtn.addEventListener('click', ()=>{ if(window.SB&&SB._clearOutbox && confirm('Clear the pending-sync queue on this device? Do this only if a change is stuck and you have run the required SQL steps. Unsynced changes in the queue will be discarded.')){ SB._clearOutbox(); SettingsMain.renderInto(el); } });

    el.querySelectorAll('[data-suid]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const u=DB.users.find(x=>x.id===btn.dataset.suid); if(!u) return;
        const orgs=DB.organizations||[];
        Modal.open(`✏ Edit User: ${u.name}`,`
          <div class="form-grid">
            <div class="field full"><label class="flabel">Full Name</label><input class="finput" id="su-name" value="${u.name||''}"></div>
            <div class="field"><label class="flabel">Role</label>
              <select class="fselect" id="su-role">${['Admin','Editor','Approver','Data Entry','Foreman','Gang Leader','Site Agent','Site Admin','Site Supervisor','Technician','SHEQ Officer','Stores / Procurement','Viewer'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select></div>
            <div class="field"><label class="flabel">Organization</label>
              <select class="fselect" id="su-org">
                <option value="">— Unassigned (no access) —</option>
                ${orgs.map(o=>`<option value="${o.id}" ${u.orgId===o.id?'selected':''}>${o.name}</option>`).join('')}
              </select></div>
          </div>
          <div style="margin-top:10px">
            <label class="flabel" style="display:block;margin-bottom:6px">Project Access</label>
            ${DB.projects.map(p=>`
              <label style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface);border-radius:5px;margin-bottom:4px;cursor:pointer">
                <input type="checkbox" class="su-proj" value="${p.code}" ${(u.projects||[]).includes(p.code)?'checked':''} style="accent-color:var(--amber)">
                <span class="mono" style="color:var(--amber);font-size:12px">${p.code}</span>
                <span style="font-size:12px">${p.name}</span>
              </label>`).join('')}
            ${!DB.projects.length?'<p style="color:var(--text3);font-size:12px">No projects yet.</p>':''}
          </div>
        `,[{label:'Save',cls:'amber',fn:async()=>{
          u.name=ge('su-name').value; u.role=ge('su-role').value; u.orgId=ge('su-org').value;
          u.projects=[...ge('modal-body').querySelectorAll('.su-proj:checked')].map(i=>i.value);
          const rec={...u,projects:u.projects.join(','),password:u.password||''};
          if(!S.isDemo&&S.scriptUrl) await GAS.post({action:'save',sheet:'Users',record:rec}).catch(()=>{});
          Modal.close(); toast('User updated ✅','ok'); SettingsMain.renderInto(el);
        }},{label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}]);
      });
    });
  }
};

/* ═══════════════════════════════════════════════════
   PAYROLL
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   ACCOUNTING  —  main tab
═══════════════════════════════════════════════════ */
const Accounting = {

  render() {
    const el=ge('acc-body'); if(!el) return;
    const recs=(DB.accRecords||[]).filter(r=>!S.project||r.project===S.project).sort((a,b)=>(b.submittedAt||'')>(a.submittedAt||'')?1:-1);
    const proj=DB.getProject(S.project)||{};

    // Group by contract
    const byContract={};
    recs.forEach(r=>{
      const k=r.contractNo||r.project||'—';
      if(!byContract[k]) byContract[k]=[];
      byContract[k].push(r);
    });

    const statusColor=s=>s==='paid'?'var(--green)':s==='approved'?'var(--blue)':s==='rejected'?'var(--red)':s==='processed'?'var(--amber)':'var(--text2)';
    const statusLabel=s=>({received:'📥 Received',reviewed:'👁 Reviewed',approved:'✅ Approved',rejected:'❌ Rejected',paid:'💳 Payment Issued',pending:'⏳ Pending'}[s]||s);

    el.innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title"><span class="material-icons-outlined" aria-hidden="true">bar_chart</span> Accounting Department</div>
        <div class="sec-actions">
          <button class="btn ghost sm" onclick="Accounting.exportJournal()">📊 Export Journal</button>
        </div>
      </div>

      <!-- Summary KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px">
        <div class="stat-mini"><div class="stat-v">${recs.length}</div><div class="stat-l">Total Received</div></div>
        <div class="stat-mini"><div class="stat-v" style="color:var(--amber)">${recs.filter(r=>r.status==='received').length}</div><div class="stat-l">Awaiting Review</div></div>
        <div class="stat-mini"><div class="stat-v" style="color:var(--blue)">${recs.filter(r=>r.status==='approved').length}</div><div class="stat-l">Approved</div></div>
        <div class="stat-mini"><div class="stat-v" style="color:var(--green)">${recs.filter(r=>r.status==='paid').length}</div><div class="stat-l">Paid</div></div>
        <div class="stat-mini"><div class="stat-v" style="color:var(--green);font-size:13px">E${recs.reduce((s,r)=>s+(r.totalNet||0),0).toFixed(0)}</div><div class="stat-l">Total Net Pay</div></div>
        <div class="stat-mini"><div class="stat-v" style="color:var(--amber);font-size:13px">E${recs.filter(r=>r.status!=='paid').reduce((s,r)=>s+(r.totalNet||0),0).toFixed(0)}</div><div class="stat-l">Outstanding</div></div>
      </div>

      <!-- Workflow guide -->
      <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text2)">
        <b>Accounting Workflow:</b>
        📥 Received → 👁 Review &amp; verify pay calculations → ✅ Approve →
        Generate Payment Voucher → 💳 Issue Payment (bank transfers / cash) →
        SNPF remittance → PAYE remittance → Journal entry → 🗄 Archive
      </div>

      ${!recs.length?`
        <div class="empty" style="padding:32px 0">
          <div class="ico">🏦</div>
          <p>No payroll records received yet.</p>
          <p style="font-size:12px;color:var(--text3);margin-top:4px">
            Process a period in <b><span class="material-icons-outlined" aria-hidden="true">account_balance_wallet</span> Payroll</b> then click <b>📤 Send to Accounting</b>.
          </p>
        </div>` :

        Object.entries(byContract).map(([cn,crecs])=>`
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:800;color:var(--amber);padding:7px 12px;
            background:rgba(240,165,0,.07);border-radius:6px 6px 0 0;
            border:1px solid rgba(240,165,0,.2);display:flex;justify-content:space-between;align-items:center">
            <span>📄 ${cn}</span>
            <span style="font-size:11px;color:var(--text2)">${crecs.length} period${crecs.length!==1?'s':''} · Total net: E${crecs.reduce((s,r)=>s+(r.totalNet||0),0).toFixed(2)}</span>
          </div>
          <div style="border:1px solid rgba(240,165,0,.2);border-top:0;border-radius:0 0 6px 6px">
          ${crecs.map(r=>`
            <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                <div>
                  <div style="font-size:12px;font-weight:700">${r.periodRef||r.id} · ${fmtD(r.openDate)} → ${fmtD(r.closeDate)}</div>
                  <div style="font-size:11px;color:var(--text3)">Received from Payroll: ${r.submittedAt?new Date(r.submittedAt).toLocaleString('en-ZA',{dateStyle:'medium'}):''}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  <span style="font-size:11px;padding:3px 10px;border-radius:4px;font-weight:600;background:rgba(59,130,246,.1);color:${statusColor(r.status)}">${statusLabel(r.status)}</span>
                  ${r.status==='received'||r.status==='reviewed'?`
                    <button class="btn ghost sm" onclick="Accounting.reviewPeriod('${r.id}')">👁 Review</button>
                    <button class="btn amber sm" onclick="Accounting.approvePeriod('${r.id}')">✅ Approve</button>
                    <button class="btn danger sm" onclick="Accounting.rejectPeriod('${r.id}')">❌ Reject</button>`:''}
                  ${r.status==='approved'?`
                    <button class="btn amber sm" onclick="Accounting.issuePayment('${r.id}')">💳 Issue Payment</button>
                    <button class="btn ghost sm" onclick="Accounting.genVoucher('${r.id}')">🧾 Voucher</button>
                    <button class="btn ghost sm" onclick="Accounting.genJournal('${r.id}')">📒 Journal</button>`:''}
                  ${r.status==='paid'?`
                    <button class="btn ghost sm" onclick="Accounting.viewRecord('${r.id}')"><span class="material-icons-outlined" aria-hidden="true">visibility</span> View</button>
                    <button class="btn ghost sm" onclick="Accounting.genVoucher('${r.id}')">🧾 Voucher</button>
                    <button class="btn ghost sm" onclick="Accounting.genJournal('${r.id}')">📒 Journal</button>`:''}
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:5px">
                <div class="stat-mini"><div class="stat-v">${r.workers||0}</div><div class="stat-l">Workers</div></div>
                <div class="stat-mini"><div class="stat-v" style="color:var(--green);font-size:13px">E${(r.totalGross||0).toFixed(2)}</div><div class="stat-l">Gross Pay</div></div>
                <div class="stat-mini"><div class="stat-v" style="color:var(--amber);font-size:13px">E${(r.totalNet||0).toFixed(2)}</div><div class="stat-l">Net Pay</div></div>
                <div class="stat-mini"><div class="stat-v" style="color:var(--red);font-size:13px">E${((r.totalGross||0)-(r.totalNet||0)).toFixed(2)}</div><div class="stat-l">Deductions</div></div>
              </div>
              ${r.paymentRef?`<div style="font-size:11px;color:var(--green);margin-top:6px">✅ Payment Ref: ${r.paymentRef} · Paid: ${fmtD(r.paidDate)}</div>`:''}
              ${r.rejReason?`<div style="font-size:11px;color:var(--red);margin-top:4px">❌ Rejected: ${r.rejReason}</div>`:''}
            </div>`).join('')}
          </div>
        </div>`).join('')
      }
    `;
  },

  _getRecord(id) {
    return (DB.accRecords||[]).find(r=>r.id===id);
  },

  _save(r) {
    const arr=DB.accRecords||[];
    const idx=arr.findIndex(x=>x.id===r.id);
    if(idx>=0) arr[idx]=r; else arr.push(r);
    DB.accRecords=arr;
    if(!S.isDemo&&S.scriptUrl)
      GAS.post({action:'save',sheet:'AccRecords',record:{...r,payrollSnapshot:'',workerBreakdown:'',deductions:''}}).catch(()=>{});
  },

  reviewPeriod(id) {
    const r=this._getRecord(id); if(!r) return;
    r.status='reviewed'; this._save(r);
    toast('Marked as reviewed','ok'); this.render();
  },

  approvePeriod(id) {
    const r=this._getRecord(id); if(!r) return;
    r.status='approved'; r.approvedBy=S.user?.name||''; r.approvedAt=new Date().toISOString();
    this._save(r); toast('Period approved ✅','ok'); this.render();
  },

  rejectPeriod(id) {
    Modal.open('❌ Reject Payroll Period','<div class="field"><label class="flabel">Reason for rejection</label><textarea class="ftextarea" id="rej-reason" rows="3" placeholder="Describe the issue…"></textarea></div>',[
      {label:'Reject',cls:'danger',fn:()=>{
        const r=this._getRecord(id); if(!r) return;
        const reason=ge('rej-reason').value.trim();
        if(!reason){toast('Enter a reason','err');return;}
        r.status='rejected'; r.rejReason=reason; r.rejectedBy=S.user?.name||''; r.rejectedAt=new Date().toISOString();
        this._save(r); Modal.close(); toast('Period rejected','info'); this.render();
        // Notify payroll to re-process
        const ppAll=Payroll.getAllPeriods();
        const pp=ppAll.find(p=>(p.id||p.periodId)===r.periodId);
        if(pp){pp.status='pending';Payroll._updateStatus(pp,'pending');}
      }},
      {label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}
    ]);
  },

  issuePayment(id) {
    const r=this._getRecord(id); if(!r) return;
    Modal.open('💳 Issue Payment',`
      <div class="form-grid">
        <div class="field full"><label class="flabel">Payment Reference / EFT Batch No.</label>
          <input class="finput" id="pay-ref" placeholder="e.g. EFT-2026-04-001 or CHQNO-123"></div>
        <div class="field"><label class="flabel">Payment Date</label>
          <input class="finput" id="pay-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="field"><label class="flabel">Payment Method</label>
          <select class="fselect" id="pay-method">
            <option>EFT Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Mixed</option>
          </select></div>
        <div class="field full"><label class="flabel">Notes</label>
          <textarea class="ftextarea" id="pay-notes" rows="2" placeholder="Any payment notes…"></textarea></div>
      </div>
      <div style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:6px;padding:10px 12px;margin-top:8px;font-size:12px">
        Total Net Pay to issue: <b style="color:var(--green);font-size:16px">E${(r.totalNet||0).toFixed(2)}</b>
        for <b>${r.workers||0} workers</b>
      </div>`,[
      {label:'💳 Confirm Payment',cls:'amber',fn:()=>{
        const ref=ge('pay-ref').value.trim();
        if(!ref){toast('Payment reference required','err');return;}
        r.status='paid'; r.paymentRef=ref; r.paidDate=ge('pay-date').value;
        r.paymentMethod=ge('pay-method').value; r.paymentNotes=ge('pay-notes').value;
        r.paidBy=S.user?.name||'';
        this._save(r);
        // Mark payroll period as paid too
        const ppAll=Payroll.getAllPeriods();
        const pp=ppAll.find(p=>(p.id||p.periodId)===r.periodId);
        if(pp){pp.status='paid';Payroll._updateStatus(pp,'paid');}
        Modal.close(); toast('Payment issued ✅','ok'); this.render();
      }},
      {label:'Cancel',cls:'ghost',fn:Modal.close.bind(Modal)}
    ]);
  },

  viewRecord(id) {
    const r=this._getRecord(id); if(!r) return;
    const pp=(() => { try { return r.payrollSnapshot?JSON.parse(r.payrollSnapshot):{...r}; } catch { return {...r}; }})();
    Payroll.processPeriod(pp.id||pp.periodId||r.periodId||id);
  },

  genVoucher(id) {
    const r=this._getRecord(id); if(!r) return;
    const proj=DB.getProject(S.project)||{};
    const org=S.org||DB.getOrg(S.user?.orgId)||{};
    // Build pay rows from snapshot
    const ppObj=(() => { try { return r.payrollSnapshot?JSON.parse(r.payrollSnapshot):{...r}; } catch { return {...r}; }})();
    ppObj.id=ppObj.id||r.periodId;
    const payRows=Payroll.buildRows(ppObj);
    const fE=n=>'E '+(n||0).toFixed(2);
    const w=window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Voucher</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:9.5pt;padding:15mm}
    h1{font-size:18pt;font-weight:900;margin-bottom:2mm}h2{font-size:12pt;margin-bottom:3mm}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:5mm 0;padding:5mm;background:#f5f5f5;border-radius:3px}
    .lbl{font-size:7.5pt;color:#666}table{width:100%;border-collapse:collapse;margin:4mm 0}
    th,td{border:1px solid #ccc;padding:2mm 3mm;font-size:9pt}th{background:#e8e8e8}
    .right{text-align:right}.total{font-weight:700;background:#f0f0f0}
    .sig{display:flex;justify-content:space-between;margin-top:10mm;gap:10mm}
    .sline{border-bottom:1px solid #000;min-width:60mm;height:10mm}
    @media print{body{padding:8mm}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5mm">
      <div><h1>${org.name||proj.name||'COMPANY'}</h1><div style="font-size:9pt;color:#555">${proj.name||''} ${proj.contractNo?'· Contract: '+proj.contractNo:''}</div></div>
      <div style="text-align:right;border:2px solid #000;padding:3mm 6mm;border-radius:3px">
        <div style="font-size:14pt;font-weight:900">PAYMENT VOUCHER</div>
        <div style="font-size:8.5pt">Ref: ${r.paymentRef||'—'}</div>
        <div style="font-size:8.5pt">Date: ${r.paidDate?new Date(r.paidDate).toLocaleDateString('en-ZA'):'Pending'}</div>
      </div>
    </div>
    <div class="meta">
      <div><div class="lbl">Period</div><div>${fmtD(r.openDate)} — ${fmtD(r.closeDate)}</div></div>
      <div><div class="lbl">Contract No.</div><div style="font-weight:700">${r.contractNo||proj.contractNo||'—'}</div></div>
      <div><div class="lbl">Approved By</div><div>${r.approvedBy||'—'}</div></div>
      <div><div class="lbl">Payment Method</div><div>${r.paymentMethod||'—'}</div></div>
    </div>
    <h2>Payment Details — ${payRows.length} Employee${payRows.length!==1?'s':''}</h2>
    <table>
      <thead><tr><th>Name</th><th>ID</th><th>Skill</th><th class="right">Gross</th><th class="right">Deductions</th><th class="right">Net Pay</th><th>Method</th></tr></thead>
      <tbody>
        ${payRows.map(row=>`<tr>
          <td>${row.workerName}</td>
          <td style="font-size:8pt">${row.wi?.employeeId||'—'}</td>
          <td>${row.skillLevel||row.wi?.trade||'—'}</td>
          <td class="right">${fE(row.gross)}</td>
          <td class="right">${fE(row.totalDed)}</td>
          <td class="right" style="font-weight:700">${fE(row.net)}</td>
          <td style="font-size:8pt">${row.wi?.payMethod||'Cash'}</td>
        </tr>`).join('')}
        <tr class="total"><td colspan="3">TOTALS</td>
          <td class="right">${fE(payRows.reduce((s,r)=>s+r.gross,0))}</td>
          <td class="right">${fE(payRows.reduce((s,r)=>s+r.totalDed,0))}</td>
          <td class="right">${fE(payRows.reduce((s,r)=>s+r.net,0))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:4mm;background:#f5f5f5;padding:5mm;border-radius:3px;display:flex;gap:15mm">
      <div><div class="lbl">Total Gross</div><div style="font-size:14pt;font-weight:900">${fE(payRows.reduce((s,r)=>s+r.gross,0))}</div></div>
      <div><div class="lbl">Total Deductions</div><div style="font-size:14pt;font-weight:700;color:#c00">${fE(payRows.reduce((s,r)=>s+r.totalDed,0))}</div></div>
      <div><div class="lbl">Total Net Pay</div><div style="font-size:18pt;font-weight:900">${fE(payRows.reduce((s,r)=>s+r.net,0))}</div></div>
    </div>
    <div class="sig">
      <div><div class="lbl">Prepared By (Payroll)</div><div class="sline"></div></div>
      <div><div class="lbl">Approved By (Accounts)</div><div class="sline"></div></div>
      <div><div class="lbl">Authorised By (Director)</div><div class="sline"></div></div>
    </div>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(),600);
  },

  genJournal(id) {
    const r=this._getRecord(id); if(!r) return;
    const proj=DB.getProject(S.project)||{};
    const org=S.org||DB.getOrg(S.user?.orgId)||{};
    const ppObj=(() => { try { return r.payrollSnapshot?JSON.parse(r.payrollSnapshot):{...r}; } catch { return {...r}; }})();
    ppObj.id=ppObj.id||r.periodId;
    const payRows=Payroll.buildRows(ppObj);
    const rs=Payroll.getSettings();
    const totalGross=payRows.reduce((s,r2)=>s+r2.gross,0);
    const totalNet=payRows.reduce((s,r2)=>s+r2.net,0);
    const totalSnpf=payRows.reduce((s,r2)=>s+r2.snpf,0);
    const totalPaye=payRows.reduce((s,r2)=>s+r2.paye,0);
    const totalGT=payRows.reduce((s,r2)=>s+r2.gradedTax,0);
    const totalAdv=payRows.reduce((s,r2)=>s+r2.advance,0);
    const totalOth=payRows.reduce((s,r2)=>s+r2.other,0);
    const totalDed=totalGross-totalNet;
    const snpfEmployer=totalGross*(rs.snpfPct||5)/100; // employer matches SNPF
    const fE=n=>'E '+(n||0).toFixed(2);
    const w=window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Journal Entry</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:9.5pt;padding:15mm}
    h1{font-size:16pt;font-weight:900;margin-bottom:5mm}
    table{width:100%;border-collapse:collapse;margin:5mm 0}th,td{border:1px solid #ccc;padding:2mm 4mm}
    th{background:#e8e8e8}.right{text-align:right}.debit{color:#00aa00}.credit{color:#cc0000}
    .total{font-weight:700;background:#f0f0f0;border-top:2px solid #000}
    @media print{body{padding:8mm}}</style></head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:6mm">
      <div><h1>PAYROLL JOURNAL ENTRY</h1>
        <div>${org.name||''} · ${proj.name||''}</div>
        <div style="font-size:8.5pt;color:#666">Period: ${fmtD(r.openDate)} — ${fmtD(r.closeDate)} · Contract: ${r.contractNo||proj.contractNo||'—'}</div>
      </div>
      <div style="text-align:right;font-size:8.5pt;color:#666">
        <div>Journal Ref: JNL-${r.id?.slice(-6)||''}</div>
        <div>Date: ${new Date().toLocaleDateString('en-ZA')}</div>
        <div>Prepared by: ${S.user?.name||'—'}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Account</th><th>Account Code</th><th>Description</th><th class="right debit">Dr</th><th class="right credit">Cr</th></tr></thead>
      <tbody>
        <tr><td>Labour / Wages Expense</td><td>5100</td><td>Gross wages — ${payRows.length} employees</td><td class="right debit">${fE(totalGross)}</td><td></td></tr>
        <tr><td>SNPF Employer Contribution</td><td>5110</td><td>Employer SNPF @ ${rs.snpfPct}%</td><td class="right debit">${fE(snpfEmployer)}</td><td></td></tr>
        <tr><td>&nbsp;&nbsp;Wages Payable / Cash</td><td>2100</td><td>Net wages payable to employees</td><td></td><td class="right credit">${fE(totalNet)}</td></tr>
        <tr><td>&nbsp;&nbsp;SNPF Employee Payable</td><td>2201</td><td>Employee SNPF deduction</td><td></td><td class="right credit">${fE(totalSnpf)}</td></tr>
        <tr><td>&nbsp;&nbsp;SNPF Employer Payable</td><td>2202</td><td>Employer SNPF contribution</td><td></td><td class="right credit">${fE(snpfEmployer)}</td></tr>
        <tr><td>&nbsp;&nbsp;PAYE Payable</td><td>2210</td><td>Income tax withheld</td><td></td><td class="right credit">${fE(totalPaye)}</td></tr>
        <tr><td>&nbsp;&nbsp;Graded Tax Payable</td><td>2220</td><td>Graded tax withheld</td><td></td><td class="right credit">${fE(totalGT)}</td></tr>
        <tr><td>&nbsp;&nbsp;Salary Advances Recovered</td><td>1610</td><td>Advances offset</td><td></td><td class="right credit">${fE(totalAdv)}</td></tr>
        ${totalOth>0?`<tr><td>&nbsp;&nbsp;Other Deductions Payable</td><td>2290</td><td>Miscellaneous</td><td></td><td class="right credit">${fE(totalOth)}</td></tr>`:''}
        <tr class="total"><td colspan="2">TOTALS</td><td></td>
          <td class="right debit">${fE(totalGross+snpfEmployer)}</td>
          <td class="right credit">${fE(totalGross+snpfEmployer)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:4mm;font-size:9pt;color:#555">
      <b>Note:</b> SNPF total remittance = Employee ${fE(totalSnpf)} + Employer ${fE(snpfEmployer)} = <b>${fE(totalSnpf+snpfEmployer)}</b>
      &nbsp;&nbsp;|&nbsp;&nbsp; PAYE + Graded Tax to SRSC = <b>${fE(totalPaye+totalGT)}</b>
    </div>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(),600);
  },

  exportJournal() {
    const recs=(DB.accRecords||[]).filter(r=>!S.project||r.project===S.project);
    if(!recs.length){ toast('No records to export','info'); return; }
    const rows=[['Journal Ref','Contract No','Period Ref','Open Date','Close Date','Workers','Gross Pay','Total Ded','Net Pay','Status','Paid Date','Payment Ref']];
    recs.forEach(r=>rows.push([
      'JNL-'+(r.id?.slice(-6)||''), r.contractNo||'', r.periodRef||'',
      r.openDate||'', r.closeDate||'', r.workers||0,
      (r.totalGross||0).toFixed(2), ((r.totalGross||0)-(r.totalNet||0)).toFixed(2),
      (r.totalNet||0).toFixed(2), r.status||'', r.paidDate||'', r.paymentRef||''
    ]));
    const csv=rows.map(r=>r.map(v=>JSON.stringify(v)).join(',')).join('\n');
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download='PayrollJournal_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    toast('Journal exported ✅','ok');
  }
};

