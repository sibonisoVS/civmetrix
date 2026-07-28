/* CivMetrix — 02-auth-roles.js
 * App shell, Modal, Auth, roles, permissions, user preferences
 *
 * Part 2 of 7. These files are the original single script split at top-level
 * declaration boundaries — same code, same order, same global scope.
 * They MUST load in numerical order; each is deferred so they run after the DOM.
 */

const App = {
  async reloadProject() {
    if(!S.project || S.isDemo || !S.scriptUrl) { toast('Nothing to reload','info'); return; }
    const btn = ge('btn-reload-project');
    if(btn){ btn.textContent='↻ Reloading…'; btn.disabled=true; }
    try{
      await App.selectProject(S.project);
      toast('Data reloaded ✅','ok');
      if(S.mainTab==='production') Prod.renderSub();
      if(S.mainTab==='dashboard')  Dash.render();
    }catch(e){ toast('Reload failed: '+e.message,'err'); }
    finally{ if(btn){ btn.textContent='↻ Reload'; btn.disabled=false; } }
  },

  setMainTab(tab) {
    if(!S.user) return;
    sessionStorage.setItem('civmetrix_tab', tab);
    const _r = (S.user.role||'').toLowerCase();
    const _fieldRole = /foreman|gang leader|site agent|site admin|site administrat|site supervisor|technician|data.?entry|stores/i.test(_r);
    if(_fieldRole && !['dashboard','production','preferences'].includes(tab)) return;
    S.mainTab = tab;
    qsa('.nav-tab').forEach(el => {
      const _stA = _fieldRole && (S.user?.role||'').toLowerCase().includes('stores assistant');
      if(_fieldRole) el.style.display = (_stA?['production','preferences']:['dashboard','production','preferences']).includes(el.dataset.tab)?'':'none';
      el.classList.toggle('active', el.dataset.tab===tab);
    });
    qsa('.tab-panel').forEach(el => el.classList.toggle('active', el.id==='panel-'+tab));
    // Hide Report sub-tab for Stores Assistant permanently
    if((S.user?.role||'').toLowerCase().includes('stores assistant')) {
      const rpt = ge('sub-tab-report'); if(rpt) rpt.style.display='none';
    }
    if(tab==='payroll') Payroll.render();
    if(tab==='accounting') Accounting.render();
    if(tab==='dashboard')        Dash.render();
    if(tab==='production')       Prod.renderSub();
    if(tab==='organization')     { if(!_canOrgTab()){ toast('You don’t have access to Organization','err'); return; } if(typeof Org!=='undefined') Org.render(); }
    if(tab==='settings-main')    { if(typeof SettingsMain!=='undefined') SettingsMain.render(); }
    if(tab==='role-permissions')  RolePerm.render();
    if(tab==='preferences')       UserPrefs.render();
  },

  showAdminTabs() {
    // Site field roles can use every tab EXCEPT Organization, Settings, Payroll, Accounting, Role Permissions
    const _fieldRole = ['Site Agent','Site Supervisor','Technician','Site Technician'].indexOf(S.user?.role||'')>=0;
    const orgEl  = ge('nav-org');      if(orgEl)  orgEl.style.display  = (!_fieldRole && _canOrgTab()) ? '' : 'none';
    const setEl  = ge('nav-settings'); if(setEl)  setEl.style.display  = (!_fieldRole && _canDo('<span class="material-icons-outlined" aria-hidden="true">settings</span> Settings','view'))      ? '' : 'none';
    const roleEl = ge('nav-roles');    if(roleEl) roleEl.style.display  = (!_fieldRole && _canDo('<span class="material-icons-outlined" aria-hidden="true">lock</span> Role Permissions','any')) ? '' : 'none';
    const payEl  = ge('nav-payroll'); if(payEl)  payEl.style.display   = (!_fieldRole && (_canDo('<span class="material-icons-outlined" aria-hidden="true">schedule</span> Timesheet Records','view')||S.user?.role==='Admin') && PLAN.has('payroll')) ? '' : 'none';
    const accEl  = ge('nav-acc');     if(accEl)  accEl.style.display    = (!_fieldRole && (S.user?.role==='Admin'||S.user?.role==='Editor'||S.user?.role==='Approver') && PLAN.has('accounting')) ? '' : 'none';
    const bnp = ge('btn-new-proj');
    if(bnp){
      if(_canDo('＋ New Project','full')){ bnp.classList.add('show'); bnp.onclick = ()=>Prod.openProjectForm(); }
      else bnp.classList.remove('show');
    }
  },

  updateProjectSel() {
    const userOrgId = S.org?.id || S.user?.orgId || '';
    let projs;
    if(S.user?.role === 'Admin') {
      projs = userOrgId
        ? (DB.projects||[]).filter(p => !p.orgId || p.orgId === userOrgId)
        : (DB.projects||[]);
    } else {
      projs = DB.getUserProjects(S.user?.id);
      if(userOrgId) projs = (projs||[]).filter(p => !p.orgId || p.orgId === userOrgId);
    }
    const sel = ge('proj-sel');
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Select Project —</option>';
    (projs||[]).forEach(p => {
      const o = document.createElement('option');
      o.value = p.code;
      const orgs = DB.organizations||[];
      const org  = DB.getOrg(p.orgId);
      const tag  = (orgs.length > 1 && org) ? ` [${org.name}]` : '';
      o.textContent = `${p.code} · ${p.name||p.code}${tag}`;
      sel.appendChild(o);
    });
    if(prev && (projs||[]).find(p=>p.code===prev)) {
      sel.value = prev;
    } else if((projs||[]).length === 1) {
      sel.value = projs[0].code;
      setTimeout(()=>App.selectProject(projs[0].code), 50);
    }
  },

  async selectProject(code) {
    S.project = code;
    if(code) sessionStorage.setItem('civmetrix_project', code);
    else sessionStorage.removeItem('civmetrix_project');
    if(!code) { if(S.mainTab==='dashboard') Dash.render(); return; }
    const proj = DB.projects.find(p=>p.code===code);
    if(proj?.orgId) S.org = DB.getOrg(proj.orgId) || S.org;
    App.updateOrgCrumb();
    if(!S.isDemo && S.scriptUrl) {
      const ind = ge('db-indicator');
      ind.className = 'db-indicator demo';
      ind.textContent = '⬤ LOADING…';
      // Disable reload during load
      const reloadBtn = ge('btn-reload-project');
      if(reloadBtn) reloadBtn.disabled = true;
      try {
        // Load critical sheets first (fast), rest on-demand when sub-tab opened
        const priority = {
          daily:'DailyRecords', plant:'Plant', boq:'BOQ',
          boqMeasurements:'BOQMeasurements', ipc:'IPC', complexActivities:'ComplexActivities', subContractors:'SubContractors', subContractorBOQ:'SubContractorBOQ', subContractorCosts:'SubContractorCosts',
          plantInventory:'PlantInventory',
          workers:'Workers', foremenTeams:'ForemenTeams',
          management:'Management',
          timesheetEntries:'TimesheetEntries', timesheetPeriods:'TimesheetPeriods',
          pendingTransfers:'PendingTransfers',
          payrollPeriods:'PayrollPeriods', payrollSettings:'PayrollSettings',
          accRecords:'AccRecords',
          costcodes:'CostCodes', activityCodes:'ActivityCodes'
        };
        const secondary = {
          incidents:'Incidents', ncr:'NCR', tbt:'TBT', grn:'GRN', issues:'Issues',
          suppliers:'Suppliers', purchaseOrders:'PurchaseOrders',
          materialUsage:'MaterialUsage',
          documents:'Documents', dailyMeasurements:'DailyMeasurements',
          manualCosts:'ManualCosts',
          budgets:'Budgets',
          fuelIssues:'FuelIssues',
          fuelRecons:'FuelRecons', fuelRequests:'FuelRequests', costingApprovals:'CostingApprovals', documentArchive:'DocumentArchive', userPreferences:'UserPreferences', rateOverrides:'RateOverrides', drawingQtys:'DrawingQuantities', drawingTemplates:'DrawingTemplates',
          timesheets:'Timesheets', ganttTasks:'GanttTasks'
        };
        // Load priority sheets in parallel — each guarded so ONE slow/failed
        // sheet cannot crash the whole load (uses cached data for failures)
        let _failedSheets = [];
        await Promise.all(Object.entries(priority).map(async ([local, remote]) => {
          try {
            const rows = await GAS.get({action:'getData', sheet:remote, project:code});
            GAS.syncCollection(local, rows);
          } catch(e){
            _failedSheets.push(remote);
            console.warn('Priority sheet failed (using cache):', remote, e.message);
          }
        }));
        if(_failedSheets.length){
          ind.className = 'db-indicator demo'; ind.textContent = '⬤ PARTIAL';
          toast(_failedSheets.length+' table(s) slow to load — using cached data. Tap Reload to retry.','info');
        } else {
          ind.className = 'db-indicator live'; ind.textContent = '⬤ LIVE';
          try{ if(window.SB){ SB.flushOutbox(); SB._syncIndicator(); } }catch(e){}
          try{ if(typeof UserPrefs!=='undefined'){ UserPrefs.apply();
            if(!sessionStorage.getItem('cm_landed')){ sessionStorage.setItem('cm_landed','1'); const _lt=UserPrefs.get().landingTab; if(_lt && _lt!=='dashboard' && ge('panel-'+_lt) && typeof App!=='undefined' && App.setMainTab) App.setMainTab(_lt); }
          } }catch(e){}
          try{ if(typeof PLAN!=='undefined' && PLAN.renderBanner) PLAN.renderBanner(); }catch(e){}
        }
        if(reloadBtn) reloadBtn.disabled = false;
        // Load secondary sheets in background (non-blocking), then refresh the
        // current view so panels that use them (Budget, Costing, Materials, SHEQ…)
        // fill in instead of showing empty until you revisit the tab.
        Promise.all(Object.entries(secondary).map(async ([local, remote]) => {
          try {
            const rows = await GAS.get({action:'getData', sheet:remote, project:code});
            GAS.syncCollection(local, rows);
          } catch(e){}
        })).then(()=>{
          try{ if(S.project===code){ DB._applyOverrides(S.project);
            // don't yank the view out from under an open form/dialog
            const _modalOpen=document.querySelector('#modal-bg.open')||document.querySelector('.sf-modal');
            if(!_modalOpen){
              if(S.mainTab==='dashboard') Dash.render();
              else if(S.mainTab==='production') Prod.renderSub();
            }
            Prod._caNag && Prod._caNag();
          } }catch(e){}
        }).catch(()=>{});
        // Transfers load org-wide (project:'') so BOTH the sending and the
        // receiving project see a transfer, regardless of which initiated it.
        GAS.get({action:'getData', sheet:'Transfers', project:''})
          .then(rows=>{ if(Array.isArray(rows)) GAS.syncCollection('transfers', rows); })
          .catch(()=>{});
      } catch(e) {
        ind.className = 'db-indicator demo'; ind.textContent = '⬤ OFFLINE';
        toast('Could not load from Google Sheets — showing cached data','err');
      }
    }
    // Deduplicate ComplexActivities — prefer 'complete' over 'open' for same ID
    // (prevents stale 'open' rows from GAS flush race condition)
    if(S.project && DB.complexActivities) {
      const _caMap = {};
      DB.complexActivities.forEach(ca => {
        if(ca.project !== S.project) return;
        const ex = _caMap[ca.id];
        if(!ex || ca.status === 'complete' || (!ex.completedAt && ca.completedAt))
          _caMap[ca.id] = ca;
      });
      DB.complexActivities = DB.complexActivities
        .filter(ca => ca.project !== S.project)
        .concat(Object.values(_caMap));
    }
    DB._applyOverrides(S.project);
    if(S.mainTab==='dashboard') Dash.render();
    if(S.mainTab==='production') Prod.renderSub();
  },

  updateOrgCrumb() {
    if(!S.org && S.user) {
      S.org = S.user.orgId ? DB.getOrg(S.user.orgId)
            : ((DB.organizations||[]).length===1 ? (DB.organizations||[])[0] : null);
    }
    const org   = S.org;
    const crumb = ge('org-crumb');
    const sep   = ge('org-crumb-sep');
    const name  = ge('org-crumb-name');
    const badge = ge('user-org-badge');
    if(badge){ badge.textContent=org?.name||''; badge.style.display=org?'block':'none'; }
    if(crumb && org){
      crumb.style.display='flex'; crumb.style.opacity='1';
      if(name) name.textContent=org.name;
    } else if(crumb){
      if(S.user?.role==='Admin'||_hasRole('Admin')){
        crumb.style.display='flex'; crumb.style.opacity='0.6';
        if(name) name.textContent='No Org — click to set up';
      } else { crumb.style.display='none'; }
    }
    if(sep) sep.style.display=(org||_hasRole('Admin'))?'inline':'none';
  },
};
try{ window.App = App; }catch(e){}

