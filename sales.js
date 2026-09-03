// ══════════════════════════════════════════
// SALES MODULE — Enquiry + Quotation
// Built session: 25 Jul 2026, rebuilt from a live reverse-engineered Q-Pro
// spec (qpro.almarayadecor.com). Replaces an earlier version of this module
// that was described in a handoff brief but never actually landed in this
// repo.
//
// Single file covering both Enquiry and Quotation screens (rather than
// splitting per the old handoff's enquiry.js/quotation.js split) because the
// two are one continuous flow in the live system — Quotation only exists as
// a conversion off an Enquiry, never standalone. Reads/writes customers[],
// enquiries[], quotations[] and their helper functions in data.js.
//
// Creates its own #sales-module-wrap dynamically, same pattern as
// storekeeper.js — no HTML paste-in needed for the module shell itself.
// ══════════════════════════════════════════

const salesStyleTag = document.createElement('style');
salesStyleTag.textContent = `
#sales-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#sales-module-wrap .ops-header{background:var(--biz-purple);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#sales-module-wrap .sales-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#sales-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#sales-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#sales-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-purple);}
#sales-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#sales-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#sales-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-pill.draft{background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#sales-module-wrap .sales-pill.confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#sales-module-wrap .sales-pill.closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#sales-module-wrap .sales-pill.stage-sales{background:#ede9fe;color:#5b21b6;}
#sales-module-wrap .sales-pill.stage-estimator{background:#fef3c7;color:#92400e;}
#sales-module-wrap .sales-pill.stage-approver{background:#fee2e2;color:#991b1b;}
#sales-module-wrap .sales-search{width:100%;padding:9px 12px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;margin-bottom:12px;box-sizing:border-box;background:var(--biz-input-bg);font-family:inherit;}
#sales-module-wrap button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s;}
#sales-module-wrap button.primary:hover{background:var(--biz-primary-dark);}
#sales-module-wrap button.secondary{background:var(--biz-card-bg);border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);color:var(--biz-text-muted);font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#sales-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabbtn.active{background:var(--biz-purple);border-color:var(--biz-purple);color:#fff;}
/* Segmented status tabs — Quotation List's Draft/Open/Confirmed/Closed/All,
   pale-fill-per-status like the live Q-Pro segmented control (kept as
   compact pills rather than full-width bars — modernized proportions) */
#sales-module-wrap .sales-status-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#sales-module-wrap .sales-status-tab{font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;border:0;cursor:pointer;font-family:inherit;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-status-tab.st-draft.active{background:var(--biz-draft-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#sales-module-wrap .sales-status-tab.st-open.active{background:var(--biz-open-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#sales-module-wrap .sales-status-tab.st-confirmed.active{background:var(--biz-confirmed-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#sales-module-wrap .sales-status-tab.st-closed.active{background:var(--biz-closed-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-all.active{background:#8a93a6;color:#fff;}
#sales-module-wrap .sales-toptabs{display:flex;gap:0;margin:-16px -18px 16px;background:var(--biz-card-bg);border-bottom:1px solid var(--biz-border-light);overflow-x:auto;-webkit-overflow-scrolling:touch;}
#sales-module-wrap .sales-toptab{flex:none;white-space:nowrap;text-align:center;padding:12px 12px;font-size:13px;font-weight:600;color:var(--biz-text-faint);cursor:pointer;border-bottom:2px solid transparent;}
#sales-module-wrap .sales-toptab.active{color:var(--biz-purple);border-bottom-color:var(--biz-purple);font-weight:700;}
#sales-module-wrap .sales-field{margin-bottom:10px;}
#sales-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#sales-module-wrap .sales-field input, #sales-module-wrap .sales-field select, #sales-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);transition:border-color .12s;}
#sales-module-wrap .sales-field input:focus, #sales-module-wrap .sales-field select:focus, #sales-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-primary);background:var(--biz-card-bg);}
#sales-module-wrap .sales-field textarea{min-height:70px;resize:vertical;}
#sales-module-wrap .sales-banner{background:#fff6e3;color:#92400e;font-size:12px;padding:9px 12px;border-radius:var(--biz-r-sm);margin-bottom:12px;font-weight:600;}
#sales-module-wrap .sales-preview{background:#f4e6ec;border:1px solid #e0c2d0;border-radius:var(--biz-r);padding:12px;margin-bottom:14px;}
#sales-module-wrap .sales-preview p{font-size:12px;margin:2px 0;color:var(--biz-text-muted);}
#sales-module-wrap .sales-preview b{color:var(--biz-text);}
#sales-module-wrap .sales-wizard-steps{display:flex;gap:4px;margin-bottom:16px;}
#sales-module-wrap .sales-wizard-step{flex:1;text-align:center;font-size:10.5px;font-weight:700;padding:8px 4px;border-radius:var(--biz-r-sm);background:var(--biz-input-bg);color:var(--biz-text-faint);}
#sales-module-wrap .sales-wizard-step.active{background:var(--biz-purple);color:#fff;}
#sales-module-wrap .sales-wizard-step.done{background:#f4e6ec;color:var(--biz-primary-dark);}
#sales-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#sales-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#sales-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#sales-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
/* ── Manage Quote record page (10b / 12a, 9 Aug 2026) ─────────────────── */
#sales-module-wrap .qh-head{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;}
#sales-module-wrap .qh-crumb{font-size:11px;color:var(--biz-text-faint);margin-bottom:3px;}
#sales-module-wrap .qh-crumb span{color:var(--biz-primary);cursor:pointer;font-weight:600;}
#sales-module-wrap .qh-title{margin:0;font-size:21px;font-weight:600;letter-spacing:-.01em;color:var(--biz-text);}
#sales-module-wrap .qh-sub{font-size:12px;color:var(--biz-text-muted);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
#sales-module-wrap .qh-money{flex:none;text-align:right;}
#sales-module-wrap .qh-net{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--biz-text);}
#sales-module-wrap .qh-net-sub{font-size:11px;color:var(--biz-text-faint);margin-top:2px;}
#sales-module-wrap .qh-tabs{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--biz-input-bg);
  border:1px solid var(--biz-border-light);margin-bottom:14px;}
#sales-module-wrap .qh-tab{flex:none;padding:7px 14px;border:0;border-radius:8px;font-size:12px;font-weight:600;
  cursor:pointer;background:transparent;color:var(--biz-text-muted);font-family:inherit;}
#sales-module-wrap .qh-tab.on{background:var(--biz-card-bg);color:var(--biz-primary);box-shadow:var(--biz-shadow);}
/* §4 — Confirm is the only filled control on the page. */
#sales-module-wrap .qh-actions{display:flex;gap:9px;align-items:center;flex-wrap:nowrap;margin-bottom:14px;overflow-x:auto;}
#sales-module-wrap .qh-cta{flex:none;padding:10px 18px;border:0;border-radius:var(--biz-r-sm);background:var(--biz-primary);
  color:#fff;font-size:12.5px;font-weight:650;cursor:pointer;font-family:inherit;white-space:nowrap;}
#sales-module-wrap .qh-cta.is-off{background:var(--biz-input-bg);color:var(--biz-text-faint);cursor:default;}
#sales-module-wrap .qh-pill{flex:none;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--biz-border);
  background:transparent;color:var(--biz-text-muted);font-size:11.5px;font-weight:600;cursor:pointer;
  font-family:inherit;white-space:nowrap;}
#sales-module-wrap .qh-pill.on{border-color:var(--biz-primary);color:var(--biz-primary);background:#f7eef3;}
#sales-module-wrap .qh-pill.is-off{opacity:.5;cursor:not-allowed;}
#sales-module-wrap .qh-note{font-size:10.5px;color:var(--biz-text-faint);flex:none;}
#sales-module-wrap .qh-pills{display:flex;gap:8px;flex-wrap:wrap;}
#sales-module-wrap .qh-sheet{border:1px solid var(--biz-primary);border-radius:var(--biz-r);padding:14px;
  background:#f7eef3;margin-bottom:14px;}
#sales-module-wrap .qh-sheet-t{font-size:13px;font-weight:700;color:var(--biz-primary);}
#sales-module-wrap .qh-sheet-d{font-size:11.5px;color:var(--biz-text-muted);margin:4px 0 9px;}
#sales-module-wrap .qh-revs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:9px;}
#sales-module-wrap .qh-rev{text-align:left;padding:8px 11px;border-radius:var(--biz-r-sm);border:1px solid var(--biz-border);
  background:var(--biz-card-bg);cursor:pointer;font-family:inherit;font-size:11px;color:var(--biz-text-muted);}
#sales-module-wrap .qh-rev.on{border-color:var(--biz-primary);color:var(--biz-primary);}
#sales-module-wrap .qh-rev b{display:block;font-size:12px;color:var(--biz-text);}
#sales-module-wrap .qh-rev span{display:block;font-variant-numeric:tabular-nums;margin-top:2px;}
#sales-module-wrap .qh-card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;}
#sales-module-wrap .qh-link{border:0;background:none;color:var(--biz-primary);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;}
#sales-module-wrap .qh-valid.is-due{border-color:var(--warn,#b54708);}
#sales-module-wrap .qh-valid.is-closed{border-color:var(--biz-border);background:var(--biz-input-bg);}
#sales-module-wrap .qh-trail{display:flex;gap:14px;flex-wrap:wrap;}
#sales-module-wrap .qh-step{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--biz-text-faint);font-weight:600;}
#sales-module-wrap .qh-step i{width:8px;height:8px;border-radius:99px;background:var(--biz-border);display:block;}
#sales-module-wrap .qh-step.on{color:var(--biz-primary);}
#sales-module-wrap .qh-step.on i{background:var(--biz-primary);}
#sales-module-wrap .qh-grow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--biz-border-light);cursor:pointer;}
#sales-module-wrap .qh-gn{flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--biz-text);}
#sales-module-wrap .qh-gc{font-size:11px;color:var(--biz-text-faint);}
#sales-module-wrap .qh-gv{font-size:12px;font-variant-numeric:tabular-nums;color:var(--biz-text);}
/* §5 — the 300-line quote */
#sales-module-wrap .qh-items{display:flex;gap:14px;align-items:flex-start;}
#sales-module-wrap .qh-rail{flex:none;width:190px;position:sticky;top:0;max-height:70vh;overflow-y:auto;
  display:flex;flex-direction:column;gap:4px;}
#sales-module-wrap .qh-rail-b{text-align:left;padding:7px 9px;border-radius:var(--biz-r-sm);border:1px solid var(--biz-border-light);
  background:var(--biz-card-bg);cursor:pointer;font-family:inherit;font-size:11.5px;color:var(--biz-text-muted);}
#sales-module-wrap .qh-rail-b.on{border-color:var(--biz-primary);color:var(--biz-primary);}
#sales-module-wrap .qh-rail-b i{display:block;font-style:normal;font-size:10px;color:var(--biz-text-faint);margin-top:2px;}
#sales-module-wrap .qh-items-main{flex:1;min-width:0;}
#sales-module-wrap .qh-items-h{display:flex;gap:8px;align-items:center;margin-bottom:9px;flex-wrap:wrap;}
#sales-module-wrap .qh-table{width:100%;border-collapse:collapse;font-size:12px;}
#sales-module-wrap .qh-table thead th{position:sticky;top:0;z-index:2;background:var(--biz-input-bg);
  padding:7px 6px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  color:var(--biz-text-faint);border-bottom:1px solid var(--biz-border);}
#sales-module-wrap .qh-table td{padding:9px 6px;border-bottom:1px solid var(--biz-border-light);vertical-align:top;}
#sales-module-wrap .qh-table.is-compact td{padding:5px 6px;}
#sales-module-wrap .qh-table .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
#sales-module-wrap .qh-band td{position:sticky;top:29px;z-index:1;background:var(--biz-input-bg);cursor:pointer;
  text-align:center;font-weight:700;font-size:12px;color:var(--biz-text);}
#sales-module-wrap .qh-band td b{font-weight:600;color:var(--biz-text-muted);font-size:11px;margin-left:10px;}
#sales-module-wrap .qh-sl{font-size:10.5px;color:var(--biz-text-faint);font-variant-numeric:tabular-nums;}
#sales-module-wrap .qh-nm{display:block;font-weight:600;color:var(--biz-text);}
#sales-module-wrap .qh-spec{display:block;font-size:10.5px;color:var(--biz-text-faint);margin-top:2px;}
#sales-module-wrap .qh-disc{color:var(--warn,#b54708);}
/* Fixed cell so row heights — and therefore print break points — stay predictable. */
#sales-module-wrap .qh-ph{width:66px;height:50px;object-fit:cover;border-radius:5px;margin-top:5px;display:block;}
#sales-module-wrap .qh-ph.is-none{width:66px;height:50px;border:1px dashed var(--biz-border);border-radius:5px;
  display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--biz-text-faint);margin-top:5px;}
#sales-module-wrap .qh-more{text-align:center;padding:9px;}
#sales-module-wrap .qh-more button{border:1px solid var(--biz-border);background:transparent;border-radius:999px;
  padding:5px 13px;font-size:11px;color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#sales-module-wrap .qh-foot{display:flex;gap:18px;justify-content:flex-end;padding:11px 6px;font-size:12px;
  color:var(--biz-text-muted);font-variant-numeric:tabular-nums;flex-wrap:wrap;}
#sales-module-wrap .qh-foot b{color:var(--biz-text);}
#sales-module-wrap .qh-hrow{display:flex;gap:12px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--biz-border-light);font-size:11.5px;}
#sales-module-wrap .qh-hrow span{flex:none;width:96px;color:var(--biz-text-faint);}
#sales-module-wrap .qh-hrow b{flex:1;min-width:0;font-weight:600;color:var(--biz-text);}
#sales-module-wrap .qh-hrow i{flex:none;font-style:normal;color:var(--biz-text-faint);}
#sales-module-wrap .qh-hrow.is-pending{opacity:.65;}
#sales-module-wrap .qh-hrow.is-pending b::after{content:' · scheduled';color:var(--biz-text-faint);font-weight:400;}
#sales-module-wrap .qh-bottom{display:none;}
/* §10 — phone. The primary action lives under the thumb, because Sales works
   this screen standing in a client's lobby. */
@media (max-width:880px){
  #sales-module-wrap .qh-head{flex-direction:column;gap:8px;}
  #sales-module-wrap .qh-money{text-align:left;}
  #sales-module-wrap .qh-items{flex-direction:column;}
  #sales-module-wrap .qh-rail{width:100%;position:static;max-height:none;flex-direction:row;overflow-x:auto;}
  #sales-module-wrap .qh-rail-b{flex:none;}
  #sales-module-wrap .qh-actions{display:none;}
  #sales-module-wrap .qh-bottom{position:fixed;left:0;right:0;bottom:0;z-index:120;display:flex;gap:9px;
    padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:var(--biz-card-bg);
    border-top:1px solid var(--biz-border);}
  #sales-module-wrap .qh-bottom .qh-cta{flex:1;min-height:44px;}
  #sales-module-wrap .qh-bottom .qh-pill{min-width:44px;min-height:44px;}
  #sales-module-wrap .sales-scroll{padding-bottom:132px;}
}
#sales-module-wrap .qh-morerow{display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);background:var(--biz-card-bg);cursor:pointer;font-family:inherit;min-height:44px;}
#sales-module-wrap .qh-morerow b{display:block;font-size:12.5px;color:var(--biz-text);}
#sales-module-wrap .qh-morerow i{display:block;font-style:normal;font-size:11px;color:var(--biz-text-faint);margin-top:2px;}
#sales-module-wrap .sales-locked{background:var(--biz-border-light) !important;color:var(--biz-text-faint) !important;}
#sales-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
#sales-module-wrap .sales-tile{border:0;border-radius:var(--biz-r);padding:14px 10px;text-align:center;font-size:11.5px;font-weight:700;color:#fff;cursor:pointer;box-shadow:var(--biz-shadow);transition:transform .12s,box-shadow .12s;text-transform:uppercase;letter-spacing:.2px;}
#sales-module-wrap .sales-tile:hover{transform:translateY(-2px);box-shadow:0 12px 28px 0 rgba(37,37,42,.14);}
#sales-module-wrap .sales-tile .sales-tile-icon{font-size:18px;display:block;margin-bottom:6px;}
#sales-module-wrap .sales-tile.t-blue{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-purple{background:linear-gradient(135deg,var(--biz-purple),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-teal{background:linear-gradient(135deg,var(--biz-teal),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-magenta{background:linear-gradient(135deg,var(--biz-magenta),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-amber{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-cyan{background:linear-gradient(135deg,var(--biz-cyan),var(--biz-primary2));}
#sales-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
`;
document.head.appendChild(salesStyleTag);