/* ═══════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════ */
const Modal = {
  open(title, body, buttons = [], opts = {}) {
    ge('modal-title').textContent = title;
    ge('modal-body').innerHTML    = body;
    const _m = ge('modal');
    if(_m) { _m.classList.remove('wide','fullscreen'); if(opts.fullscreen) _m.classList.add('fullscreen'); else if(opts.wide) _m.classList.add('wide'); }
    const ftr = ge('modal-ftr');
    ftr.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className   = `btn ${b.cls||'ghost'}`;
      btn.textContent = b.label;
      if(typeof b.fn === 'function'){
        const label   = b.label || '';
        const hasCommitWord = /save|submit|confirm|post|send|update|create|recruit|register|generate|approve|reject|receive|issue|transfer|pay|run|apply|add\b|✓|💾/i.test(label);
        const hasCancelWord = /cancel|close|back|dismiss|later/i.test(label);
        const isCommit = hasCommitWord || (b.cls && !/ghost/.test(b.cls) && !hasCancelWord);
        btn.onclick = (ev) => {
          if(btn.dataset.busy === '1') return;                 // hard-block accidental double-click
          if(!isCommit){ b.fn(ev); return; }                   // cancel/ghost: run normally
          btn.dataset.busy = '1';
          const orig = btn.textContent;
          btn.classList.add('is-saving');
          btn.textContent = 'Saving…';
          const done = () => {
            if(document.body.contains(btn)){ btn.dataset.busy=''; btn.classList.remove('is-saving'); btn.textContent = orig; }
          };
          // Paint the spinner first, then run the (usually synchronous) save + re-render
          requestAnimationFrame(() => {
            let r; try { r = b.fn(ev); } catch(e){ done(); throw e; }
            if(r && typeof r.then === 'function') r.then(done, done);
            else setTimeout(done, 400);                         // brief lock to swallow a stray second click
          });
        };
      } else {
        btn.onclick = b.fn;
      }
      ftr.appendChild(btn);
    });
    ge('modal-bg').classList.add('open');
    setTimeout(() => {
      const first = ge('modal-body').querySelector('input,select,textarea');
      if (first) first.focus();
    }, 80);
  },
  close() {
    ge('modal-bg').classList.remove('open');
    ge('modal-body').innerHTML = '';
    ge('modal-ftr').innerHTML  = '';
    ge('modal-title').textContent = '';
  },
  isOpen() {
    return ge('modal-bg').classList.contains('open');
  }
};

/* Global save-button guard — blocks accidental double-clicks on commit-style
   buttons everywhere (inline buttons outside the modal system). Runs in the
   capture phase so the first click proceeds and a rapid second one is dropped. */
(function installSaveGuard(){
  const COMMIT = /💾|save|submit|confirm|post\b|send\b|update|generate|approve|reject|receive|recruit|register|create account|sign in|verify|pay run|issue\b/i;
  const SKIP   = /cancel|close|back|dismiss|^add\b|^new\b|^edit|delete|remove|view|export|copy|download|print|reload|refresh|steps|filter|search|select|toggle/i;
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn || btn.disabled) return;
    const label = (btn.textContent || '').trim();
    if(!COMMIT.test(label) || SKIP.test(label)) return;
    const now = Date.now();
    if(btn._cmLast && (now - btn._cmLast) < 900){
      e.preventDefault(); e.stopImmediatePropagation();        // drop the duplicate
      return;
    }
    btn._cmLast = now;
  }, true);
})();

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
const Auth = {
  mode(m) {
    ge('login-form').style.display = m==='login' ? '' : 'none';
    ge('register-form').style.display = m==='register' ? '' : 'none';
    ge('btn-login-mode').classList.toggle('active', m==='login');
    ge('btn-register-mode').classList.toggle('active', m==='register');
    ge('auth-err').classList.remove('show');
    if(m==='register') {
      this._loadOrgSuggestions();
      setTimeout(()=>{
        ge('btn-rg-verify')?.removeEventListener('click', Auth._verifyHandler);
        Auth._verifyHandler = ()=>Auth._verify();
        ge('btn-rg-verify')?.addEventListener('click', Auth._verifyHandler);
      },50);
    }
  },
  err(msg) { const e=ge('auth-err'); e.textContent=msg; e.classList.add('show'); },
  async forgotPassword() {
    if(!window.USE_SUPABASE || !window.SBC){ this.err('Password reset is available on the online (Supabase) version.'); return; }
    let email = (ge('li-email').value||'').trim();
    if(email.indexOf('@')<0) email = (prompt('Enter the email address on your account:')||'').trim();
    if(!email || email.indexOf('@')<0){ this.err('Enter a valid email address to reset your password.'); return; }
    try{
      const r = await window.SBC.auth.resetPasswordForEmail(email, { redirectTo: location.origin+location.pathname });
      if(r.error) throw new Error(r.error.message);
      alert('If an account exists for '+email+', a password-reset link has been sent.\nCheck your inbox (and spam folder), then follow the link back here to set a new password.\n\nStaff who sign in with a username (no email) should ask their company administrator to reset their password.');
    }catch(e){ this.err('Could not send reset email: '+e.message); }
  },
  async forgotUsername() {
    if(!window.USE_SUPABASE || !window.SBC){ this.err('Username lookup is available on the online (Supabase) version.'); return; }
    const emp = (prompt('Account recovery — enter your Employee Number:')||'').trim();
    if(!emp) return;
    const org = (prompt('Enter your Company / Organisation name (exactly as registered):')||'').trim();
    if(!org) return;
    try{
      const r = await window.SBC.rpc('lookup_username', { p_emp:emp, p_org:org });
      if(r.error) throw new Error(r.error.message);
      const d = r.data||{};
      if(d.found){ ge('li-email').value = d.username; this.mode('login'); alert('Your username is:  '+d.username+'\n\nWe\u2019ve filled it in for you — just enter your password to sign in.'); }
      else if(d.reason==='org'){ this.err('Company not found. Check the exact organisation name.'); }
      else { this.err('No registered account found for that Employee Number. You may not have registered yet, or you sign in with an email address.'); }
    }catch(e){ this.err('Lookup failed: '+e.message); }
  },
  setLoading(btn, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? '⏳ Please wait…' : (btn.id==='btn-do-login'?'SIGN IN →':'CREATE ACCOUNT →');
  },
  async login() {
    const identifier = ge('li-email').value.trim();
    const pass       = ge('li-pass').value;
    if(!identifier||!pass) { this.err('Enter username/email and password'); return; }
    if(S.isDemo) {
      const u = DB.users.find(u=>(u.username===identifier||u.email===identifier)&&u.password===pass);
      if(!u) { this.err('Invalid username or password'); return; }
      this.onLogin(u); return;
    }
    const btn = ge('btn-do-login');
    this.setLoading(btn, true);
    try {
      const u = await GAS.get({action:'login', email:identifier, password:pass});
      // Normalise projects FIRST (may be comma-sep string from sheet)
      u.projects = Array.isArray(u.projects)
        ? u.projects
        : (String(u.projects||'')).split(',').map(s=>s.trim()).filter(Boolean);
      // Fetch assigned projects from GAS
      const projs = await GAS.get({action:'getProjects', userId:u.id});
      GAS.syncCollection('projects', projs);
      this.onLogin(u);
    } catch(e) {
      if(e.message==='FIRST_RUN'){
        ge('first-run-banner').style.display='block';
        this.mode('register');
        this.err('No accounts yet. Create the first Admin account below.');
        // Populate org list for datalist
        this._loadOrgSuggestions();
      } else if(e.message==='Invalid credentials'){
        this.err('Invalid username/email or password');
      } else {
        this.err('Connection failed: '+e.message);
      }
    } finally { if(btn){btn.disabled=false;btn.textContent='SIGN IN →';} }
  },
  async _loadOrgSuggestions() {
    if(!S.isDemo && S.scriptUrl){
      try {
        const names = await GAS.get({action:'checkOrgs', name:''});
        const dl = ge('rg-org-list');
        if(dl && Array.isArray(names)) dl.innerHTML = names.map(n=>`<option value="${n}">`).join('');
      } catch(e){}
    }
  },
  async _verify() {
    const empNo = ge('rg-empno').value.trim();
    const org   = ge('rg-company').value.trim();
    if(!empNo||!org){ this.err('Employee No. and Organization are required'); return; }
    const btn = ge('btn-rg-verify');
    if(btn){ btn.disabled=true; btn.textContent='⏳ Checking…'; }
    try {
      // Look up in management or workers by employeeId + org name
      let matched = null;
      if(S.isDemo) {
        const allStaff = [...(DB.management||[]), ...(DB.workers||[])];
        const matchedOrg = (DB.organizations||[]).find(o=>o.name.toLowerCase().trim()===org.toLowerCase().trim());
        if(!matchedOrg){ this.err('Organization "'+org+'" not found — check the exact name'); return; }
        // Match by employeeId — no project restriction (management may span projects)
        matched = allStaff.find(s=>
          String(s.employeeId||'').trim().toLowerCase()===String(empNo).trim().toLowerCase()
          && (s.orgId===matchedOrg.id || !s.orgId)
        );
        if(!matched){ this.err('Employee No. "'+empNo+'" not found — check exact ID shown on your HR record'); return; }
      } else {
        let res = null;
        try {
          res = await GAS.get({action:'verifyEmployee', empNo, organization:org});
        } catch(e) {
          // GAS may be an older version without verifyEmployee — fallback to local DB
          if(!DB.management || !DB.management.length) {
            // Try fetching management data first
            try {
              const mgmtRows = await GAS.get({action:'getData', sheet:'Management', project:''});
              if(Array.isArray(mgmtRows)) { DB.management = mgmtRows; }
              const workerRows = await GAS.get({action:'getData', sheet:'Workers', project:''});
              if(Array.isArray(workerRows)) { DB.workers = (DB.workers||[]).concat(workerRows.filter(w=>!(DB.workers||[]).some(x=>x.id===w.id))); }
            } catch(e2) {}
          }
          // Now try local lookup
          const matchedOrg2 = (DB.organizations||[]).find(o=>o.name.toLowerCase().trim()===org.toLowerCase().trim());
          const allStaff2 = [...(DB.management||[]), ...(DB.workers||[])];
          const localMatch = allStaff2.find(s=>
            String(s.employeeId||'').trim().toLowerCase()===String(empNo).trim().toLowerCase()
            && (!matchedOrg2 || s.orgId===matchedOrg2.id || !s.orgId)
          );
          if(localMatch) {
            res = {found:true, ...localMatch};
          } else {
            this.err('Could not verify — please update your Apps Script and redeploy (verifyEmployee action missing). Then try again.');
            return;
          }
        }
        if(!res||!res.found){ this.err('Employee No. "'+empNo+'" not found in "'+org+'" — check your HR record for the exact Employee No.'); return; }
        matched = res;
      }
      // Store verified data for phase 2
      Auth._verifiedEmp = { empNo, org, name:matched.name||'', role:matched.role||matched.trade||'' };
      ge('rg-phase-1').style.display='none';
      ge('rg-phase-2').style.display='';
      const badge=ge('rg-verified-badge');
      if(badge) badge.innerHTML='✅ Verified: <b>'+matched.name+'</b> · '+matched.role+' · <span style="color:rgba(255,255,255,.6)">Emp No: '+empNo+'</span>';
      if(ge('rg-name')) ge('rg-name').value = matched.name||'';
      this.err('');
    } catch(e) {
      this.err('Verification failed: '+e.message);
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='VERIFY →'; }
    }
  },

  _rgBack() {
    ge('rg-phase-1').style.display='';
    ge('rg-phase-2').style.display='none';
    Auth._verifiedEmp = null;
    this.err('');
  },

  async register() {
    if(!Auth._verifiedEmp){ this.err('Please verify your Employee No. first'); return; }
    const name     = ge('rg-name').value.trim();
    const username = (ge('rg-username').value.trim()).toLowerCase().replace(/[^a-z0-9._-]/g,'');
    const pass     = ge('rg-pass').value;
    const pass2    = ge('rg-pass2')?.value||pass;
    const org      = Auth._verifiedEmp.org;
    const empNo    = Auth._verifiedEmp.empNo;
    if(!name||!username||!pass){ this.err('Name, username and password are required'); return; }
    if(pass!==pass2){ this.err('Passwords do not match'); return; }
    if(pass.length<6){ this.err('Password must be at least 6 characters'); return; }
    if(S.isDemo){
      if(DB.users.find(u=>u.username===username)){ this.err('Username already taken'); return; }
      const matchOrg=(DB.organizations||[]).find(o=>o.name.toLowerCase()===org.toLowerCase());
      if(!matchOrg){ this.err('Organization "'+org+'" not found'); return; }
      const isFirst=!DB.users.length;
      const staffRec = [...(DB.management||[]),...(DB.workers||[])].find(s=>s.employeeId===empNo);
      const roleFromHR = staffRec?.role||staffRec?.trade||'DataEntry';
      const u={id:'u'+uid(),name,username,email:'',password:pass,role:isFirst?'Admin':roleFromHR,company:org,projects:[],orgId:matchOrg.id,employeeId:empNo};
      DB.users.push(u);
      Auth._verifiedEmp = null;
      ['rg-empno','rg-company','rg-name','rg-username','rg-pass','rg-pass2'].forEach(id=>{
        const el=ge(id); if(el) el.value='';
      });
      if(ge('rg-phase-1'))       ge('rg-phase-1').style.display='';
      if(ge('rg-phase-2'))       ge('rg-phase-2').style.display='none';
      if(ge('rg-verified-badge'))ge('rg-verified-badge').innerHTML='';
      toast('Account created ✅ — please sign in','ok');
      this.mode('login');
      ge('li-email').value=username;
      this.err('');
      return;
    }
    const btn=ge('btn-do-register');
    this.setLoading(btn,true);
    try {
      const u=await GAS.post({action:'register',name,username,email:'',password:pass,organization:org,employeeId:empNo});
      ge('first-run-banner').style.display='none';
      // Full reset — ready for next registrant
      Auth._verifiedEmp = null;
      ['rg-empno','rg-company','rg-name','rg-username','rg-pass','rg-pass2'].forEach(id=>{
        const el=ge(id); if(el) el.value='';
      });
      if(ge('rg-phase-1'))       ge('rg-phase-1').style.display='';
      if(ge('rg-phase-2'))       ge('rg-phase-2').style.display='none';
      if(ge('rg-verified-badge'))ge('rg-verified-badge').innerHTML='';
      toast('Account created ✅ — please sign in','ok');
      // Go to Sign In with username pre-filled
      this.mode('login');
      ge('li-email').value = username; // pre-fill username for convenience
      this.err(''); // clear errors
      // Show success message in login form
      const successDiv=ge('auth-err')||document.createElement('div');
      successDiv.style.cssText='background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 14px;color:#4ade80;font-size:12px;margin-top:8px';
      successDiv.textContent='✅ Account created! Sign in with your username and password.';
      successDiv.id='reg-success-msg';
      const existing=ge('reg-success-msg');
      if(existing) existing.remove();
      ge('login-form').appendChild(successDiv);
      setTimeout(()=>{ const el=ge('reg-success-msg'); if(el) el.remove(); }, 5000);
    } catch(e){
      this.err(e.message||'Registration failed');
    } finally { if(btn){btn.disabled=false;btn.textContent='CREATE ACCOUNT →';} }
  },
  async onLogin(u) {
    S.user = u;
    S.org  = null; // will be resolved after orgs load from GAS
    sessionStorage.setItem('civmetrix_session', JSON.stringify(u));
    if(!S.isDemo && !S._isRestore) DB.clearForLive();

    // ── Header basics (show immediately while data loads) ──────────────────
    ge('u-avatar').textContent = u.name.charAt(0).toUpperCase();
    ge('u-name').textContent   = u.name.split(' ')[0];

    const ind = ge('db-indicator');
    ind.className = 'db-indicator ' + (S.isDemo ? 'demo' : 'live');
    ind.textContent = S.isDemo ? '⬤ DEMO' : '⬤ LIVE';

    // + New Project button visibility deferred to showAdminTabs (uses _canDo)
    const bnp = ge('btn-new-proj');
    if(bnp) bnp.classList.remove('show'); // showAdminTabs will set it correctly

    Screen.show('app');
    // For Stores Assistant and all assistant roles — skip dashboard entirely
    const _loginRole = (u.role||'').toLowerCase();
    const _isAsstOnLogin = ['stores assistant','foreman assistant','sheq assistant',
                            'plant assistant','data entry assistant'].includes(_loginRole);
    const _prevTab = _isAsstOnLogin ? 'production'
                   : S._isRestore ? sessionStorage.getItem('civmetrix_tab')||'dashboard'
                   : 'dashboard';
    App.setMainTab(_prevTab);
    // First: reset ALL tabs to visible so a previous field-role session doesn't bleed through
    qsa('.nav-tab').forEach(el => { el.style.display = ''; });
    // Then apply permission-based visibility
    App.showAdminTabs();
    requestAnimationFrame(()=>{ if(typeof Prod!=='undefined') Prod._wrapTabLabels(); });
    // Role-based access: restrict field roles to limited tabs
    (()=>{
      const _rl = (S.user.role||'').toLowerCase();
      const isFieldRole = /foreman|gang leader|site admin|site administrat|site supervisor|technician|sheq|stores|data.?entry/i.test(_rl);
      if(isFieldRole){
        qsa('.nav-tab').forEach(el=>{
          const _asst2=['stores assistant','foreman assistant','sheq assistant','plant assistant','data entry assistant'];
        const _isAsstRole=_asst2.includes((S.user.role||'').toLowerCase());
        el.style.display=(_isAsstRole?['production']:['dashboard','production']).includes(el.dataset.tab)?'':'none';
        });
        const _subMap = {
          'foreman':'input','gang leader':'input',
          'site admin':'site-admin','site administrator':'site-admin',
          'site supervisor':'site-admin',
          'technician':'analysis','site technician':'analysis',
          'sheq':'sheq','sheq officer':'sheq',
          'stores':'stores',
          'foreman assistant':'input'
        };
        const _defaultSub = Object.entries(_subMap).find(([r]) => _rl.includes(r))?.[1] || 'input';
        setTimeout(()=>Prod.setTab(_defaultSub), 200);
      }
    })();

    // ── Load orgs + projects (async — org crumb updates when done) ─────────
    await this.loadProjects();
    // Ensure project selector reflects loaded data
    App.updateProjectSel();

    // ── Access gate: non-Admin must belong to an org (checked AFTER load) ──
    if(!S.org && u.role !== 'Admin' && u.role !== 'Platform') {
      Screen.show('auth');
      const errDiv = ge('login-form');
      if(errDiv) {
        const errMsg = document.createElement('div');
        errMsg.style.cssText='background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:14px;color:var(--red);font-size:13px;margin-top:12px;line-height:1.5';
        errMsg.innerHTML=`<b>🔒 No Organization Assigned</b><br>Your account (<em>${u.email}</em>) is not assigned to any organization.<br>Ask your Administrator to assign you.`;
        const existing = errDiv.querySelector('.org-gate-err');
        if(existing) existing.remove();
        errMsg.className='org-gate-err'; errDiv.appendChild(errMsg);
      }
      return;
    }

    if(u.role==='Platform' && window.PA){ setTimeout(function(){ try{ PA.open(); }catch(e){} }, 400); }

    // ── Org badge under user name ──────────────────────────────────────────
    const badge = ge('user-org-badge');
    if(badge){ badge.textContent=S.org?.name||''; badge.style.display=S.org?'block':'none'; }
    App.updateOrgCrumb();
    if(S.mainTab==='dashboard') Dash.render();
  },
  async loadProjects() {
    // ── Multi-tenant isolation: if a DIFFERENT organization is now using this
    //    device (e.g. the app is rented/shared), wipe the previous org's cached
    //    Document Control branding so it can't bleed across tenants. ────────────
    try {
      const _curOrg = (typeof _orgId==='function' ? _orgId() : '') || (S.user&&S.user.orgId) || '';
      if(_curOrg) {
        const _prevOrg = localStorage.getItem('cm_active_org') || '';
        if(_prevOrg && _prevOrg !== _curOrg) {
          ['reportSettings','dc_settings'].forEach(k=>{ try{ localStorage.removeItem(k); }catch(_){} });
        }
        localStorage.setItem('cm_active_org', _curOrg);
      }
    } catch(_){}
    if(!S.isDemo && S.scriptUrl) {
      try {
        // ── Fetch Organizations FIRST so org crumb resolves correctly ─────────
        const orgs = await GAS.get({action:'getData', sheet:'Organizations', project:''});
        if(Array.isArray(orgs) && orgs.length) {
          DB.organizations = orgs;
          // Mirror the org logo into local ReportSettings so EVERY user's reports
          // pick it up (admins set it once; everyone else loads it here).
          try {
            const _o0 = orgs[0];
            if(_o0 && (_o0.logo || _o0.clientLogo)) {
              const _rs = ReportSettings.get();
              if(_o0.logo) _rs.logo = _o0.logo;
              if(_o0.clientLogo) _rs.clientLogo = _o0.clientLogo;
              localStorage.setItem('reportSettings', JSON.stringify(_rs));
            }
          } catch(_){}
        }
      } catch(e) { /* orgs may not exist yet on first run */ }

      try {
        // ── Global app settings (logos, theme, company details, Document Control) ──
        const _setRows = await GAS.get({action:'getData', sheet:'AppSettings', project:''});
        if(Array.isArray(_setRows)) {
          _setRows.forEach(r=>{
            if(!r || !r.key) return;
            try {
              const val = r.value ? JSON.parse(r.value) : null;
              if(val===null || typeof val!=='object') return;
              if(r.key==='reportSettings'){
                // MERGE with local — never let a blank remote value wipe a good local one
                let local={};
                try{ local=JSON.parse(localStorage.getItem('reportSettings')||'{}'); }catch(_){}
                const merged=Object.assign({}, local);
                Object.keys(val).forEach(k=>{
                  const rv=val[k];
                  // skip empty strings so a blank remote logo/field can't erase a local one
                  if(rv===''||rv===null||rv===undefined) return;
                  merged[k]=rv;
                });
                localStorage.setItem('reportSettings', JSON.stringify(merged));
              } else if(r.key==='dc_settings'){
                let localDc={};
                try{ localDc=JSON.parse(localStorage.getItem('dc_settings')||'{}'); }catch(_){}
                const mergedDc=Object.assign({}, localDc);
                Object.keys(val).forEach(docId=>{
                  const remote=val[docId]||{};
                  const loc=mergedDc[docId]||{};
                  const m2=Object.assign({}, loc);
                  Object.keys(remote).forEach(k=>{ const rv=remote[k]; if(rv===''||rv===null||rv===undefined) return; m2[k]=rv; });
                  mergedDc[docId]=m2;
                });
                localStorage.setItem('dc_settings', JSON.stringify(mergedDc));
              }
            } catch(_){}
          });
        }
      } catch(e) { /* AppSettings may not exist yet — run initSheets */ }

      try {
        // Fetch org-level cost code templates (no project filter)
        const tpls = await GAS.get({action:'getData', sheet:'CostCodeTemplates', project:''});
        if(Array.isArray(tpls) && tpls.length) DB.costcodeTemplates = tpls;
      } catch(e) { /* ignore */ }

      try {
        // Fetch Management staff (org-wide, project="" to get all)
        const mgmt = await GAS.get({action:'getData', sheet:'Management', project:''});
        if(Array.isArray(mgmt) && mgmt.length) {
          if(!DB.management) DB.management = [];
          // Merge: add records not already in memory
          const existIds = new Set((DB.management||[]).map(m=>m.id));
          mgmt.forEach(m=>{ if(!existIds.has(m.id)) DB.management.push(m); });
        }
      } catch(e) { /* ignore */ }

      try {
        const projs = await GAS.get({action:'getProjects', userId: S.user.id});
        GAS.syncCollection('projects', projs);
      } catch(e) {
        toast('Could not load projects from database: ' + e.message, 'err');
      }
      try {
        const usrs = await GAS.get({action:'getData', sheet:'Users', project:''});
        if(Array.isArray(usrs)) GAS.syncCollection('users', usrs);
      } catch(e) { /* ignore */ }
      try {
        // getPermissions returns sheet data OR seeds defaults if sheet empty
        const orgId = S.user?.orgId || '';
        const rp = await GAS.get({action:'getPermissions', orgId});
        if(Array.isArray(rp) && rp.length) DB.rolePermissions = rp;
      } catch(e) { /* ignore */ }
    }

    // ── Resolve S.org ──────────────────────────────────────────────────────
    if(!S.org && S.user?.orgId)              S.org = DB.getOrg(S.user.orgId);
    if(!S.org && (DB.organizations||[]).length===1) S.org = DB.organizations[0];

    // ── Auto-assign orgId to any project or user missing it ────────────────
    // If only 1 org exists, silently stamp it on everything that lacks it.
    // If multiple orgs exist, use S.org as the default for items missing orgId.
    const defaultOrg = S.org || (DB.organizations||[])[0];
    if(defaultOrg) {
      let needsSave = false;
      DB.projects.forEach(p => {
        if(!p.orgId) { p.orgId = defaultOrg.id; needsSave = true; }
      });
      DB.users.forEach(u => {
        if(!u.orgId) { u.orgId = u.role==='Admin' ? (S.user?.orgId||defaultOrg.id) : defaultOrg.id; needsSave = true; }
      });
      // Persist the auto-assignments back to GAS silently
      // Guard: only save users/projects that came FROM GAS (have a gasLoaded flag
      // or simply check we're live and records aren't the hardcoded demo ids)
      const demoIds = ['u1','u2','u3','PRJ-001','PRJ-002'];
      if(needsSave && !S.isDemo && S.scriptUrl) {
        DB.projects.filter(p => !demoIds.includes(p.code)).forEach(p => {
          GAS.post({action:'save', sheet:'Projects', record:p}).catch(()=>{});
        });
        DB.users.filter(u => !demoIds.includes(u.id)).forEach(u => {
          GAS.post({action:'save', sheet:'Users', record:{...u, projects:(u.projects||[]).join ? (u.projects||[]).join(',') : (u.projects||'')}}).catch(()=>{});
        });
      }
    }
    App.updateOrgCrumb();

    App.updateProjectSel();
    // Restore previously selected project on page refresh
    const _savedProj = sessionStorage.getItem('civmetrix_project');
    if(_savedProj && !S.project) {
      const _projExists = DB.projects.find(p => p.code === _savedProj);
      if(_projExists) {
        S.project = _savedProj;
        const _proj = DB.getProject(_savedProj);
        if(_proj?.orgId) S.org = DB.getOrg(_proj.orgId) || S.org;
        const _sel = ge('proj-select');
        if(_sel) _sel.value = _savedProj;
        if(typeof App.updateOrgCrumb === 'function') App.updateOrgCrumb();
      }
    }
    if(S.mainTab==='dashboard') Dash.render();
    if(S.mainTab==='production') Prod.renderSub();
  },

  confirmLogout() {
    const name = (S.user && (S.user.name||S.user.username)) ? (', '+(S.user.name||S.user.username)) : '';
    Modal.open('Sign out?',
      `<div style="font-size:13px;color:var(--text2);line-height:1.6">Are you sure you want to sign out${name}?<br><span style="font-size:11px;color:var(--text3)">You'll need to log in again to continue.</span></div>`,
      [
        {label:'⏻ Sign out',cls:'amber',fn:()=>{ Modal.close(); Auth.logout(); }},
        {label:'Stay signed in',cls:'ghost',fn:Modal.close.bind(Modal)}
      ]);
  },

  logout() {
    if(window.USE_SUPABASE && window.SB) SB.signOut();
    S.user = null; S.project = null; S.org = null;
    sessionStorage.removeItem('civmetrix_session');
    sessionStorage.removeItem('civmetrix_project');
    sessionStorage.removeItem('civmetrix_tab');
    // Clear form fields
    ['li-email','li-pass','rg-name','rg-username','rg-pass','rg-company']
      .forEach(id => { const el = ge(id); if(el) el.value = ''; });
    // Reset project selector
    const sel = ge('proj-sel');
    if(sel) sel.innerHTML = '<option value="">— Select Project —</option>';
    // Go to Sign In — URL is still saved so no re-setup needed
    Auth.mode('login');
    Screen.show('auth');
  },
};