// ── Module shell ──
const salesModuleWrap = document.createElement('div');
salesModuleWrap.id = 'sales-module-wrap';
salesModuleWrap.style.cssText = 'display:none;';
salesModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">💼</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Sales</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Enquiry → Quotation</div>
      </div>
    </div>
    <button onclick="closeSalesModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="sales-scroll">
    <div id="sales-body"></div>
  </div>
`;
document.body.appendChild(salesModuleWrap);

// ── State ──
let salesTopView = 'enquiries';        // 'enquiries' | 'quotations' | 'reports'
let salesView = 'enq-list';            // enq-list | enq-create | enq-detail | cust-create | qtn-list | qtn-hub | qtn-wizard | qtn-register
let salesActiveEnquiryId = null;
let salesActiveQtnId = null;
let salesActiveEnqTab = 'basic';       // basic | followup
let salesWizardStep = 1;
let salesEnqFilters = { from: '', to: '', customer: '', salesPerson: '', unassigned: false, unattended: false, unquoted: false };
let salesQtnFilters = { qtnNo: '', customer: '', project: '', tel: '', salesPerson: '', stage: '' };
let salesQtnListTab = 'all';           // draft | open | confirmed | closed | all
let salesQtnRegFilters = { from: '', to: '', salesPerson: '', status: 'All' };
let salesDraft = null;                 // scratch object for create forms
let salesEditingLineId = null;         // which item's inline edit panel is open on Wizard Step 2
// Whose book this is. A real cloud session is authoritative; the simulated
// name below is the offline fallback the e2e suites run on, and the value the
// module starts with before anyone has signed in.
let salesCurrentUser = STAFF.find(s => s !== 'Operations') || STAFF[0];
function salesIdentity() {
  if (typeof window !== 'undefined' && window.__realCloudSession && window.cloudIdentity) return window.cloudIdentity;
  return salesCurrentUser;
}

function salesAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('sales-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sales-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

function esc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

// ── Module open/close ──
function openSalesModule() {
  // Resolve the identity on open rather than at load: at load nobody has
  // signed in yet, and every ownership check below depends on this being the
  // real person.
  salesCurrentUser = salesIdentity();
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'prd-module-wrap', 'uph-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  salesModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  salesTopView = 'dashboard';
  salesView = 'dashboard';
  execEnsureShell(salesModuleWrap, { key: 'sales', title: 'Sales', role: 'Sales', navGroupsFn: EXEC_NAV_CONFIGS.sales, closeFn: 'closeSalesModule' });
  renderSalesBody();
}
function closeSalesModule() { closeModuleWrap(salesModuleWrap, 'launchEnquiryModule'); }
function launchEnquiryModule() { openSalesModule(); }
function launchSalesModule() { openSalesModule(); }

const SALES_TOPVIEW_DEFAULTS = {
  dashboard: 'dashboard', enquiries: 'enq-list', quotations: 'qtn-list', reports: 'qtn-register', myjobs: 'my-jobs'
};
function salesSetTopView(v) {
  salesTopView = v;
  salesView = SALES_TOPVIEW_DEFAULTS[v] || 'enq-list';
  renderSalesBody();
}

function renderSalesBody() {
  const body = document.getElementById('sales-body');
  if (!body) return;
  const topTabs = `
    <div class="sales-toptabs">
      <div class="sales-toptab ${salesTopView === 'dashboard' ? 'active' : ''}" onclick="salesSetTopView('dashboard')">Dashboard</div>
      <div class="sales-toptab ${salesTopView === 'enquiries' ? 'active' : ''}" onclick="salesSetTopView('enquiries')">Enquiry</div>
      <div class="sales-toptab ${salesTopView === 'quotations' ? 'active' : ''}" onclick="salesSetTopView('quotations')">Quotation</div>
      <div class="sales-toptab ${salesTopView === 'myjobs' ? 'active' : ''}" onclick="salesSetTopView('myjobs')">My Jobs</div>
      <div class="sales-toptab ${salesTopView === 'reports' ? 'active' : ''}" onclick="salesSetTopView('reports')">Reports</div>
    </div>`;

  let content = '';
  switch (salesView) {
    case 'dashboard': content = renderSalesDashboard(); break;
    case 'enq-list': content = renderEnquiryList(); break;
    case 'enq-create': content = renderEnquiryCreate(); break;
    case 'cust-create': content = renderCustomerCreate(); break;
    case 'enq-detail': content = renderEnquiryDetail(); break;
    case 'qtn-list': content = renderQuotationList(); break;
    case 'qtn-hub': content = renderQuotationHub(); break;
    case 'qtn-wizard': content = renderQuotationWizard(); break;
    case 'qtn-register': content = renderSalesReports(); break;
    case 'my-jobs': content = renderSalesMyJobs(); break;
    default: content = renderEnquiryList();
  }
  body.innerHTML = topTabs + content;
  // The redesigned dashboard (7 Aug 2026 handoff) owns its own root and a
  // single delegated listener, so it mounts rather than being pasted in.
  if (salesView === 'dashboard' && typeof SalesDashboard !== 'undefined') {
    const host = document.getElementById('sales-dashboard-root');
    if (host) SalesDashboard.mount(host);
  }
}

// ══════════════════════════════════════════
// MODULE 1 — ENQUIRY
// ══════════════════════════════════════════

function custName(customerId) {
  const c = customers.find(x => x.id === customerId);
  return c ? c.name : '';
}

function enquiryStatusLabel(e) {
  if (!e.salesPerson) return 'Un Assigned';
  if (e.followUps.length === 0) return 'Un Attended';
  if (!e.linkedQuotationId) return 'Un Quoted';
  return 'Quoted';
}

function enquiryMatchesFilters(e) {
  const f = salesEnqFilters;
  if (f.from && e.dateCreated < f.from) return false;
  if (f.to && e.dateCreated > f.to) return false;
  if (f.customer && !custName(e.customerId).toLowerCase().includes(f.customer.toLowerCase()) && !e.prospectName.toLowerCase().includes(f.customer.toLowerCase())) return false;
  if (f.salesPerson && e.salesPerson !== f.salesPerson) return false;
  if (f.unassigned && e.salesPerson) return false;
  if (f.unattended && e.followUps.length > 0) return false;
  if (f.unquoted && e.linkedQuotationId) return false;
  return true;
}

function salesEnqFilterChanged(key, val) { salesEnqFilters[key] = val; renderSalesBody(); }

function renderEnquiryList() {
  const rows = enquiries.filter(enquiryMatchesFilters)
    .slice().sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));

  const filterHtml = `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>From Date</label><input type="date" value="${salesEnqFilters.from}" onchange="salesEnqFilterChanged('from',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>To Date</label><input type="date" value="${salesEnqFilters.to}" onchange="salesEnqFilterChanged('to',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Customer</label><input type="text" value="${salesEnqFilters.customer}" placeholder="Search customer/prospect" oninput="salesEnqFilterChanged('customer',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Sales Person</label>
          <select onchange="salesEnqFilterChanged('salesPerson',this.value)">
            <option value="">All</option>
            ${STAFF.map(s => `<option value="${s}" ${salesEnqFilters.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;">
        <label><input type="checkbox" ${salesEnqFilters.unassigned ? 'checked' : ''} onchange="salesEnqFilterChanged('unassigned',this.checked)"> Un Assigned</label>
        <label><input type="checkbox" ${salesEnqFilters.unattended ? 'checked' : ''} onchange="salesEnqFilterChanged('unattended',this.checked)"> Un Attended</label>
        <label><input type="checkbox" ${salesEnqFilters.unquoted ? 'checked' : ''} onchange="salesEnqFilterChanged('unquoted',this.checked)"> Un Quoted</label>
      </div>
    </div>
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openEnquiryCreate()">+ Create Enquiry</button>`;

  const listHtml = rows.length === 0
    ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No enquiries match these filters.</p></div>`
    : rows.map(e => `
      <div class="sales-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;cursor:pointer;" onclick="openEnquiryDetail('${e.id}')">
            <p style="font-weight:700;font-size:13px;">${e.id} <span style="font-weight:400;color:#94a3b8;">· ${e.dateCreated}</span></p>
            <p style="font-size:12px;color:#334155;">${esc(e.customerId ? custName(e.customerId) : e.prospectName)}</p>
            <p style="font-size:11px;color:#64748b;">Salesman: ${esc(e.salesPerson) || '—'} · Source: ${esc(e.source)}</p>
          </div>
          <div style="text-align:right;">
            <span class="sales-pill">${enquiryStatusLabel(e)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="secondary" style="flex:1;font-size:11.5px;padding:7px;" onclick="openEnquiryDetail('${e.id}')">Update</button>
          ${canConvertToQuotation(e) && !e.linkedQuotationId ? `<button class="primary" style="flex:1;font-size:11.5px;padding:7px;" onclick="startConvertToQuotation('${e.id}')">Convert Quotation</button>` : ''}
          <button class="secondary" style="flex:1;font-size:11.5px;padding:7px;color:#b91c1c;" onclick="salesCancelEnquiry('${e.id}')">Cancel</button>
        </div>
      </div>`).join('');

  return filterHtml + listHtml;
}

function salesCancelEnquiry(id) {
  if (!window.confirm('Are you sure you want to delete?')) return;
  cancelEnquiry(id);
  salesAlert('Enquiry deleted.');
  renderSalesBody();
}

// ── Create Enquiry ──
function openEnquiryCreate() {
  salesDraft = { division: SALES_DIVISIONS[0], customerId: '', prospectName: '', contactPerson: '', tel: '', email: '', requirements: '', source: ENQUIRY_SOURCES[0], salesPerson: STAFF[0] };
  salesView = 'enq-create';
  renderSalesBody();
}
// Selecting a real existing customer pulls their Telephone in and locks it
// — Salman's call: Sales was previously able to type ANY number for an
// existing customer's enquiry, disconnected from the real customer record.
// Contact Person stays freely editable (a company customer can legitimately
// have different contacts reach out across different enquiries); Tel is
// tied to the customer master. Switching back to "None (new prospect)"
// clears and unlocks it for manual entry.
function salesEnqDraftChanged(key, val) {
  if (!salesDraft) return;
  salesDraft[key] = val;
  if (key === 'customerId') {
    const c = customers.find(x => x.id === val);
    salesDraft.tel = c ? c.tel : '';
  }
  renderSalesBody();
}

function renderEnquiryCreate() {
  const d = salesDraft;
  const c = customers.find(x => x.id === d.customerId);
  const preview = `
    <div class="sales-preview">
      <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Customer preview</p>
      <p><b>Customer Name:</b> ${esc(c ? c.name : '—')}</p>
      <p><b>Telephone:</b> ${esc(c ? c.tel : '—')}</p>
      <p><b>Email:</b> ${esc(c ? c.email : '—')}</p>
      <p><b>Address:</b> ${esc(c ? c.address : '—')}</p>
      <p><b>Contact Person:</b> ${esc(c ? c.contactPerson : '—')}</p>
      <p><b>VAT Name:</b> ${esc(c ? c.vatName : '—')}</p>
      <p><b>VAT No:</b> ${esc(c ? c.vatNo : '—')}</p>
      <p><b>Sales Man:</b> ${esc(c ? c.salesMan : '—')}</p>
    </div>`;

  return `
    <span class="sales-back" onclick="salesView='enq-list';renderSalesBody();">‹ Back to Enquiry List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Create Enquiry</p>
      <div class="sales-field"><label>Division</label>
        <select onchange="salesEnqDraftChanged('division',this.value)">${SALES_DIVISIONS.map(x => `<option value="${x}" ${d.division === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Select Customer</label>
        <select onchange="salesEnqDraftChanged('customerId',this.value)">
          <option value="">— None (new prospect) —</option>
          ${customers.map(c => `<option value="${c.id}" ${d.customerId === c.id ? 'selected' : ''}>${c.name} (${c.id})</option>`).join('')}
        </select>
        <button class="secondary" style="margin-top:6px;font-size:11.5px;padding:6px 10px;" onclick="openCustomerCreate('enq-create')">+ New Customer</button>
      </div>
      ${!d.customerId ? `<div class="sales-field"><label>New Prospect Name</label><input type="text" value="${esc(d.prospectName)}" oninput="salesEnqDraftChanged('prospectName',this.value)"></div>` : ''}
      <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesEnqDraftChanged('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Tel</label><input class="${d.customerId ? 'sales-locked' : ''}" type="text" value="${esc(d.tel)}" ${d.customerId ? 'disabled' : ''} oninput="salesEnqDraftChanged('tel',this.value)"></div>
      ${d.customerId ? `<p style="font-size:10.5px;color:#94a3b8;margin:-6px 0 8px;">Telephone is pulled from the customer record and locked — update it via Customer Update if it's wrong.</p>` : ''}
      <div class="sales-field"><label>Email</label><input type="email" value="${esc(d.email)}" oninput="salesEnqDraftChanged('email',this.value)"></div>
      <div class="sales-field"><label>Requirements</label><textarea oninput="salesEnqDraftChanged('requirements',this.value)">${esc(d.requirements)}</textarea></div>
      <div class="sales-field"><label>Select Source of Enquiry</label>
        <select onchange="salesEnqDraftChanged('source',this.value)">${ENQUIRY_SOURCES.map(x => `<option value="${x}" ${d.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Sales Person Assigned</label>
        <select onchange="salesEnqDraftChanged('salesPerson',this.value)">${STAFF.map(x => `<option value="${x}" ${d.salesPerson === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      ${preview}
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveEnquiryCreate()">Submit</button>
        <button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button>
      </div>
    </div>`;
}

function saveEnquiryCreate() {
  const d = salesDraft;
  if (!d.contactPerson || !d.tel) { salesAlert('Contact Person and Tel are required.'); return; }
  const result = createEnquiry(d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Enquiry ${result.id} created.`);
  salesDraft = null;
  salesView = 'enq-list';
  renderSalesBody();
}

// ── Add Customer ──
// Bank Account Number/Holder Name/IBAN/Swift/Bank Name/Branch used to be
// entered here — moved to Accounts' own "Customer Banking Details" tool
// (Phase 3, 5 Aug 2026, accounts.js) since those fields are now
// restricted to Accounts/Owner at the database level (see
// customer_banking_details in supabase/schema.sql). Not a regression —
// a deliberate real workflow change Salman confirmed.
function openCustomerCreate(returnTo) {
  salesDraft = { _returnTo: returnTo, name: '', contactPerson: '', tel: '', tel2: '', email: '', fax: '', vatName: '', vatNo: '', taxPercent: 0, isCredit: false, creditLimit: 0, creditDays: 0, address: '', crNo: '', country: 'Bahrain', openingBalance: 0, salesMan: STAFF[0] };
  salesView = 'cust-create';
  renderSalesBody();
}
function salesCustDraftChanged(key, val) { if (salesDraft) salesDraft[key] = val; }

function renderCustomerCreate() {
  const d = salesDraft;
  return `
    <span class="sales-back" onclick="salesView=salesDraft._returnTo||'enq-list';renderSalesBody();">‹ Back</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Add Customer</p>
      <div class="sales-field"><label>Name *</label><input type="text" value="${esc(d.name)}" oninput="salesCustDraftChanged('name',this.value)"></div>
      <div class="sales-field"><label>Contact Person *</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesCustDraftChanged('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Telephone *</label><input type="text" value="${esc(d.tel)}" oninput="salesCustDraftChanged('tel',this.value)"></div>
      <div class="sales-field"><label>Telephone 2</label><input type="text" value="${esc(d.tel2)}" oninput="salesCustDraftChanged('tel2',this.value)"></div>
      <div class="sales-field"><label>Email</label><input type="email" value="${esc(d.email)}" oninput="salesCustDraftChanged('email',this.value)"></div>
      <div class="sales-field"><label>Fax</label><input type="text" value="${esc(d.fax)}" oninput="salesCustDraftChanged('fax',this.value)"></div>
      <div class="sales-field"><label>Vat Name</label><input type="text" value="${esc(d.vatName)}" oninput="salesCustDraftChanged('vatName',this.value)"></div>
      <div class="sales-field"><label>Vat No</label><input type="text" value="${esc(d.vatNo)}" oninput="salesCustDraftChanged('vatNo',this.value)"></div>
      <div class="sales-field"><label>Tax %</label>
        <select onchange="salesCustDraftChanged('taxPercent',Number(this.value))">
          ${[0, 5, 10].map(v => `<option value="${v}" ${d.taxPercent === v ? 'selected' : ''}>${v}%</option>`).join('')}
        </select>
      </div>
      <div class="sales-field"><label><input type="checkbox" ${d.isCredit ? 'checked' : ''} onchange="salesCustDraftChanged('isCredit',this.checked)"> Is Credit</label></div>
      <div class="sales-field"><label>Credit Limit</label><input type="number" value="${d.creditLimit}" oninput="salesCustDraftChanged('creditLimit',Number(this.value))"></div>
      <div class="sales-field"><label>Credit Days</label><input type="number" value="${d.creditDays}" oninput="salesCustDraftChanged('creditDays',Number(this.value))"></div>
      <div class="sales-field"><label>Address *</label><textarea oninput="salesCustDraftChanged('address',this.value)">${esc(d.address)}</textarea></div>
      <div class="sales-field"><label>CR No</label><input type="text" value="${esc(d.crNo)}" oninput="salesCustDraftChanged('crNo',this.value)"></div>
      <div class="sales-field"><label>Country</label>
        <select onchange="salesCustDraftChanged('country',this.value)">${COUNTRIES.map(x => `<option value="${x}" ${d.country === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Opening Balance</label><input type="number" value="${d.openingBalance}" oninput="salesCustDraftChanged('openingBalance',Number(this.value))"></div>
      <div class="sales-field"><label>Sales Man</label>
        <select onchange="salesCustDraftChanged('salesMan',this.value)">${STAFF.map(x => `<option value="${x}" ${d.salesMan === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveCustomerCreate()">Save and continue</button>
        <button class="secondary" style="flex:1;" onclick="salesView=salesDraft._returnTo||'enq-list';renderSalesBody();">Exit</button>
      </div>
    </div>`;
}

function saveCustomerCreate() {
  const d = salesDraft;
  const returnTo = d._returnTo;
  const result = createCustomer(d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(result.possibleDuplicateOf
    ? `✓ Customer ${result.id} created — flagged as a possible duplicate of ${result.possibleDuplicateOf} for Accounts to review. You can keep working with it right away.`
    : `✓ Customer ${result.id} created.`);
  if (returnTo === 'enq-create') {
    salesDraft = { division: SALES_DIVISIONS[0], customerId: result.id, prospectName: '', contactPerson: result.contactPerson, tel: result.tel, email: result.email, requirements: '', source: ENQUIRY_SOURCES[0], salesPerson: STAFF[0] };
    salesView = 'enq-create';
  } else {
    salesDraft = null;
    salesView = returnTo || 'enq-list';
  }
  renderSalesBody();
}

// ── Enquiry Detail (Basic / Follow-up tabs) ──
function openEnquiryDetail(id) {
  salesActiveEnquiryId = id;
  salesActiveEnqTab = 'basic';
  salesView = 'enq-detail';
  renderSalesBody();
}
function salesSetEnqTab(t) { salesActiveEnqTab = t; renderSalesBody(); }

function renderEnquiryDetail() {
  const e = enquiries.find(x => x.id === salesActiveEnquiryId);
  if (!e) return `<p style="font-size:12.5px;color:#64748b;">Enquiry not found.</p>`;
  const locked = e.salesPerson !== salesCurrentUser;

  const tabs = `
    <div class="sales-tabs">
      <button class="sales-tabbtn ${salesActiveEnqTab === 'basic' ? 'active' : ''}" onclick="salesSetEnqTab('basic')">Basic</button>
      <button class="sales-tabbtn ${salesActiveEnqTab === 'followup' ? 'active' : ''}" onclick="salesSetEnqTab('followup')">Follow up</button>
    </div>`;

  let tabBody = '';
  if (salesActiveEnqTab === 'basic') {
    tabBody = `
      ${locked ? `<div class="sales-banner">Assigned Sales man can update this Enquiry (assigned to ${esc(e.salesPerson)}).</div>` : ''}
      <div class="sales-field"><label>Division</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.division)}" ${locked ? 'disabled' : `onchange="salesUpdateEnquiryField('division',this.value)"`}></div>
      <div class="sales-field"><label>Customer</label><input class="sales-locked" type="text" value="${esc(e.customerId ? custName(e.customerId) : e.prospectName)}" disabled></div>
      <div class="sales-field"><label>Contact Person</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.contactPerson)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Tel</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.tel)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('tel',this.value)"></div>
      <div class="sales-field"><label>Email</label><input class="${locked ? 'sales-locked' : ''}" type="email" value="${esc(e.email)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('email',this.value)"></div>
      <div class="sales-field"><label>Requirements</label><textarea class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('requirements',this.value)">${esc(e.requirements)}</textarea></div>
      <div class="sales-field"><label>Source of Enquiry</label>
        <select class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('source',this.value)">${ENQUIRY_SOURCES.map(x => `<option value="${x}" ${e.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Sales Person Assigned</label>
        <select class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('salesPerson',this.value)">${STAFF.map(x => `<option value="${x}" ${e.salesPerson === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      ${!locked ? `<div style="display:flex;gap:8px;"><button class="primary" style="flex:1;" onclick="salesAlert('✓ Enquiry updated.')">Submit</button><button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button></div>` : ''}
    `;
  } else {
    const historyHtml = e.followUps.length === 0
      ? `<p style="font-size:12.5px;color:#64748b;margin-bottom:12px;">No follow-ups logged yet.</p>`
      : `<table class="sales-items"><tr><th>Date</th><th>Meeting Type</th><th>Outcome</th><th></th></tr>` +
        e.followUps.map((f, i) => `<tr><td>${f.date}</td><td>${esc(f.meetingType)}</td><td>${esc(f.outcome)}</td><td title="${esc(f.notes)}" style="cursor:help;">👁</td></tr>`).join('') +
        `</table>`;

    const canConvert = canConvertToQuotation(e) && !e.linkedQuotationId && e.followUps.length > 0;

    tabBody = `
      ${historyHtml}
      <div class="sales-card" style="padding:12px;">
        <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Follow-up</p>
        <div class="sales-field"><label>Date of Appointment</label><input type="date" id="fu-date" value="${todayISO()}"></div>
        <div class="sales-field"><label>Meeting Type</label><select id="fu-type">${MEETING_TYPES.map(x => `<option value="${x}">${x}</option>`).join('')}</select></div>
        <div class="sales-field"><label>Outcome</label><select id="fu-outcome">${FOLLOWUP_OUTCOMES.map(x => `<option value="${x}">${x}</option>`).join('')}</select></div>
        <div class="sales-field"><label>Notes (min 10 characters)</label><textarea id="fu-notes"></textarea></div>
        <div style="display:flex;gap:8px;">
          <button class="primary" style="flex:1;" onclick="saveFollowUp()">Submit</button>
          <button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button>
        </div>
      </div>
      ${e.linkedQuotationId ? `<button class="primary" style="width:100%;margin-top:10px;" onclick="openQuotationHub('${e.linkedQuotationId}')">View Quotation ${e.linkedQuotationId} →</button>`
        : canConvert ? `<button class="primary" style="width:100%;margin-top:10px;" onclick="startConvertToQuotation('${e.id}')">Convert Quotation</button>` : ''}
    `;
  }

  return `<span class="sales-back" onclick="salesView='enq-list';renderSalesBody();">‹ Back to Enquiry List</span>
    <p style="font-weight:700;font-size:14px;margin-bottom:6px;">${e.id}</p>
    ${tabs}<div class="sales-card">${tabBody}</div>`;
}

function salesUpdateEnquiryField(key, val) {
  const e = enquiries.find(x => x.id === salesActiveEnquiryId);
  if (e) e[key] = val;
}

function salesUpdateQtnField(key, val) {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  if (q) q[key] = val;
}

function saveFollowUp() {
  const date = document.getElementById('fu-date').value;
  const meetingType = document.getElementById('fu-type').value;
  const outcome = document.getElementById('fu-outcome').value;
  const notes = document.getElementById('fu-notes').value;
  const result = addFollowUp(salesActiveEnquiryId, { date, meetingType, outcome, notes });
  if (result.error) { salesAlert(result.error); return; }
  salesAlert('✓ Follow-up added.');
  renderSalesBody();
}

// ══════════════════════════════════════════
// MODULE 2 — QUOTATION
// ══════════════════════════════════════════

function startConvertToQuotation(enquiryId) {
  const enq = enquiries.find(e => e.id === enquiryId);
  if (!enq) return;
  if (!canConvertToQuotation(enq)) { salesAlert('Please Select Customer To Proceed!!!'); return; }
  salesDraft = { enquiryId, projectName: '', taxPercent: 10, contactPerson: enq.contactPerson, notes: '' };
  salesWizardStep = 1;
  salesActiveQtnId = null;
  salesView = 'qtn-wizard';
  renderSalesBody();
}

function quotationMatchesFilters(q) {
  const f = salesQtnFilters;
  if (f.qtnNo && !q.id.toLowerCase().includes(f.qtnNo.toLowerCase())) return false;
  if (f.customer && !custName(q.customerId).toLowerCase().includes(f.customer.toLowerCase())) return false;
  if (f.project && !q.projectName.toLowerCase().includes(f.project.toLowerCase())) return false;
  if (f.salesPerson) {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    if (!enq || enq.salesPerson !== f.salesPerson) return false;
  }
  if (f.tel) {
    const c = customers.find(x => x.id === q.customerId);
    if (!c || !c.tel.includes(f.tel)) return false;
  }
  return true;
}

// Session 5: a KPI tile lands on exactly the rows it counted — set the
// lifecycle tab and the stage filter together, then show the list.
function salesShowQuotations(tab, stage) {
  salesQtnListTab = tab || 'all';
  salesQtnFilters.stage = stage || '';
  salesSetTopView('quotations');
}
function salesQtnFilterChanged(key, val) { salesQtnFilters[key] = val; renderSalesBody(); }
function salesSetQtnListTab(t) { salesQtnListTab = t; renderSalesBody(); }

function renderQuotationList() {
  const tabs = ['draft', 'open', 'confirmed', 'closed', 'all'];
  const rows = quotations.filter(quotationMatchesFilters)
    .filter(q => salesQtnListTab === 'all' || q.lifecycleStatus === salesQtnListTab)
    .filter(q => !salesQtnFilters.stage || q.stage === salesQtnFilters.stage)
    .slice().sort((a, b) => b.date.localeCompare(a.date));

  const tabsHtml = `<div class="sales-status-tabs">${tabs.map(t => `<button class="sales-status-tab st-${t} ${salesQtnListTab === t ? 'active' : ''}" onclick="salesSetQtnListTab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>`;

  const filterHtml = `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Qtn No</label><input type="text" value="${salesQtnFilters.qtnNo}" oninput="salesQtnFilterChanged('qtnNo',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Customer</label><input type="text" value="${salesQtnFilters.customer}" oninput="salesQtnFilterChanged('customer',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Project</label><input type="text" value="${salesQtnFilters.project}" oninput="salesQtnFilterChanged('project',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Tel No</label><input type="text" value="${salesQtnFilters.tel}" oninput="salesQtnFilterChanged('tel',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Sales Person</label>
          <select onchange="salesQtnFilterChanged('salesPerson',this.value)">
            <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${salesQtnFilters.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="sales-field" style="margin-bottom:0;"><label>Currently With</label>
          <select onchange="salesQtnFilterChanged('stage',this.value)">
            ${[['', 'Anyone'], ['sales', 'Sales'], ['estimator', 'Estimator'], ['approver', 'Approver']]
              .map(([v, l]) => `<option value="${v}" ${salesQtnFilters.stage === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;

  const listHtml = rows.length === 0
    ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No quotations in this view. Quotations can only be created by converting an Enquiry.</p></div>`
    : rows.map(q => {
      const totals = computeQuotationTotals(q);
      const enq = enquiries.find(e => e.id === q.enquiryId);
      return `
      <div class="sales-card" style="cursor:pointer;" onclick="openQuotationHub('${q.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-weight:700;font-size:13px;">${q.id} <span style="font-weight:400;color:#94a3b8;">· ${q.date}</span></p>
            <p style="font-size:12px;color:#334155;">${esc(custName(q.customerId))} · ${esc(q.projectName)}</p>
            <p style="font-size:11px;color:#64748b;">Salesman: ${esc(enq ? enq.salesPerson : '—')} · Amt: BD ${totals.netTotal.toFixed(3)}</p>
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
            <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span>
            <span class="sales-pill stage-${q.stage}">${q.stage.toUpperCase()}</span>
          </div>
        </div>
      </div>`;
    }).join('');

  return tabsHtml + filterHtml + listHtml;
}

// Same shape as jobsLockedTile() (jobs.js) — the tile keeps its colour, icon
// and label, dims, and its click becomes the explanation rather than the
// action. A greyed control that still says what it is beats a missing one
// here: the user is meant to understand WHY this quote can't be edited.
function salesLockedTile(cls, icon, label, reason) {
  const safe = String(reason).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<div class="sales-tile ${cls}" style="opacity:.5;cursor:not-allowed;" onclick="salesAlert('${safe}')"><span class="sales-tile-icon">${icon}</span>${label}</div>`;
}

// ── Manage Quote hub ──
function openQuotationHub(id) {
  if (typeof execSetCrumb === 'function') setTimeout(() => execSetCrumb(id), 0);
  salesActiveQtnId = id;
  salesTopView = 'quotations';
  salesView = 'qtn-hub';
  renderSalesBody();
  if (typeof execRefreshNavGroups === 'function') execRefreshNavGroups();
}

// ══════════════════════════════════════════
// MANAGE QUOTE — record page (design package 10b/12a, 9 Aug 2026)
//
// Replaces four gradient tiles (two of which existed only to refuse), three
// cards that rendered only to report absence, and a flat item table that
// disagreed with the grouped printed sheet about what the quote contains.
// ══════════════════════════════════════════
let qhTab = 'record';            // record | items | document | history
let qhSheet = null;              // null | edit | print | revision | duplicate
let qhCopyFrom = null;           // which revision the sheet copies from
let qhCollapsed = {};            // group name -> true when closed
let qhDensity = 'full';          // full | compact
let qhPhotos = false;            // photos are OFF until asked for — see §5
let qhWindow = {};               // group name -> how many lines are rendered

function qhSetTab(t) { qhTab = t; qhSheet = null; renderSalesBody(); if (typeof execRefreshNavGroups === 'function') execRefreshNavGroups(); }
function qhToggleSheet(k) { qhSheet = qhSheet === k ? null : k; qhCopyFrom = null; renderSalesBody(); }
function qhSetDensity(d) { qhDensity = d; renderSalesBody(); }
function qhTogglePhotos() { qhPhotos = !qhPhotos; renderSalesBody(); }
function qhToggleGroup(g) { qhCollapsed[g] = !qhCollapsed[g]; renderSalesBody(); }
function qhAllGroups(open) {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  qhGroupsOf(q).forEach(g => { qhCollapsed[g.name] = !open; });
  renderSalesBody();
}
function qhScrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof execCloseSideOnMobile === 'function') execCloseSideOnMobile();
}
function qhScrollToGroup(g) {
  qhCollapsed[g] = false;
  renderSalesBody();
  setTimeout(() => {
    const el = document.getElementById('qh-g-' + qhSlug(g));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 30);
}
function qhSlug(t) { return String(t).replace(/[^a-z0-9]+/gi, '-').toLowerCase(); }
function qhMore(g) { qhWindow[g] = (qhWindow[g] || QH_PAGE) + QH_PAGE; renderSalesBody(); }
const QH_PAGE = 60;              // windowed rendering — first 60 lines per open group

// Quantities are 2 dp, money 3. prFmtPlain() prints 6.000 Nos of curtain.
function qhQty(n) { return (Number(n) || 0).toFixed(2); }
function qhBD(n) { return 'BD ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
function qhDate(iso) {
  if (!iso) return '—';
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? String(iso) : `${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ONE hierarchy, shared with buildQuotationPrintHTML() — the screen and the
// paper were disagreeing about what the quote contains.
function qhGroupsOf(q) {
  if (!q) return [];
  const rows = typeof computeQuoteHierarchy === 'function' ? computeQuoteHierarchy(q.items || []) : [];
  const out = [];
  rows.forEach(r => {
    const name = (r.item.group || 'Ungrouped');
    let g = out.find(x => x.name === name);
    if (!g) { g = { name, rows: [], total: 0 }; out.push(g); }
    g.rows.push(r);
    g.total += Number(r.item.netAmount) || 0;
  });
  return out;
}

function renderQuotationHub() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;
  const totals = computeQuotationTotals(q);
  const c = customers.find(x => x.id === q.customerId);
  const lock = typeof quotationLock === 'function' ? quotationLock(q) : null;
  const expired = typeof quoteIsExpired === 'function' && quoteIsExpired(q);

  const tab = (k, label) =>
    `<button class="qh-tab${qhTab === k ? ' on' : ''}" onclick="qhSetTab('${k}')">${label}</button>`;

  return `
    <div class="qh-head">
      <div style="flex:1;min-width:0;">
        <div class="qh-crumb"><span onclick="salesView='qtn-list';renderSalesBody();">Quotations</span> / ${esc(q.id)}</div>
        <h2 class="qh-title">${esc(q.projectName)}</h2>
        <div class="qh-sub">${esc(c ? c.name : '—')}
          <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus.toUpperCase()} · REV ${q.rev || 0}</span></div>
      </div>
      <!-- The money appears ONCE on this page, large. The three other places
           the hub used to print an amount are gone. -->
      <div class="qh-money">
        <div class="qh-net">${qhBD(totals.netTotal)}</div>
        <div class="qh-net-sub">incl. VAT ${qhBD(totals.vatTotal)}${totals.discTotal ? ' · after discount ' + qhBD(totals.discTotal) : ''}</div>
      </div>
    </div>
    <div class="qh-tabs">${tab('record','Record')}${tab('items','Items')}${tab('document','Document')}${tab('history','History')}</div>
    ${lock ? `<div class="sales-banner">${esc(lock.reason)}</div>` : ''}
    ${qhTab === 'record' ? qhRecordTab(q, totals, c, lock, expired)
      : qhTab === 'items' ? qhItemsTab(q, totals, lock)
      : qhTab === 'document' ? qhDocumentTab(q)
      : qhHistoryTab(q)}
    ${qhBottomBar(q, lock)}`;
}

// ── Record tab ───────────────────────────────────────────────────────────
function qhRecordTab(q, totals, c, lock, expired) {
  const groups = qhGroupsOf(q);
  return `
    ${qhValidityCard(q, expired)}
    ${qhActionRow(q, lock)}
    ${qhSheet ? qhSheetHTML(q, lock) : ''}
    <div class="sales-card" id="qh-summary">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Where it is</p>
      <div class="qh-trail">${['Enquiry','Quotation','Costing','Approval','Confirmed'].map((st, i) => {
        const reached = [true, true, q.stage !== 'sales' || q.lifecycleStatus !== 'draft',
          q.lifecycleStatus === 'open' || q.lifecycleStatus === 'confirmed', q.lifecycleStatus === 'confirmed'][i];
        return `<span class="qh-step${reached ? ' on' : ''}"><i></i>${st}</span>`;
      }).join('')}</div>
    </div>
    <div class="sales-card">
      <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">Groups (${groups.length})</p>
        <button class="qh-link" onclick="qhSetTab('items')">All ${(q.items || []).length} lines ›</button></div>
      ${groups.length ? groups.map(g => `<div class="qh-grow" onclick="qhSetTab('items')">
        <span class="qh-gn">${esc(g.name)}</span>
        <span class="qh-gc">${g.rows.length} line${g.rows.length === 1 ? '' : 's'}</span>
        <span class="qh-gv">${qhBD(g.total)}</span></div>`).join('')
        : '<p style="font-size:11.5px;color:#94a3b8;">No lines yet.</p>'}
    </div>
    ${qhFollowUpCard(q)}
    ${qhLinkedCard(q)}`;
}

// §7 — validity, auto-close, and the way back.
function qhValidityCard(q, expired) {
  if (q.lifecycleStatus === 'confirmed') return '';
  const until = quoteValidUntil(q);
  const left = quoteDaysLeft(q);
  if (q.lifecycleStatus === 'closed') {
    const canReinstate = typeof quoteCanReinstate === 'function' && quoteCanReinstate(q);
    return `<div class="sales-card qh-valid is-closed">
      <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">Closed — ${q.closedReason === 'expired' ? 'expired' : esc(q.closedReason || 'closed')} ${qhDate(q.closedDate)}</p></div>
      <p style="font-size:11.5px;color:var(--biz-text-muted);margin:4px 0 9px;">Client came back? A closed quote never silently switches back on at old prices.</p>
      <div class="qh-pills">
        ${canReinstate ? `<button class="qh-pill" onclick="qhReinstate('${q.id}')">Reinstate as it stands</button>`
          : `<span class="qh-pill is-off" title="Only within 30 days of closing">Reinstate (over 30 days)</span>`}
        <button class="qh-pill" onclick="qhRecost('${q.id}')">Re-date and re-cost into a new revision</button>
        <button class="qh-pill" onclick="qhCloseForGood('${q.id}')">Close it for good</button>
      </div>
    </div>`;
  }
  return `<div class="sales-card qh-valid${left !== null && left <= 1 ? ' is-due' : ''}">
    <div class="qh-card-h">
      <p style="font-weight:700;font-size:13px;">Valid until ${qhDate(until)}</p>
      <span style="font-size:11px;color:${left !== null && left <= 1 ? 'var(--bad,#b42318)' : 'var(--biz-text-muted)'};">
        ${left === null ? '' : left < 0 ? 'overdue' : left === 0 ? 'Auto-closes tonight' : left === 1 ? 'Auto-closes tomorrow' : left + ' days left'}</span>
    </div>
    <p style="font-size:11px;color:var(--biz-text-faint);margin-top:3px;">Clause 4 of the printed terms promises ${QUOTE_VALID_DAYS} days. This closes itself at 23:59 on the date above.</p>
    <div class="qh-pills" style="margin-top:9px;">
      <button class="qh-pill" onclick="qhExtend('${q.id}')">Extend 7 days</button>
      <button class="qh-pill" onclick="qhMarkLost('${q.id}')">Mark lost</button>
    </div>
  </div>`;
}

// §4 — Confirm is the ONLY filled control on the page.
function qhActionRow(q, lock) {
  const canConfirm = q.stage === 'sales' && q.lifecycleStatus === 'open';
  // A DRAFT at the Sales stage has one forward move: send it to the Estimator.
  // The redesign's single CTA has to carry that too, or a draft has no way out.
  const canTransfer = q.stage === 'sales' && q.lifecycleStatus === 'draft';
  const pill = (k, label) => `<button class="qh-pill${qhSheet === k ? ' on' : ''}" onclick="qhToggleSheet('${k}')">${label}</button>`;
  // A confirmed quote is frozen (quotationLock). GREYED, not hidden — Salman's
  // ask, and right here: the capability exists, it is this quote that is closed.
  const dead = (label, reason) => `<button class="qh-pill is-off" onclick="salesAlert('${String(reason).replace(/'/g, "\'")}')">${label}</button>`;
  return `<div class="qh-actions">
    ${canTransfer
      ? `<button class="qh-cta" onclick="salesTransferToEstimator('${q.id}')">Transfer to Estimator</button>`
      : canConfirm
      ? `<button class="qh-cta" onclick="${q.parentJobId ? `salesConfirmVariation('${q.id}')` : `salesConfirmQuote('${q.id}')`}">${q.parentJobId ? 'Confirm variation → merge into Job' : 'Confirm quote → open Job Card'}</button>`
      : `<span class="qh-cta is-off">${q.lifecycleStatus === 'confirmed' ? 'Confirmed' : q.stage !== 'sales' ? 'With the ' + (q.stage === 'estimator' ? 'Estimator' : 'Approver') : 'Awaiting approval'}</span>`}
    <span style="flex:1;"></span>
    <!-- Two pre-existing gates the redesign must not drop: Edit only while the
         quote is at the Sales stage (it belongs to whoever holds it), and Print
         only once the Approver has approved it. -->
    ${lock ? dead('Edit quote', lock.reason) : (q.stage === 'sales' ? pill('edit', 'Edit quote') : '')}
    ${q.lifecycleStatus !== 'draft' ? pill('print', 'Print / send') : ''}
    ${lock ? dead('Raise revision', lock.reason) : pill('revision', 'Raise revision')}
    ${pill('duplicate', 'Duplicate')}
    ${q.stage !== 'sales' && !lock ? `<span class="qh-note">Edit quote is locked while this is with the ${q.stage === 'estimator' ? 'Estimator' : 'Approver'} — it reopens once they send it back to Sales.</span>` : ''}
  </div>`;
}

// Inline sheets — on this page, not a tab jump and not a modal.
function qhSheetHTML(q, lock) {
  if (qhSheet === 'more') {
    // Phone: one sheet, each row with a line of description.
    const row = (label, desc, on) => `<button class="qh-morerow" onclick="${on}"><b>${label}</b><i>${desc}</i></button>`;
    return `<div class="qh-sheet">
      <p class="qh-sheet-t">More</p>
      ${lock ? '' : row('Edit quote', 'Change lines, quantities and discount', `qhToggleSheet('edit')`)}
      ${row('Print / send', 'A4 with photographs, bank block and terms', `qhToggleSheet('print')`)}
      ${lock ? '' : row('Raise revision', 'Copy this quote forward as a new revision', `qhToggleSheet('revision')`)}
      ${row('Duplicate', 'Start a new quotation from this one', `qhToggleSheet('duplicate')`)}
      ${row('Mark lost', 'Close it with a reason and drop it from follow-up', `qhMarkLost('${q.id}')`)}
    </div>`;
  }
  if (qhSheet === 'edit') {
    return `<div class="qh-sheet">
      <p class="qh-sheet-t">Edit lines</p>
      <p class="qh-sheet-d">Rates stay with the Estimator. Discount above the approved cap routes to the Approver.</p>
      <div class="qh-pills"><button class="qh-pill on" onclick="qhSheet=null;openQuotationWizard('${q.id}',2)">Open the item editor</button>
        <button class="qh-pill" onclick="qhToggleSheet('edit')">Cancel</button></div>
    </div>`;
  }
  if (qhSheet === 'print') {
    return `<div class="qh-sheet">
      <p class="qh-sheet-t">Print / send</p>
      <p class="qh-sheet-d">Valid until ${qhDate(quoteValidUntil(q))} prints on the meta grid, where the client sees it.</p>
      <div class="qh-pills">
        <button class="qh-pill on" onclick="openPrintDialog('${q.id}',false)">Open print dialog</button>
        <button class="qh-pill" onclick="salesAlert('Email delivery is not wired to a mail service yet — download the PDF and send it from your own mail.')">Email PDF</button>
      </div>
    </div>`;
  }
  if (qhSheet === 'revision' || qhSheet === 'duplicate') {
    const fam = quoteFamily(q.id);
    const from = qhCopyFrom || q.id;
    const src = quotations.find(x => x.id === from) || q;
    const nextRev = nextRevSuffix(q.id);
    const isDup = qhSheet === 'duplicate';
    return `<div class="qh-sheet">
      <p class="qh-sheet-t">${isDup ? 'Duplicate' : 'Raise revision'}</p>
      <p class="qh-sheet-d">Copy from — the newest revision is not always the one the client agreed to.</p>
      <div class="qh-revs">${fam.map(r => {
        const t = computeQuotationTotals(r);
        return `<button class="qh-rev${from === r.id ? ' on' : ''}" onclick="qhCopyFrom='${r.id}';renderSalesBody()">
          <b>rev ${r.rev}</b> ${r.id === q.id ? '· current' : r.supersededBy ? '· superseded' : ''} ${qhDate(r.date)}
          <span>${qhBD(t.netTotal)}</span></button>`;
      }).join('')}</div>
      <p class="qh-sheet-d">${isDup ? `Creates a new quotation, copying rev ${src.rev} at today's rates.`
        : `Create rev ${nextRev} from rev ${src.rev}. Rev ${src.rev} stays on file and stays printable.`}</p>
      <div class="qh-pills">
        <button class="qh-pill on" onclick="${isDup ? `qhDuplicateFrom('${from}')` : `qhRaiseRevision('${from}')`}">
          ${isDup ? 'Create a new quotation' : `Create rev ${nextRev} from rev ${src.rev}`}</button>
        <button class="qh-pill" onclick="qhToggleSheet('${qhSheet}')">Cancel</button>
      </div>
    </div>`;
  }
  return '';
}

// §3/§1 — one strip instead of three cards that only reported absence.
function qhLinkedCard(q) {
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const job = jobCards.find(j => j.quotationId === q.id);
  const fam = quoteFamily(q.id);
  const bits = [];
  if (q.parentJobId) bits.push(`Variation for Job <b>${esc(q.parentJobId)}</b>`);
  else if (enq) bits.push(`Enquiry <b>${esc(enq.id)}</b> · ${esc(enq.salesPerson || '—')}`);
  if (job) bits.push(`Job card <b>${esc(job.id)}</b>`);
  if (fam.length > 1) bits.push(`${fam.length} revisions`);
  bits.push('No files attached');
  return `<div class="sales-card" id="qh-attachments">
    <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">Linked &amp; attached</p></div>
    <p style="font-size:11.5px;color:var(--biz-text-muted);margin-top:5px;">${bits.join(' · ')}</p>
    <div class="qh-pills" style="margin-top:8px;">
      <button class="qh-pill" onclick="salesAlert('Files go to this project\\'s folder — send them to Operations and they will be attached here. In-app upload is not built yet.')">Attach a file</button>
      ${job ? `<button class="qh-pill" onclick="hideModuleWrap(salesModuleWrap);setTimeout(()=>launchJobsModule('${job.id}'),150)">Open job card</button>` : ''}
    </div>
  </div>`;
}

// §8 — follow-ups belong to the ENQUIRY. This reads and writes the same store.
function qhFollowUpCard(q) {
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const list = enq ? (enq.followUps || []) : [];
  const last = list.length ? list[list.length - 1] : null;
  return `<div class="sales-card">
    <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">Follow-up</p>
      <span style="font-size:11px;color:var(--biz-text-faint);">${list.length} on the enquiry</span></div>
    ${last ? `<p style="font-size:12px;color:var(--biz-text);margin-top:5px;">
        <b>${esc(last.meetingType || '—')}</b> · ${esc(last.outcome || '—')} · ${qhDate(last.date)}</p>
      <p style="font-size:11.5px;color:var(--biz-text-muted);margin-top:3px;">${esc(last.notes || '')}</p>`
      : '<p style="font-size:11.5px;color:#94a3b8;margin-top:5px;">Nothing logged yet.</p>'}
    <div class="qh-pills" style="margin-top:9px;">
      <button class="qh-pill" onclick="qhLogFollowUp('${q.id}')">Log a client call</button>
    </div>
  </div>`;
}

function qhBottomBar(q, lock) {
  const canConfirm = q.stage === 'sales' && q.lifecycleStatus === 'open';
  return `<div class="qh-bottom">
    ${canConfirm ? `<button class="qh-cta" onclick="${q.parentJobId ? `salesConfirmVariation('${q.id}')` : `salesConfirmQuote('${q.id}')`}">Confirm quote</button>`
      : `<span class="qh-cta is-off" style="flex:1;text-align:center;">${q.lifecycleStatus === 'confirmed' ? 'Confirmed' : 'Not ready to confirm'}</span>`}
    <button class="qh-pill" onclick="qhToggleSheet('more')" aria-label="More">⋯</button>
  </div>`;
}

// Quick actions act on the quote you are looking at; from the list they say so
// rather than silently doing nothing.
function qhQuickQuote() {
  const q = salesView === 'qtn-hub' ? quotations.find(x => x.id === salesActiveQtnId) : null;
  if (!q) { salesAlert('Open a quotation first — these act on the quote you are looking at.'); return null; }
  return q;
}
function qhQuickConfirm() {
  const q = qhQuickQuote(); if (!q) return;
  if (q.stage !== 'sales' || q.lifecycleStatus !== 'open') { salesAlert('This quote is not ready to confirm yet.'); return; }
  if (q.parentJobId) salesConfirmVariation(q.id); else salesConfirmQuote(q.id);
}
function qhQuickPrint() { const q = qhQuickQuote(); if (q) openPrintDialog(q.id, false); }
function qhQuickRevision() { const q = qhQuickQuote(); if (q) { qhSheet = 'revision'; qhSetTab('record'); } }
function qhQuickFollowUp() { const q = qhQuickQuote(); if (q) qhLogFollowUp(q.id); }

// ── Items tab (§5) — built for a 300-line quote ──────────────────────────
function qhItemsTab(q, totals, lock) {
  const groups = qhGroupsOf(q);
  const rail = groups.map(g => `<button class="qh-rail-b${qhCollapsed[g.name] ? '' : ' on'}" onclick="qhScrollToGroup('${esc(g.name)}')">
      <span>${esc(g.name)}</span><i>${g.rows.length} · ${qhBD(g.total)}</i></button>`).join('');

  const body = groups.map(g => {
    const closed = !!qhCollapsed[g.name];
    const band = `<tr class="qh-band" id="qh-g-${qhSlug(g.name)}" onclick="qhToggleGroup('${esc(g.name)}')">
        <td colspan="6"><span>${closed ? '▸' : '▾'} ${esc(g.name)}</span>
          <b>${g.rows.length} · ${qhBD(g.total)}</b></td></tr>`;
    // A closed group is ONE row — the rows are skipped, not rendered and hidden.
    if (closed) return band;
    const limit = qhWindow[g.name] || QH_PAGE;
    const shown = g.rows.slice(0, limit);
    const rows = shown.map(r => {
      const it = r.item;
      return `<tr class="qh-row">
        <td class="qh-sl">${esc(r.serial)}</td>
        <td><span class="qh-nm">${esc(it.product)}</span>${qhDensity === 'full' && it.description ? `<span class="qh-spec">${esc(it.description)}</span>` : ''}
          ${qhPhotos ? (it.imageUrl ? `<img class="qh-ph" src="${esc(it.imageUrl)}">` : '<span class="qh-ph is-none">photo</span>') : ''}</td>
        <td class="num">${qhQty(it.qty)} ${esc(it.unit || '')}</td>
        <td class="num">${qhBD(it.rate)}</td>
        <td class="num qh-disc">${it.discPercent ? it.discPercent + '%' : '—'}</td>
        <td class="num">${qhBD(it.netAmount)}</td></tr>`;
    }).join('');
    const more = g.rows.length > shown.length
      ? `<tr><td colspan="6" class="qh-more"><button onclick="qhMore('${esc(g.name)}')">Show ${Math.min(QH_PAGE, g.rows.length - shown.length)} more of ${g.rows.length}</button></td></tr>`
      : '';
    return band + rows + more;
  }).join('');

  return `
    ${qhActionRow(q, lock)}
    ${qhSheet ? qhSheetHTML(q, lock) : ''}
    <div class="qh-items">
      <aside class="qh-rail">${rail || '<p class="qh-spec">No groups</p>'}</aside>
      <div class="qh-items-main">
        <div class="qh-items-h">
          <button class="qh-pill" onclick="qhAllGroups(false)">Collapse all</button>
          <button class="qh-pill" onclick="qhAllGroups(true)">Expand all</button>
          <span style="flex:1;"></span>
          <button class="qh-pill${qhDensity === 'compact' ? ' on' : ''}" onclick="qhSetDensity('${qhDensity === 'compact' ? 'full' : 'compact'}')">${qhDensity === 'compact' ? 'Compact' : 'Full'}</button>
          <button class="qh-pill${qhPhotos ? ' on' : ''}" onclick="qhTogglePhotos()">Photos ${qhPhotos ? 'on' : 'off'}</button>
        </div>
        <table class="qh-table ${qhDensity === 'compact' ? 'is-compact' : ''}">
          <thead><tr><th>#</th><th style="text-align:left;">Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Disc</th><th class="num">Net</th></tr></thead>
          <tbody>${body || '<tr><td colspan="6" style="padding:14px;color:#94a3b8;font-size:11.5px;">No lines yet.</td></tr>'}</tbody>
        </table>
        <div class="qh-foot">
          <span>Total ${qhBD(totals.itemTotal)}</span><span>Discount ${qhBD(totals.discTotal)}</span>
          <span>VAT ${qhBD(totals.vatTotal)}</span><b>Net ${qhBD(totals.netTotal)}</b>
        </div>
      </div>
    </div>`;
}

function qhDocumentTab(q) {
  return `<div class="sales-card">
    <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">The printed quotation</p></div>
    <p style="font-size:11.5px;color:var(--biz-text-muted);margin-top:5px;">
      A4 · with the bank block, eleven clauses and three signature panels. Valid until ${qhDate(quoteValidUntil(q))} prints on the meta grid.</p>
    <div class="qh-pills" style="margin-top:9px;">
      <button class="qh-pill on" onclick="openPrintDialog('${q.id}',false)">Open print dialog</button>
    </div>
  </div>`;
}

function qhHistoryTab(q) {
  const until = quoteValidUntil(q);
  const pending = q.lifecycleStatus === 'open'
    ? `<div class="qh-hrow is-pending"><span>${qhDate(until)} 23:59</span><b>Auto-close on expiry</b><i>scheduled · system</i></div>` : '';
  const rows = (q.auditLog || []).slice().reverse().map(a =>
    `<div class="qh-hrow"><span>${qhDate(a.date || a.dateTime)}</span><b>${esc(a.action)}</b><i>${esc(a.user || '—')}</i></div>`).join('');
  return `<div class="sales-card" id="qh-history">
    <div class="qh-card-h"><p style="font-weight:700;font-size:13px;">History</p></div>
    ${pending}${rows || '<p style="font-size:11.5px;color:#94a3b8;">Nothing recorded yet.</p>'}
  </div>`;
}

// ── actions ──────────────────────────────────────────────────────────────
function qhExtend(id) {
  const res = extendQuotationValidity(id, 7, salesCurrentUser);
  if (res && res.error) { salesAlert(res.error); return; }
  salesAlert('✓ Valid until ' + qhDate(res.validUntil) + ' — reprint the quotation so the client sees the new date.');
  renderSalesBody();
}
function qhMarkLost(id) {
  const reason = window.prompt('Mark this quote lost. Why?');
  if (!reason || !reason.trim()) return;
  const res = closeQuotationForGood(id, reason.trim(), salesCurrentUser);
  if (res && res.error) { salesAlert(res.error); return; }
  renderSalesBody();
}
function qhCloseForGood(id) { qhMarkLost(id); }
function qhReinstate(id) {
  const res = reinstateQuotation(id, salesCurrentUser);
  if (res && res.error) { salesAlert(res.error); return; }
  salesAlert('✓ Reinstated — same lines, same rates, valid until ' + qhDate(res.validUntil) + '.');
  renderSalesBody();
}
function qhRecost(id) {
  const rev = raiseQuotationRevision(id, salesCurrentUser);
  if (rev && rev.error) { salesAlert(rev.error); return; }
  transferQuotationStage(rev.id, 'estimator', salesCurrentUser);
  salesActiveQtnId = rev.id;
  salesAlert('✓ ' + rev.id + ' created and sent to the Estimator to re-price at today\'s rates.');
  renderSalesBody();
}
function qhRaiseRevision(fromId) {
  const rev = raiseQuotationRevision(fromId, salesCurrentUser);
  if (rev && rev.error) { salesAlert(rev.error); return; }
  salesActiveQtnId = rev.id;
  qhSheet = null;
  salesAlert('✓ ' + rev.id + ' raised.');
  renderSalesBody();
}
function qhDuplicateFrom(fromId) {
  const copy = duplicateQuotation(fromId, {});
  if (copy && copy.error) { salesAlert(copy.error); return; }
  salesActiveQtnId = copy.id;
  qhSheet = null;
  salesAlert('✓ ' + copy.id + ' created.');
  renderSalesBody();
}
function qhLogFollowUp(id) {
  const q = quotations.find(x => x.id === id);
  if (!q || !q.enquiryId) { salesAlert('Follow-ups belong to the enquiry — this quote has none linked.'); return; }
  const meetingType = window.prompt('Meeting type (Call / Site visit / Meeting)');
  if (!meetingType) return;
  const outcome = window.prompt('Outcome');
  if (!outcome) return;
  const notes = window.prompt('Notes (at least 10 characters)');
  if (!notes) return;
  const res = addFollowUp(q.enquiryId, { date: todayISO(), meetingType, outcome, notes });
  if (res && res.error) { salesAlert(res.error); return; }
  renderSalesBody();
}

// Shared by the Quotation Hub and the Job Card Management hub (jobs.js) —
// both render the identical set of linked-document mini-tables per the live
// trace's "hub" pattern. Takes the Job Card (or null if none exists yet,
// e.g. an unconfirmed quotation) since every one of these documents hangs
// off the Job Card, not the Quotation, once a job exists.
function renderRelatedRecords(job) {
  if (!job) {
    return `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p><p style="font-size:11.5px;color:#94a3b8;">Invoices · Receipts · Credit Notes · Proforma · Delivery Notes — available once this quotation is confirmed and a Job Card exists.</p></div>`;
  }
  const invoices = getInvoicesForJob(job.id);
  const receipts = getReceiptsForJob(job.id);
  const creditNotes = getCreditNotesForJob(job.id);
  const proforma = getProformasForJob(job.id);
  const dnRows = job.deliveryNotes.length === 0 ? '' :
    `<p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Delivery Notes</p>
     <table class="sales-items"><tr><th>DN</th><th>Date</th><th>Lines</th></tr>${job.deliveryNotes.map(dn => `<tr><td>${esc(dn.id)}</td><td>${dn.date}</td><td>${dn.lines.length}</td></tr>`).join('')}</table>`;

  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p>
      <p style="font-weight:700;font-size:12px;margin:6px 0 4px;">Invoices</p>
      ${invoices.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Invoice No.</th><th>Date</th><th>Amount</th><th>Received</th><th>Balance</th></tr>${invoices.map(inv => `<tr><td>${esc(inv.id)}</td><td>${inv.date}</td><td>${inv.totals.netTotal.toFixed(3)}</td><td>${(inv.paidAmount || 0).toFixed(3)}</td><td>${invoiceBalance(inv).toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Receipts</p>
      ${receipts.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Receipt No.</th><th>Date</th><th>Amount</th></tr>${receipts.map(r => `<tr><td>${esc(r.id)}</td><td>${r.receiptDate}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Credit Notes</p>
      ${creditNotes.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Credit Note No.</th><th>Date</th><th>Amount</th><th>Status</th></tr>${creditNotes.map(cn => `<tr style="${cn.status === 'cancelled' ? 'background:#fee2e2;' : ''}"><td>${esc(cn.id)}</td><td>${cn.creditNoteDate}</td><td>${cn.amount.toFixed(3)}</td><td>${cn.status}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Proforma</p>
      ${proforma.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Proforma generated yet.</p>` :
        `<table class="sales-items"><tr><th>Proforma No.</th><th>Date</th><th>Amount</th></tr>${proforma.map(p => `<tr><td>${esc(p.id)}</td><td>${p.date}</td><td>${p.totals.netTotal.toFixed(3)}</td></tr>`).join('')}</table>`}
      ${dnRows}
    </div>`;
}

// Shared across every Manage Quote hub view (Sales/Estimator/Approver all
// render the same log at the bottom of the page) — one running trail of
// every status transition, per the live reference.
function renderQuotationAuditTable(qtn) {
  const log = qtn.auditLog || [];
  const rows = log.map(r => `<tr><td>${r.seq}</td><td>${esc(r.action)}</td><td>${esc(r.user)}</td><td>${r.date}</td><td>${esc(r.userType)}</td><td>${esc(r.status)}</td></tr>`).join('');
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Audit Trail</p>
      <table class="sales-items"><tr><th>#</th><th>Action</th><th>User</th><th>Date</th><th>User Type</th><th>Status</th></tr>${rows}</table>
    </div>`;
}

// Matches the live confirmation copy exactly ("Do you Want to Change Status?").
// Sales only ever transfers forward to Estimator — it can't jump straight to
// Approver (that's Estimator's own action) or re-send to itself.
function salesTransferToEstimator(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  transferQuotationStage(qtnId, 'estimator', salesCurrentUser);
  salesAlert('✓ Transferred to Estimator.');
  renderSalesBody();
}

// Creates the Job Card — the bridge into Module 5 (Jobs). Matches the live
// confirmation copy used for every other status change in this loop.
function salesConfirmQuote(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  const result = confirmQuotationToJobCard(qtnId, salesCurrentUser);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Quotation confirmed — Job Card ${result.id} created.`);
  renderSalesBody();
}

// Variation Order equivalent of salesConfirmQuote() — merges into the
// EXISTING parent Job Card instead of creating a new one.
function salesConfirmVariation(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  const result = confirmVariationToJobCard(qtnId, salesCurrentUser);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Variation approved and merged into Job Card ${result.id}.`);
  renderSalesBody();
}

// ── Edit Quote wizard (3 steps) ──
function openQuotationWizard(id, step) {
  // The wizard is callable directly (jobs.js's New Variation drops straight
  // into step 2), so the tile-level lock alone would be bypassable. Refuse
  // at the entry point too.
  const lock = typeof quotationLock === 'function'
    ? quotationLock(quotations.find(q => q.id === id)) : null;
  if (lock) { salesAlert(lock.reason); return; }
  salesActiveQtnId = id;
  salesWizardStep = step || 1;
  salesView = 'qtn-wizard';
  renderSalesBody();
}

function renderQuotationWizard() {
  const isNew = !salesActiveQtnId;
  const steps = ['Client & Project', 'Product & Services', 'Finalise'];
  const stepBar = `<div class="sales-wizard-steps">${steps.map((s, i) => `<div class="sales-wizard-step ${salesWizardStep === i + 1 ? 'active' : (isNew ? '' : 'done')}">${i + 1}. ${s}</div>`).join('')}</div>`;

  let body = '';
  if (salesWizardStep === 1) body = renderWizardStep1(isNew);
  else if (salesWizardStep === 2) body = renderWizardStep2();
  else body = renderWizardStep3();

  return `<span class="sales-back" onclick="${isNew ? `salesView='enq-list';` : `openQuotationHub('${salesActiveQtnId}');`}renderSalesBody();">‹ Back</span>${stepBar}${body}`;
}

function renderWizardStep1(isNew) {
  if (isNew) {
    const d = salesDraft;
    const enq = enquiries.find(e => e.id === d.enquiryId);
    const c = customers.find(x => x.id === enq.customerId);
    return `
      <div class="sales-preview">
        <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Enquiry Details (read-only)</p>
        <p><b>Enquiry No:</b> ${esc(enq.id)}</p>
        <p><b>Customer Name:</b> ${esc(c.name)}</p>
        <p><b>Customer Code:</b> ${esc(c.id)}</p>
        <p><b>Telephone:</b> ${esc(c.tel)}</p>
        <p><b>Email:</b> ${esc(c.email)}</p>
        <p><b>Address:</b> ${esc(c.address)}</p>
        <p><b>Contact Person:</b> ${esc(enq.contactPerson)}</p>
        <p><b>VAT Name/No:</b> ${esc(c.vatName)} / ${esc(c.vatNo)}</p>
      </div>
      <div class="sales-card">
        <div class="sales-field"><label>Tax %</label><input type="number" value="${d.taxPercent}" oninput="salesDraft.taxPercent=Number(this.value)"></div>
        <div class="sales-field"><label>Project Name</label><input type="text" value="${esc(d.projectName)}" oninput="salesDraft.projectName=this.value"></div>
        <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesDraft.contactPerson=this.value"></div>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Pricing is always completed by the Estimator — Sales never enters a Rate.</p>
        <div class="sales-field"><label>Notes</label><textarea oninput="salesDraft.notes=this.value">${esc(d.notes)}</textarea></div>
        <button class="primary" style="width:100%;" onclick="saveWizardStep1()">Save & Proceed</button>
      </div>`;
  }
  const q = quotations.find(x => x.id === salesActiveQtnId);
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);
  return `
    <div class="sales-preview">
      <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Enquiry Details (read-only)</p>
      <p><b>Enquiry No:</b> ${esc(enq.id)}</p>
      <p><b>Customer Name:</b> ${esc(c.name)}</p>
      <p><b>Customer Code:</b> ${esc(c.id)}</p>
      <p><b>Telephone:</b> ${esc(c.tel)}</p>
      <p><b>Email:</b> ${esc(c.email)}</p>
      <p><b>Address:</b> ${esc(c.address)}</p>
      <p><b>Contact Person:</b> ${esc(enq.contactPerson)}</p>
      <p><b>VAT Name/No:</b> ${esc(c.vatName)} / ${esc(c.vatNo)}</p>
    </div>
    <div class="sales-card">
      <div class="sales-field"><label>Tax %</label><input type="number" value="${q.taxPercent}" onchange="salesUpdateQtnField('taxPercent',Number(this.value))"></div>
      <div class="sales-field"><label>Project Name</label><input type="text" value="${esc(q.projectName)}" onchange="salesUpdateQtnField('projectName',this.value)"></div>
      <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(q.contactPerson)}" onchange="salesUpdateQtnField('contactPerson',this.value)"></div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Pricing is always completed by the Estimator — Sales never enters a Rate.</p>
      <div class="sales-field"><label>Notes</label><textarea onchange="salesUpdateQtnField('notes',this.value)">${esc(q.notes)}</textarea></div>
      <button class="primary" style="width:100%;" onclick="salesWizardStep=2;renderSalesBody();">Save & Proceed</button>
    </div>`;
}

function saveWizardStep1() {
  const d = salesDraft;
  if (!d.projectName) { salesAlert('Project Name is required.'); return; }
  const result = convertEnquiryToQuotation(d.enquiryId, d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Quotation ${result.id} created.`);
  salesActiveQtnId = result.id;
  salesDraft = null;
  salesWizardStep = 2;
  renderSalesBody();
}

function renderWizardStep2() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  const totals = computeQuotationTotals(q);
  const locked = q.withEstimation;
  // Pre-fill Group/Sub Group with whatever the last item used — most items
  // get added consecutively within the same area/section, so this avoids
  // Sales retyping "RECEPTION AREA" for every single line in it.
  const lastItem = q.items[q.items.length - 1];
  const defaultGroup = lastItem ? lastItem.group : '';
  const defaultSubgroup = lastItem ? lastItem.subgroup : '';

  const hierarchy = computeQuoteHierarchy(q.items);
  const rowsHtml = q.items.length === 0
    ? `<p style="font-size:12px;color:#64748b;margin-bottom:10px;">No items added yet.</p>`
    : `<table class="sales-items"><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Net</th><th></th></tr>` +
      hierarchy.map(h => {
        const it = h.item;
        let headers = '';
        if (h.isNewGroup) headers += `<tr style="background:#e2e8f0;"><td colspan="7" style="font-weight:700;">${esc(it.group || '(No Group)')}${it.group ? ` <span style="cursor:pointer;color:var(--biz-primary);font-weight:600;font-size:10.5px;" onclick="salesCopySection('${q.id}',${it.lineId},'group')">⧉ Copy Group</span>` : ''}</td></tr>`;
        if (h.isNewSubgroup) headers += `<tr style="background:#f1f5f9;"><td colspan="7" style="font-weight:600;text-decoration:underline;">${h.groupNo}.${h.subgroupNo} ${esc(it.subgroup || '(No Sub Group)')}${it.subgroup ? ` <span style="cursor:pointer;color:var(--biz-primary);font-weight:600;font-size:10.5px;text-decoration:none;" onclick="salesCopySection('${q.id}',${it.lineId},'subgroup')">⧉ Copy Sub Group</span>` : ''}</td></tr>`;
        return headers + `<tr><td>${h.serial}</td><td>${esc(it.product)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td>
        <td><span style="cursor:pointer;color:var(--biz-primary);margin-right:8px;" onclick="salesToggleEditItem(${it.lineId})" title="Edit">✎</span><span style="cursor:pointer;color:var(--biz-primary);margin-right:8px;" onclick="salesDuplicateItem('${q.id}',${it.lineId})" title="Duplicate">⧉</span><label title="${it.imageUrl ? 'Replace photo' : 'Attach photo'}" style="cursor:pointer;color:${it.imageUrl ? 'var(--ok,#0f9d58)' : 'var(--biz-primary)'};margin-right:8px;">📷<input type="file" accept="image/*" style="display:none;" onchange="salesUploadItemImage('${q.id}',${it.lineId},this.files[0]);this.value='';"></label><span style="cursor:pointer;color:#b91c1c;" onclick="salesRemoveItem('${q.id}',${it.lineId})" title="Remove">✕</span></td></tr>` +
        (salesEditingLineId === it.lineId ? `<tr><td colspan="7">${renderSalesItemEditPanel(q, it)}</td></tr>` : '');
      }).join('') +
      `</table>`;

  return `
    ${q.headerComment ? `<div class="sales-preview"><p style="font-weight:700;color:#1a1f2e;margin-bottom:4px;">Approver Comments</p><p>${esc(q.headerComment)}</p></div>` : ''}
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Item</p>
      ${locked ? `<div class="sales-banner">Rate/Amount/Net Amount are locked at 0.000 for Sales — pricing is always completed by the Estimator.</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Group (Area)</label><input type="text" id="it-group" value="${esc(defaultGroup)}"></div>
        <div class="sales-field"><label>Sub Group</label><input type="text" id="it-subgroup" value="${esc(defaultSubgroup)}"></div>
      </div>
      <p style="font-size:10.5px;color:#94a3b8;margin:-6px 0 8px;">Group/Sub Group become header/sub-header sections on the printed quotation. Leave blank for a flat, ungrouped item.</p>
      <div class="sales-field"><label>Product/Service</label><input type="text" id="it-product"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Qty</label><input type="number" id="it-qty" value="1"></div>
        <div class="sales-field"><label>Unit</label><select id="it-unit">${units.map(u => `<option value="${u.name}">${u.name}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Rate</label><input class="${locked ? 'sales-locked' : ''}" type="number" id="it-rate" ${locked ? 'disabled value="0"' : 'value="0"'}></div>
        <div class="sales-field"><label>Vat%</label><input type="number" id="it-vat" value="${q.taxPercent}"></div>
      </div>
      <div class="sales-field"><label>Disc%</label><input type="number" id="it-disc" value="0"></div>
      <div class="sales-field"><label>Description</label><textarea id="it-desc"></textarea></div>
      <div class="sales-field"><label>Internal Comments</label><textarea id="it-comments"></textarea></div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Image upload not wired — no upload infrastructure in this app yet.</p>
      <button class="primary" style="width:100%;" onclick="salesAddItem('${q.id}')">Add Item</button>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Items</p>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Once a quotation has been to the Estimator, use ✎ to adjust Qty/Description/Internal Comments — Rate stays Estimator-controlled.</p>
      ${rowsHtml}
      <div style="font-size:12px;color:#334155;">
        <p>Item Total: BD ${totals.itemTotal.toFixed(3)}</p>
        <p>Discount: BD ${totals.discTotal.toFixed(3)}</p>
        <p>Gross Amount: BD ${(totals.itemTotal - totals.discTotal).toFixed(3)}</p>
        <p>VAT: BD ${totals.vatTotal.toFixed(3)}</p>
        <p style="font-weight:700;">Net Amount: BD ${totals.netTotal.toFixed(3)}</p>
      </div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:12.5px;margin-bottom:6px;">Quote-level discount</p>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="quote-discount" type="number" min="0" step="0.001" value="${q.quoteDiscount || ''}" placeholder="BD amount off the whole quote" style="flex:1;">
        <button class="secondary" onclick="salesApplyQuoteDiscount('${q.id}')">Apply</button>
      </div>
      <p style="font-size:10px;color:#94a3b8;margin-top:4px;">One document discount (like the real quotations carry) — distributed proportionally across the items, so totals, invoices and prints all stay consistent.</p>
    </div>
    <button class="primary" style="width:100%;" onclick="salesWizardStep=3;renderSalesBody();">Save & Proceed</button>`;
}

// Copy a whole Group or Sub Group (and every item inside it) as new items
// appended to the end — Salman's ask: makes a section faster to build by
// duplicating a similar one and tweaking, not retyping line by line.
// Passed by lineId (not the raw group/subgroup name) so a name containing
// an apostrophe can never break the onclick attribute string.
function salesCopySection(qtnId, lineId, scope) {
  const qtn = quotations.find(q => q.id === qtnId);
  const item = qtn && qtn.items.find(it => it.lineId === lineId);
  if (!item) return;
  const result = copyQuoteSection(qtnId, item.group, scope === 'subgroup' ? item.subgroup : undefined);
  if (result && result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ ${scope === 'subgroup' ? 'Sub Group' : 'Group'} copied — ${result.length} item${result.length === 1 ? '' : 's'} added.`);
  renderSalesBody();
}

function renderSalesItemEditPanel(qtn, item) {
  return `
    <div style="background:#f4e6ec;border-radius:8px;padding:10px;margin:4px 0;">
      ${item.approverComment ? `<p style="font-size:11px;color:#92400e;margin-bottom:8px;"><b>Approver comment on this line:</b> ${esc(item.approverComment)}</p>` : ''}
      <div class="sales-field"><label>Qty</label><input type="number" value="${item.qty}" onchange="salesUpdateItemField(${item.lineId},'qty',Number(this.value))"></div>
      <div class="sales-field"><label>Description</label><textarea onchange="salesUpdateItemField(${item.lineId},'description',this.value)">${esc(item.description)}</textarea></div>
      <div class="sales-field"><label>Internal Comments</label><textarea onchange="salesUpdateItemField(${item.lineId},'internalComments',this.value)">${esc(item.internalComments)}</textarea></div>
      <button class="secondary" style="width:100%;" onclick="salesToggleEditItem(${item.lineId})">Done</button>
    </div>`;
}
function salesToggleEditItem(lineId) { salesEditingLineId = salesEditingLineId === lineId ? null : lineId; renderSalesBody(); }
function salesUpdateItemField(lineId, key, val) {
  updateQuotationItemFields(salesActiveQtnId, lineId, { [key]: val });
  renderSalesBody();
}

function salesAddItem(qtnId) {
  const product = document.getElementById('it-product').value;
  if (!product) { salesAlert('Product/Service is required.'); return; }
  addQuotationItem(qtnId, {
    group: document.getElementById('it-group').value,
    subgroup: document.getElementById('it-subgroup').value,
    product,
    qty: Number(document.getElementById('it-qty').value),
    unit: document.getElementById('it-unit').value,
    rate: Number(document.getElementById('it-rate').value),
    vatPercent: Number(document.getElementById('it-vat').value),
    discPercent: Number(document.getElementById('it-disc').value),
    description: document.getElementById('it-desc').value,
    internalComments: document.getElementById('it-comments').value
  });
  renderSalesBody();
}
function salesRemoveItem(qtnId, lineId) { removeQuotationItem(qtnId, lineId); renderSalesBody(); }

// Stage 6: product photo per quote line — Salman's call: SALES uploads at
// quote time. Lands in the public item-images bucket; the public URL rides
// on item.imageUrl and shows in the quotation/Job Order print documents.
async function salesUploadItemImage(qtnId, lineId, file) {
  if (!file) return;
  if (!window.__realCloudSession || !sb) { salesAlert('Photo upload needs a signed-in cloud session.'); return; }
  // 500 KB cap — Salman's call (6 Aug 2026): keeps quote documents light
  // and uploads fast on site connections.
  if (file.size > 500 * 1024) { salesAlert('Photo is over 500 KB — please use a smaller/compressed image.'); return; }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const pathKey = qtnId + '/' + lineId + '-' + Date.now() + '.' + ext;
  const { error } = await sb.storage.from('item-images').upload(pathKey, file, { upsert: true });
  if (error) { salesAlert('Upload failed: ' + error.message); return; }
  const { data } = sb.storage.from('item-images').getPublicUrl(pathKey);
  const item = findQuotationItem(qtnId, lineId);
  if (item) {
    item.imageUrl = data.publicUrl;
    persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  }
  salesAlert('✓ Photo attached.');
  renderSalesBody();
}

// Stage 6: the real documents' single quote-level discount — distributed
// per-item by setQuoteDiscount() (data.js) so all existing math holds.
function salesApplyQuoteDiscount(qtnId) {
  const val = document.getElementById('quote-discount').value;
  const res = setQuoteDiscount(qtnId, val);
  if (res && res.error) { salesAlert(res.error); return; }
  salesAlert('✓ Discount applied — Net Total now BD ' + res.netTotal.toFixed(3) + '.');
  renderSalesBody();
}

// Duplicate — Salman's real ask: a way to copy an existing line item
// (same product/qty/unit/description) as a starting point for a similar
// one, rather than retyping everything from scratch. Rate/amount stay
// locked at 0 like any new item (pricing is always Estimator-controlled),
// same as addQuotationItem() already enforces.
function salesDuplicateItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  const item = qtn && qtn.items.find(it => it.lineId === lineId);
  if (!item) return;
  addQuotationItem(qtnId, {
    group: item.group, subgroup: item.subgroup,
    product: item.product, qty: item.qty, unit: item.unit,
    vatPercent: item.vatPercent, discPercent: item.discPercent,
    description: item.description, internalComments: item.internalComments,
    imageUrl: item.imageUrl // same product, same photo — replaceable per line
  });
  salesAlert('✓ Item duplicated.');
  renderSalesBody();
}

function renderWizardStep3() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">File Manager</p>
      <p style="font-size:11.5px;color:#94a3b8;">No upload infrastructure in this app yet.</p>
    </div>
    <div class="sales-card">
      <div class="sales-field"><label>Covering Letter template</label>
        <select id="fin-covering">
          <option value="">— None —</option>
          ${Object.keys(COVERING_LETTER_TEMPLATES).map(t => `<option value="${t}" ${q.coveringLetterTemplate === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="sales-field"><label>Terms & Conditions template</label>
        <select id="fin-terms">
          <option value="">— None —</option>
          ${Object.keys(TERMS_TEMPLATES).map(t => `<option value="${t}" ${q.termsTemplate === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <button class="primary" style="width:100%;" onclick="saveWizardStep3()">Update Quotation</button>
    </div>`;
}

function saveWizardStep3() {
  const covering = document.getElementById('fin-covering').value;
  const terms = document.getElementById('fin-terms').value;
  finaliseQuotation(salesActiveQtnId, { coveringLetterTemplate: covering, termsTemplate: terms });
  salesAlert('Quotation Status Updated successfully');
  openQuotationHub(salesActiveQtnId);
}

// ── Sales dashboard — the 7 Aug 2026 design handoff ──
// Salman supplied a high-fidelity bundle and asked for it exactly. The layout,
// cards and behaviour live in sales-dashboard.js; this returns its root and
// renderSalesBody() mounts it.
//
// Two things the handoff names as bugs in the old version, both gone with it:
// the Receivables KPI and Top-Clients-by-value put money in front of a role
// that must never see it, and the whole screen showed company-wide figures
// instead of the logged-in salesperson's own book.
function renderSalesDashboard() {
  return '<div id="sales-dashboard-root"></div>';
}

// "My Jobs" — read-only job visibility + Add Variation/Request Purchase
// shortcuts, scoped to the logged-in Sales identity's own confirmed Job
// Cards (see getSalesPersonJobs()). Sales never opens the real Jobs
// module at all — this lightweight view, plus these two module-hop
// shortcuts into jobs.js's/purchasing.js's own real flows, is the entire
// surface Sales gets. Deliberately no access to Delivery Notes, Materials
// Issue/Return, Invoicing, or Job Status changes — those stay exclusively
// in the Jobs module (and are further gated there on Operations having
// actually routed the job — see jobs.js's routingConfirmed check).
function renderSalesMyJobs() {
  const jobs = getSalesPersonJobs(salesCurrentUser);
  const rows = jobs.length === 0
    ? `<p style="font-size:12px;color:#64748b;">No confirmed jobs yet for ${esc(salesCurrentUser)}.</p>`
    : jobs.map(j => `
      <div class="sales-card" style="margin-bottom:8px;">
        <p style="font-weight:700;font-size:13px;">${esc(j.projectName)} <span class="sales-pill ${j.status === 'completed' ? 'confirmed' : 'open'}">${esc(j.status)}</span></p>
        <p style="font-size:11.5px;color:#64748b;">${esc(j.id)} · BD ${j.amount.toFixed(3)} · Confirmed ${j.confirmDate}</p>
        <p style="font-size:11px;color:#94a3b8;">${esc(j.deptProgress)}</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="secondary" style="flex:1;font-size:11.5px;padding:6px 10px;${j.status === 'cancelled' ? 'opacity:.5;cursor:not-allowed;' : ''}" onclick="${j.status === 'cancelled' ? `salesAlert('This job is cancelled.')` : `jobsNewVariation('${j.id}')`}">+ Add Variation</button>
          <button class="secondary" style="flex:1;font-size:11.5px;padding:6px 10px;" onclick="salesRequestPurchase('${j.id}')">+ Request Purchase</button>
        </div>
      </div>`).join('');
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:4px;">My Jobs</p>
      <p style="font-size:11px;color:#94a3b8;">Read-only production status for your own confirmed jobs. Production itself is managed in Operations/Joinery/Upholstery/Painting/Curtain — this is visibility only, plus shortcuts to add a Variation or request a Purchase for the job.</p>
    </div>
    ${rows}`;
}

// Hops into Purchasing's own real "New Purchase Request" form, pre-filled
// with this job — same module-hop pattern as jobsNewVariation(), not a
// duplicated form. Purchasing's PR form already supports a linked Job No
// (prFormDraft.linkedJobId); this just gives Sales a door into it without
// broader access to Purchasing itself.
function salesRequestPurchase(jobId) {
  hideModuleWrap(salesModuleWrap);
  setTimeout(() => {
    launchPurchasingModule();
    openPRForm();
    document.getElementById('pr-form-job').value = jobId;
    prFormJobChanged(jobId);
  }, 150);
}

// Was written but never actually wired into any dashboard UI — the Sales
// module opened straight to the Enquiry List with no landing KPI view.
// Expanded to match the KPI list from Salman's design notes (Enquiries Un-
// allocated/In-Progress, Quotations pipeline stage, Jobs, To Invoice,
// Receivables, PR) and now rendered by renderSalesDashboard() above.
function getSalesKPIs() {
  const unallocated = enquiries.filter(e => !e.salesPerson).length;
  const inProgress = enquiries.filter(e => e.salesPerson && !e.linkedQuotationId).length;
  const openQuotations = quotations.filter(q => q.lifecycleStatus !== 'closed').length;
  const withEstimator = quotations.filter(q => q.stage === 'estimator').length;
  const withApprover = quotations.filter(q => q.stage === 'approver').length;

  // Job Card only tracks whole-item deliveredQty, not a distinct "ongoing"
  // flag — Pending = nothing delivered yet, On-going = partially delivered.
  // Not confirmed against Q-Pro's own exact Pending/On-going definition.
  const openJobs = typeof jobCards !== 'undefined' ? jobCards.filter(j => j.status === 'open') : [];
  const jobsPending = openJobs.filter(j => j.items.every(it => it.deliveredQty === 0)).length;
  const jobsOngoing = openJobs.length - jobsPending;

  // "To Invoice" = an open/completed job with no Tax Invoice generated yet.
  const toInvoice = typeof jobCards !== 'undefined' && typeof getInvoicesForJob === 'function'
    ? jobCards.filter(j => j.status !== 'cancelled' && getInvoicesForJob(j.id).length === 0).length : 0;
  // Receivables — sum of each invoice's real outstanding balance (Net Total
  // minus Batch 4's Receipt paidAmount and Credit Note creditedAmount).
  // Previously summed the full netTotal since no payment tracking existed —
  // corrected now that Sales Receipt/Credit Note actually net things off.
  const receivables = typeof taxInvoices !== 'undefined' ? taxInvoices.reduce((s, inv) => s + invoiceBalance(inv), 0) : 0;

  const prPending = typeof purchaseRequests !== 'undefined' ? purchaseRequests.filter(pr => pr.status === 'open').length : 0;
  const prNotReceived = typeof purchaseOrders !== 'undefined' ? purchaseOrders.filter(po => po.status === 'issued').length : 0;

  function divisionCategory(div) {
    if (div === 'Curtain & Blinds') return 'curtain';
    if (div === 'Upholstery') return 'upholstery';
    return 'joinery';
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  enquiries.forEach(e => categoryBreakdown[divisionCategory(e.division)]++);

  return {
    unallocated, inProgress, openQuotations, withEstimator, withApprover,
    jobsPending, jobsOngoing, toInvoice, receivables, prPending, prNotReceived,
    categoryBreakdown
  };
}

// "My Jobs" — read-only visibility into a salesperson's own confirmed Job
// Cards, traced Job -> Quotation -> Enquiry.salesPerson. Salman's call:
// Sales should see how their jobs are progressing (own jobs only, a simple
// status rollup — not the department-level detail Operations/production
// tracks) and gets an Add Variation shortcut, but no editing rights over
// production itself — that stays exclusively in Operations/Joinery/
// Upholstery/Painting/Curtain.
function getSalesPersonJobs(salesPersonName) {
  return jobCards.filter(job => {
    const qtn = quotations.find(q => q.id === job.quotationId);
    const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
    return enq && enq.salesPerson === salesPersonName;
  }).map(job => {
    const allStatuses = job.items.flatMap(it => it.departmentStatuses || []);
    const doneCount = allStatuses.filter(s => s.status === 'done').length;
    return {
      id: job.id, projectName: job.projectName, amount: job.amount, status: job.status,
      confirmDate: job.confirmDate,
      deptProgress: allStatuses.length ? `${doneCount}/${allStatuses.length} departments done` : 'Not yet routed'
    };
  });
}

// ══════════════════════════════════════════
// Batch 7 (3 Aug 2026): Proforma, Sales Receipt, Sales Credit Note, and
// Customer Update all moved to accounts.js — Salman's call: Sales never
// creates/edits/deletes these, only views them read-only via
// renderRelatedRecords() above (still here, called from both this file
// and jobs.js). See accounts.js for the moved create/list functions.
// ══════════════════════════════════════════

function renderSalesReports() {
  return renderQuotationRegisterReport();
}

function salesQtnRegFilterChanged(key, val) { salesQtnRegFilters[key] = val; renderSalesBody(); }

function renderQuotationRegisterReport() {
  const f = salesQtnRegFilters;
  const rows = quotations.filter(q => {
    if (f.from && q.date < f.from) return false;
    if (f.to && q.date > f.to) return false;
    if (f.status !== 'All' && q.lifecycleStatus !== f.status.toLowerCase()) return false;
    if (f.salesPerson) {
      const enq = enquiries.find(e => e.id === q.enquiryId);
      if (!enq || enq.salesPerson !== f.salesPerson) return false;
    }
    return true;
  }).slice().sort((a, b) => b.date.localeCompare(a.date));

  return `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Division</label><input type="text" value="Al Maraya Decor" disabled></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Status</label>
          <select onchange="salesQtnRegFilterChanged('status',this.value)">
            ${['All', 'Draft', 'Open', 'Closed', 'Confirmed'].map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>From Date</label><input type="date" value="${f.from}" onchange="salesQtnRegFilterChanged('from',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>To Date</label><input type="date" value="${f.to}" onchange="salesQtnRegFilterChanged('to',this.value)"></div>
      </div>
      <div class="sales-field" style="margin-top:8px;margin-bottom:0;"><label>Select Salesman</label>
        <select onchange="salesQtnRegFilterChanged('salesPerson',this.value)">
          <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${f.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <p style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Legend: <span class="sales-pill draft">Draft</span> <span class="sales-pill open">Open</span> <span class="sales-pill confirmed">Confirmed</span> <span class="sales-pill closed">Closed</span></p>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${rows.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">No quotations match these filters.</p>` :
        `<table class="sales-items"><tr><th>#</th><th>Qtn No</th><th>Date</th><th>Confirmed Date</th><th>Client</th><th>Project</th><th>Salesman</th><th>Amount</th><th>Status</th></tr>
        ${rows.map((q, i) => {
          const totals = computeQuotationTotals(q);
          const enq = enquiries.find(e => e.id === q.enquiryId);
          return `<tr><td>${i + 1}</td><td>${esc(q.id)}</td><td>${q.date}</td><td>${q.confirmDate || '—'}</td><td>${esc(custName(q.customerId))}</td><td>${esc(q.projectName)}</td><td>${esc(enq ? enq.salesPerson : '—')}</td><td>BD ${totals.netTotal.toFixed(3)}</td><td><span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span></td></tr>`;
        }).join('')}
        </table>`}
    </div>`;
}