// Main nav click
qsa('.nav-tab').forEach(el => el.addEventListener('click', () => {
  if(!el.dataset.tab) return;
  App.setMainTab(el.dataset.tab);
}));

// Wire production sub-nav tabs
ge('sub-nav')?.querySelectorAll('.sub-tab').forEach(el => {
  el.addEventListener('click', () => {
    if(!el.dataset.sub) return;
    Prod.setTab(el.dataset.sub);
  });
});

/* ═══════════════════════════════════════════════════
   ROLE PERMISSIONS
═══════════════════════════════════════════════════ */
// ── Role taxonomy ────────────────────────────────────────────────────────────
const ROLES = [
  // Top-level
  'Admin',
  // Editor group
  'Editor', 'Site Agent', 'Site Supervisor', 'Site QS', 'Site Technician', 'Technician',
  // Approver (standalone)
  'Approver',
  // Data Entry group
  'Data Entry', 'Foreman', 'Stores / Procurement', 'Stores Assistant', 'SHEQ Officer', 'Site Admin',
  // Assistant sub-roles (assigned via Site Admin → Assign Assistants)
  'Stores Assistant', 'Foreman Assistant', 'SHEQ Assistant', 'Plant Assistant', 'Data Entry Assistant',
  // Viewer group
  'Viewer', 'Director', 'Contracts Manager', 'Client Representative',
];

// Sub-role → parent base role (inherits parent's permissions; can be overridden per org)
const ROLE_PARENT = {
  // Editor sub-roles
  'Site Agent':             'Editor',
  'Site QS':                'Editor',
  'Site Technician':        'Editor',
  'Site Supervisor':        'Editor',
  'Technician':             'Editor',
  // Data Entry sub-roles
  'Foreman':                'Data Entry',
  'Stores / Procurement':   'Data Entry',
  'Stores Assistant':        'Data Entry',
  'Foreman Assistant':       'Data Entry',
  'SHEQ Assistant':          'Data Entry',
  'Plant Assistant':         'Data Entry',
  'Data Entry Assistant':    'Data Entry',
  'SHEQ Officer':           'Data Entry',
  'Site Admin':             'Data Entry',
  // Viewer sub-roles
  'Director':               'Viewer',
  'Contracts Manager':      'Viewer',
  'Client Representative':  'Viewer',
};

// Base roles = column headers in the permissions matrix
const BASE_ROLES = ['Admin','Editor','Approver','Data Entry','Viewer',
  'Stores Assistant','Foreman Assistant','SHEQ Assistant','Plant Assistant','Data Entry Assistant'];

// Human-readable role descriptions shown in the UI
const ROLE_DESCRIPTIONS = {
  'Admin':                  'Full system control — users, projects, settings',
  'Editor':                 'Create and edit all site records',
  'Site Agent':             'Site management — records, timesheets, teams',
  'Site QS':                'Quantity surveying — BOQ, measurements, costs',
  'Site Technician':        'Technical records — plant, fuel, activity codes',
  'Site Supervisor':        'Site supervision — all site tabs (no admin/finance)',
  'Technician':             'Technical records — all site tabs (no admin/finance)',
  'Approver':               'Review and approve measurements, BOQ periods',
  'Data Entry':             'Enter daily data — records, timesheets',
  'Foreman':                'Record daily attendance and timesheet entries',
  'Stores / Procurement':   'Manage GRN, material issues, stores',
  'SHEQ Officer':           'Safety, health, environment and quality records',
  'Site Admin':             'Administrative records and document management',
  'Viewer':                 'Read-only access to all project data',
  'Director':               'Executive view of project performance',
  'Contracts Manager':      'Contract and BOQ monitoring',
  'Client Representative':  'Client-facing project progress view',
  'Stores Assistant':        'Fuel Disbursements access only',
  'Foreman Assistant':       'Supports foreman — timesheet and daily entries',
  'SHEQ Assistant':          'SHEQ records entry and viewing',
  'Plant Assistant':         'Plant records and inventory access',
  'Data Entry Assistant':    'General data entry — assigned areas only',
};

// Default permission matrix (overridden per-org by admin via RolePermissions sheet)
// Default permission matrix
// Columns: Admin | Editor | Approver | DataEntry | Foreman | Viewer
// Foreman is a Data Entry sub-role but gets its own column for fine-grained control.
// Other sub-roles inherit from their parent's column (see ROLE_PARENT).
const DEFAULT_PERMS = [
  // [category, feature,          Admin,   Editor,  Approver, DataEntry, Foreman, StoresAsst, Viewer]
  ['Tabs','<span class="material-icons-outlined" aria-hidden="true">dashboard</span> Dashboard',         'full',  'full',  'full',   'full',   'full',  'none',  'full'],
  ['Tabs','<span class="material-icons-outlined" aria-hidden="true">factory</span> Production',        'full',  'full',  'full',   'full',   'full',  'full',  'view'],
  ['Tabs','<span class="material-icons-outlined" aria-hidden="true">business</span> Organization',      'full',  'full',  'none',   'none',   'none',  'none',  'none'],
  ['Tabs','<span class="material-icons-outlined" aria-hidden="true">settings</span> Settings',          'full',  'view',  'none',   'none',   'none',  'none',  'none'],
  ['Tabs','<span class="material-icons-outlined" aria-hidden="true">lock</span> Role Permissions',  'full',  'none',  'none',   'none',   'none',  'none',  'none'],
  // Production sub-tabs
  ['Production','Daily Records',          'full','full','view', 'full', 'full', 'none', 'view'],
  ['Production','Measurement Sheets',     'full','full','full', 'full', 'none', 'none', 'view'],
  ['Production','Stores (GRN/Issues)',    'full','full','view', 'full', 'none', 'full', 'view'],
  ['Production','SHEQ',                   'full','full','full', 'full', 'view', 'none', 'view'],
  ['Production','👷 Team Management',     'full','full','view', 'full', 'full', 'none', 'none'],
  ['Production','<span class="material-icons-outlined" aria-hidden="true">precision_manufacturing</span> Plant Inventory',     'full','full','view', 'full', 'view', 'none', 'view'],
  ['Production','⛽ Fuel Management',     'full','full','view', 'full', 'view', 'full', 'view'],
  ['Production','<span class="material-icons-outlined" aria-hidden="true">list</span> Activity Codes',      'full','full','view', 'none', 'view', 'none', 'view'],
  // Team Management
  ['Team Mgmt','<span class="material-icons-outlined" aria-hidden="true">schedule</span> Timesheet Records',    'full','full','full', 'view', 'full', 'none', 'none'],
  ['Team Mgmt','<span class="material-icons-outlined" aria-hidden="true">groups</span> Foremen &amp; Teams',      'full','full','view', 'view', 'full', 'none', 'none'],
  ['Team Mgmt','<span class="material-icons-outlined" aria-hidden="true">engineering</span> Workers Register',     'full','full','view', 'view', 'full', 'none', 'none'],
  // Actions / Buttons
  ['Actions','＋ Recruit Labour',         'full','full','none', 'none', 'none', 'none', 'none'],
  ['Actions','＋ Configure Team',         'full','full','none', 'none', 'none', 'none', 'none'],
  ['Actions','⏱ New Timesheet Entry',    'full','full','full', 'full', 'full', 'none', 'none'],
  ['Actions','🖨 Print Timesheets',       'full','full','full', 'view', 'full', 'none', 'none'],
  ['Actions','＋ Add Daily Record',       'full','full','none', 'full', 'full', 'none', 'none'],
  ['Actions','⊞ Close BOQ Period',       'full','full','full', 'none', 'none', 'none', 'none'],
  ['Actions','＋ New Project',            'full','none','none', 'none', 'none', 'none', 'none'],
  ['Actions','Manage Users / Roles',      'full','view','none', 'none', 'none', 'none', 'none'],
  ['Actions','Import BOQ / Gantt',        'full','full','none', 'none', 'none', 'none', 'none'],
  ['Actions','Delete Records',            'full','none','none', 'none', 'none', 'none', 'none'],
];

// ── Permission helpers ───────────────────────────────────────────────────────
function _getPerms() {
  // Read ONLY from DB.rolePermissions — populated from GAS on login
  // GAS.getPermissions seeds defaults to sheet if empty, so this is always populated
  const orgId = _orgId();
  const map = {};
  (DB.rolePermissions||[])
    .filter(r => !r.orgId || r.orgId === orgId)
    .forEach(r => {
      map[r.feature] = {
        cat:      r.cat      || '',
        feature:  r.feature,
        Admin:    r.Admin    || 'none',
        Editor:   r.Editor   || 'none',
        Approver: r.Approver || 'none',
        DataEntry:r.DataEntry|| 'none',
        Foreman:  r.Foreman  || 'none',
        Viewer:   r.Viewer   || 'none',
      };
    });
  // Fallback only if DB is completely empty (e.g. demo mode or first load race)
  if(!Object.keys(map).length){
    DEFAULT_PERMS.forEach(row=>{
      map[row[1]]={cat:row[0],feature:row[1],
        Admin:row[2],Editor:row[3],Approver:row[4],
        DataEntry:row[5],Foreman:row[6],Viewer:row[7]};
    });
  }
  return map;
}

function _baseRole(role) {
  // Returns the base permission column for a role.
  // 'Foreman' has its own column; other sub-roles inherit from ROLE_PARENT.
  if(role === 'Foreman') return 'Foreman';
  return ROLE_PARENT[role] || role;
}

function _permKey(role) {
  // Maps a role name to the key used in the permission map object.
  // 'Data Entry' → 'DataEntry', 'Stores / Procurement' → 'DataEntry', etc.
  const base = _baseRole(role);
  // Remove spaces and slashes for key lookup
  return base.replace(/[\s\/]+/g,'');
}

function _canDo(feature, level='full') {
  if(!S.user) return false;
  const role = S.user.role || 'Viewer';
  // Stores Assistant uses its own column in DEFAULT_PERMS, not the parent 'Data Entry'
  const _assistantRoles = ['Stores Assistant','Foreman Assistant','SHEQ Assistant','Plant Assistant','Data Entry Assistant'];
  const base = _assistantRoles.includes(role) ? role : (ROLE_PARENT[role] || role);
  const map  = _getPerms();
  const perm = map[feature];
  if(!perm) return true; // unknown feature → allow
  // Map base role to column key (strip spaces/slashes)
  const key = base.replace(/[\s\/]+/g,'');
  const val = perm[key] || perm[base] || 'none';
  if(level==='any')  return val !== 'none';
  if(level==='view') return val === 'view' || val === 'full';
  return val === 'full';
}


function _hasRole(...roles) {
  const r = S.user?.role || '';
  const base = ROLE_PARENT[r] || r;
  return roles.some(t => r === t || base === t);
}

// ── Tab access policy (exact roles, case-insensitive) ──────────────────────
const TRANSFER_ROLES = ['admin','editor','site agent','site admin'];
const ORG_TAB_ROLES  = ['admin','editor','site agent'];
function _canTransfers(){ return TRANSFER_ROLES.includes((S.user?.role||'').toLowerCase()); }
function _canOrgTab(){ return ORG_TAB_ROLES.includes((S.user?.role||'').toLowerCase()); }

function _roleLabel(role) {
  // Returns a user-friendly label with description
  return ROLE_DESCRIPTIONS[role] || role;
}

const UserPrefs = {
  _defaults(){ return {theme:'dark', fontSize:'md', landingTab:'dashboard'}; },
  _rec(){ const uid=S.user&&S.user.id; return (DB.userPreferences||[]).find(p=>p.userId===uid||p.id===uid)||null; },
  get(){
    const r=this._rec();
    return Object.assign(this._defaults(), r?{theme:r.theme||'dark',fontSize:r.fontSize||'md',landingTab:r.landingTab||'dashboard'}:{});
  },
  apply(p){
    p=p||this.get();
    try{
      document.body.classList.toggle('theme-light', p.theme==='light');
      document.body.classList.toggle('font-lg', p.fontSize==='lg');
      document.body.classList.toggle('font-sm', p.fontSize==='sm');
    }catch(e){}
  },
  save(patch){
    const uid=S.user&&S.user.id; if(!uid) return;
    const next=Object.assign({}, this.get(), patch);
    const rec={id:uid, orgId:_orgId(), userId:uid, theme:next.theme, fontSize:next.fontSize, landingTab:next.landingTab, accent:'', extra:'{}', updatedAt:new Date().toISOString()};
    DB.save('userPreferences', rec);
    if(!S.isDemo&&S.scriptUrl) GAS.post({action:'save',sheet:'UserPreferences',record:rec}).catch(()=>{});
    this.apply(next);
  },
  _fieldRole(){ const r=(S.user&&S.user.role||'').toLowerCase(); return /foreman|gang leader|site agent|site admin|site administrat|site supervisor|technician|data.?entry|stores/i.test(r); },
  render(){
    const el=ge('prefs-body'); if(!el) return;
    const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const p=this.get();
    const card=(title,body)=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:14px;max-width:620px">'
      +'<div style="font-weight:700;font-size:13px;margin-bottom:12px">'+title+'</div>'+body+'</div>';
    const seg=(name,cur,opts)=>'<div style="display:flex;gap:8px;flex-wrap:wrap">'+opts.map(o=>
      '<button class="btn '+(o.v===cur?'amber':'ghost')+' sm" style="min-width:90px" onclick="UserPrefs.set(\''+name+'\',\''+o.v+'\')">'+o.label+'</button>').join('')+'</div>';
    // landing tab options depend on role
    const tabs=this._fieldRole()
      ? [{v:'dashboard',label:'Dashboard'},{v:'production',label:'Production'},{v:'preferences',label:'Preferences'}]
      : [{v:'dashboard',label:'Dashboard'},{v:'production',label:'Production'},{v:'payroll',label:'Payroll'},{v:'accounting',label:'Accounting'},{v:'organization',label:'Organization'}];
    el.innerHTML=
      '<div style="max-width:620px">'
      +'<h2 style="font-size:18px;font-weight:800;margin-bottom:4px">Preferences</h2>'
      +'<div style="font-size:12px;color:var(--text2);margin-bottom:18px">These settings are personal to you ('+esc(S.user?.name||S.user?.username||'')+') and are remembered every time you open the app on any device.</div>'
      +card('&#127768; Appearance',
          '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">Theme</div>'+seg('theme',p.theme,[{v:'dark',label:'&#127769; Dark'},{v:'light',label:'&#9728;&#65039; Light'}])
          +'<div style="font-size:12px;color:var(--text2);margin:14px 0 6px">Text size</div>'+seg('fontSize',p.fontSize,[{v:'sm',label:'Small'},{v:'md',label:'Medium'},{v:'lg',label:'Large'}]))
      +card('&#128640; Startup',
          '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">Open this tab when the app starts</div>'+seg('landingTab',p.landingTab,tabs))
      +'<div style="font-size:11px;color:var(--text3);margin-top:4px">Changes apply instantly and save automatically.</div>'
      +'</div>';
  },
  set(key,val){ this.save({[key]:val}); this.render(); }
};

const RolePerm = {
  _dirty: false, // tracks unsaved changes

  render() {
    const body=ge('role-perm-body'); if(!body) return;
    if(S.user?.role!=='Admin'){
      body.innerHTML='<div class="empty"><div class="ico">🔒</div><p>Admin only</p></div>'; return;
    }
    // Fetch latest users for this org (may not be filtered to org yet)
    const orgId=_orgId();
    const allUsers=DB.users||[];
    const users=orgId?allUsers.filter(u=>!u.orgId||u.orgId===orgId):allUsers;
    const permMap=_getPerms();
    const cats=[...new Set(DEFAULT_PERMS.map(r=>r[0]))];
    const pcol={full:'var(--green)',view:'var(--amber)',none:'var(--text3)'};
    const OPTIONS=['full','view','none'];

    body.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:16px;font-weight:700;margin:0"><span class="material-icons-outlined" aria-hidden="true">lock</span> Role Permissions</h2>
          <p style="font-size:12px;color:var(--text2);margin:3px 0 0">Set what each role can see and do. Changes take effect immediately.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost sm" onclick="RolePerm.resetDefaults()">↺ Reset to Defaults</button>
          <button class="btn amber sm" id="btn-save-perms" onclick="RolePerm.savePerms()">💾 Save Permissions</button>
        </div>
      </div>

      <!-- Users in this org -->
      <div class="panel" style="padding:14px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">
          👥 Users (${users.length})
          <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:8px">Assign roles to control access</span>
        </div>
        ${users.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Role Description</th><th>Assign Role</th></tr></thead>
          <tbody>${users.map(u=>`<tr>
            <td class="bold">${u.name}<br><span style="font-size:10px;color:var(--text3);font-weight:400">${u.email||u.username||''}</span></td>
            <td class="mono" style="font-size:11px;color:var(--text2)">${u.username||'—'}</td>
            <td><span style="font-size:11px;padding:2px 8px;border-radius:3px;background:rgba(240,165,0,.12);color:var(--amber);white-space:nowrap">${u.role||'Viewer'}</span></td>
            <td style="font-size:11px;color:var(--text3);max-width:180px">${ROLE_DESCRIPTIONS[u.role||'Viewer']||''}</td>
            <td><select class="fselect" style="font-size:11px;padding:3px 6px;width:140px"
                onchange="RolePerm.changeRole('${u.id}',this.value,this)">
              <optgroup label="─ Base Roles ─" style="font-style:normal">
                <option ${u.role==='Admin'?'selected':''}>Admin</option>
              </optgroup>
              <optgroup label="── Editors">
                ${['Editor','Site Agent','Site Supervisor','Site QS','Site Technician','Technician'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}
              </optgroup>
              <optgroup label="── Approvers">
                <option ${u.role==='Approver'?'selected':''}>Approver</option>
              </optgroup>
              <optgroup label="── Data Entry">
                ${['Data Entry','Foreman','Stores / Procurement','SHEQ Officer','Site Admin'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}
              </optgroup>
              <optgroup label="── Viewers">
                ${['Viewer','Director','Contracts Manager','Client Representative'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}
              </optgroup>
            </select></td>
          </tr>`).join('')}
          </tbody>
        </table></div>` : `<p style="color:var(--text3);font-size:12px">No users found. Users are loaded when a project is selected.</p>`}
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:16px;margin-bottom:14px;font-size:11px;flex-wrap:wrap">
        <span style="color:var(--green)">✅ Full — create, edit, delete</span>
        <span style="color:var(--amber)"><span class="material-icons-outlined" aria-hidden="true">visibility</span> View — read-only</span>
        <span style="color:var(--text3)">— None — hidden</span>
        <span style="color:var(--text3);margin-left:auto;font-style:italic">Sub-roles (e.g. Site Agent) inherit their parent's column unless you set a custom rule</span>
      </div>

      <!-- Permission matrix — columns = base roles + Foreman -->
      ${cats.map(cat=>{
        const rows=DEFAULT_PERMS.filter(r=>r[0]===cat);
        // Display columns: Admin + the 4 base roles + Foreman
        const COLS = ['Admin','Editor','Approver','DataEntry','Foreman','StoresAsst','Viewer'];
        const COL_LABELS = {Admin:'Admin',Editor:'Editor',Approver:'Approver',DataEntry:'Data Entry',Foreman:'Foreman',Viewer:'Viewer'};
        return `<div class="panel" style="padding:14px;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">${cat}</div>
          <div class="tbl-wrap"><table class="tbl" style="font-size:11px">
            <thead><tr>
              <th style="text-align:left;min-width:160px">Feature / Tab</th>
              ${COLS.map(k=>`<th style="min-width:78px;text-align:center">${COL_LABELS[k]}</th>`).join('')}
            </tr></thead>
            <tbody>${rows.map(row=>{
              const pm=permMap[row[1]]||{};
              const cells = COLS.map(k=>{
                  const val=pm[k]||'none';
                  const isAdmin=k==='Admin';
                  const opts = OPTIONS.map(o=>{
                    const lbl = o==='full'?'✅ Full':o==='view'?'<span class="material-icons-outlined" aria-hidden="true">visibility</span> View':'— None';
                    const sel = val===o?' selected':'';
                    return '<option value="'+o+'"'+sel+' style="color:'+pcol[o]+'">'+lbl+'</option>';
                  }).join('');
                  return '<td style="padding:3px;text-align:center">'
                    +'<select class="fselect perm-sel"'
                    +' style="font-size:10px;padding:2px 4px;width:78px;color:'+pcol[val]+';border-color:'+pcol[val]+'30"'
                    +' data-role="'+k+'" data-feature="'+row[1]+'"'
                    +(isAdmin?' disabled title="Admin always has full access"':' onchange="RolePerm._onChange(this)"')
                    +'>'+opts+'</select></td>';
                }).join('');
              return '<tr data-feature="'+row[1]+'">'
                +'<td style="font-weight:500;font-size:12px">'+row[1]+'</td>'
                +cells+'</tr>';
            }).join('')}
            </tbody>
          </table></div>
        </div>`;
      }).join('')}

      <!-- Sub-role reference card -->
      <div class="panel" style="padding:14px;margin-bottom:10px;background:rgba(59,130,246,.03)">
        <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Sub-Role Reference</div>
        <p style="font-size:11px;color:var(--text2);margin-bottom:10px">Sub-roles inherit their parent column's permissions. Assign a sub-role for more specific job titles — no extra configuration needed unless you want to override.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">
          ${Object.entries(ROLE_PARENT).map(([sub,parent])=>`
            <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:var(--surface);border-radius:5px;border:1px solid var(--border)">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${sub}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:1px">${ROLE_DESCRIPTIONS[sub]||''}</div>
              </div>
              <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(240,165,0,.1);color:var(--amber);white-space:nowrap;flex-shrink:0">↑ ${parent}</span>
            </div>`).join('')}
        </div>
      </div>
    `;
    // Bind save button state
    this._dirty=false;
    this._updateSaveBtn();
  },

  _onChange(sel) {
    sel.style.color={full:'var(--green)',view:'var(--amber)',none:'var(--text3)'}[sel.value]||'';
    this._dirty=true;
    this._updateSaveBtn();
  },

  _updateSaveBtn() {
    const btn=ge('btn-save-perms');
    if(btn) btn.textContent=this._dirty?'💾 Save Permissions*':'💾 Save Permissions';
  },

  async savePerms() {
    const orgId=_orgId();
    // Collect all permission rows from the DOM
    const records=[];
    ge('role-perm-body').querySelectorAll('tr[data-feature]').forEach(tr=>{
      const feature=tr.dataset.feature;
      const existingPerm=_getPerms()[feature]||{};
      const rec={id:'RP-'+feature.replace(/[^a-z0-9]/gi,'_').slice(0,20)+'-'+orgId.slice(0,8),
                 orgId, cat:existingPerm.cat||'', feature,
                 updatedBy:S.user?.id||'', updatedAt:new Date().toISOString()};
      tr.querySelectorAll('.perm-sel').forEach(sel=>{
        const rkey = sel.dataset.role; // already the clean key (Admin, Editor, DataEntry, Foreman, Viewer)
        rec[rkey] = sel.value;
      });
      records.push(rec);
    });
    // Save to DB and GAS
    DB.rolePermissions=records;
    if(!S.isDemo&&S.scriptUrl){
      toast('Saving permissions…','info');
      try{
        await Promise.all(records.map(r=>GAS.post({action:'save',sheet:'RolePermissions',record:r})));
        toast('Permissions saved ✅','ok');
      } catch(e){ toast('Save failed: '+e.message,'err'); return; }
    } else {
      toast('Permissions saved (demo) ✅','ok');
    }
    this._dirty=false; this._updateSaveBtn();
    // Refresh any visible tab that depends on permissions
    App.showAdminTabs();
  },

  async resetDefaults() {
    if(!confirm('Reset all permissions to defaults? This will overwrite all saved changes.')) return;
    const orgId = _orgId();
    // Delete existing rows for this org
    const toDelete = (DB.rolePermissions||[]).filter(r=>!r.orgId||r.orgId===orgId);
    DB.rolePermissions = [];
    if(!S.isDemo && S.scriptUrl){
      toast('Resetting…','info');
      await Promise.all(toDelete.map(r=>GAS.post({action:'delete',sheet:'RolePermissions',id:r.id}).catch(()=>{})));
      // Re-fetch: GAS.getPermissions will re-seed since sheet is now empty
      try {
        const fresh = await GAS.get({action:'getPermissions', orgId:orgId});
        if(Array.isArray(fresh)) DB.rolePermissions = fresh;
        toast('Permissions reset to defaults ✅','ok');
      } catch(e){ toast('Reset failed: '+e.message,'err'); return; }
    } else {
      // Demo: rebuild from DEFAULT_PERMS
      DB.rolePermissions = [];
      toast('Permissions reset to defaults ✅','ok');
    }
    App.showAdminTabs();
    this.render();
  },

  async changeRole(userId,newRole,selectEl) {
    const u=(DB.users||[]).find(x=>x.id===userId);
    if(!u){toast('User not found','err');return;}
    if(u.id===S.user?.id&&newRole!=='Admin'){ toast('Cannot demote yourself from Admin','err'); selectEl.value=u.role; return; }
    const old=u.role; u.role=newRole;
    if(!S.isDemo&&S.scriptUrl){
      try{
        await GAS.post({action:'save',sheet:'Users',record:u});
        toast(`${u.name}: ${old} → ${newRole} ✅`,'ok');
      } catch(e){ u.role=old; selectEl.value=old; toast('Save failed: '+e.message,'err'); }
    } else {
      toast(`${u.name}: ${old} → ${newRole} ✅`,'ok');
    }
  }
};

/* ═══════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════ */
