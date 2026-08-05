// ══════════════════════════════════════════
// VEHICLE FLEET INSPECTOR + DELIVERY/SCHEDULING (Milestone E, 5 Aug
// 2026, role-based access rollout)
// Two entirely new, minimally-scoped modules — see the design note on
// vehicles[]/vehicleInspections[]/deliverySchedule[] in data.js for why
// each is shaped the way it is (no live Q-Pro trace exists for either,
// unlike most of this app). Kept in one file since both are small;
// each has its own module-wrap, following the same
// openXModule/closeXModule/launchXModule pattern as every other module.
// ══════════════════════════════════════════

// ── shared style ──
const fleetDeliveryStyleTag = document.createElement('style');
fleetDeliveryStyleTag.textContent = `
#fleet-module-wrap, #delivery-sched-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#fleet-module-wrap .ops-header, #delivery-sched-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#fleet-module-wrap .fleet-scroll, #delivery-sched-module-wrap .fleet-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#fleet-module-wrap .sales-kpi-grid, #delivery-sched-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
#fleet-module-wrap .sales-kpi-tile, #delivery-sched-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#fleet-module-wrap .sales-kpi-tile .num, #delivery-sched-module-wrap .sales-kpi-tile .num{font-size:19px;font-weight:700;color:var(--biz-primary);}
#fleet-module-wrap .sales-kpi-tile .lbl, #delivery-sched-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#fleet-module-wrap .sales-card, #delivery-sched-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#fleet-module-wrap .sales-back, #delivery-sched-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#fleet-module-wrap table.sales-items, #delivery-sched-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#fleet-module-wrap table.sales-items th, #delivery-sched-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#fleet-module-wrap table.sales-items td, #delivery-sched-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#fleet-module-wrap .field, #delivery-sched-module-wrap .field{margin-bottom:10px;}
#fleet-module-wrap .field label, #delivery-sched-module-wrap .field label{display:block;font-size:11px;font-weight:600;color:var(--biz-text-muted);margin-bottom:4px;}
#fleet-module-wrap .field input, #fleet-module-wrap .field select, #delivery-sched-module-wrap .field input, #delivery-sched-module-wrap .field select{width:100%;padding:9px 10px;border:1px solid var(--biz-border-light);border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;}
#fleet-module-wrap button.primary, #delivery-sched-module-wrap button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
#fleet-module-wrap button.secondary, #delivery-sched-module-wrap button.secondary{background:var(--biz-input-bg);color:var(--biz-text-muted);border:1px solid var(--biz-border-light);border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
`;
document.head.appendChild(fleetDeliveryStyleTag);

function fdEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function fdToast(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  window.alert(msg);
}

// ══════════════════════════════════════════
// VEHICLE FLEET INSPECTOR
// ══════════════════════════════════════════
const fleetModuleWrap = document.createElement('div');
fleetModuleWrap.id = 'fleet-module-wrap';
fleetModuleWrap.style.cssText = 'display:none;';
fleetModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🚚</span>
      <div><div style="color:#fff;font-weight:700;font-size:15px;">Vehicle Fleet</div><div style="color:rgba(255,255,255,.7);font-size:11px;">Inspections &amp; roadworthiness</div></div>
    </div>
    <button onclick="closeFleetModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="fleet-scroll"><div id="fleet-body"></div></div>
`;
document.body.appendChild(fleetModuleWrap);

let fleetView = 'list'; // list | detail | new-vehicle | new-inspection
let fleetActiveVehicleId = null;
const ALL_MODULE_WRAP_IDS = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap'];

function openFleetModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ALL_MODULE_WRAP_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  fleetModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  fleetView = 'list';
  fleetActiveVehicleId = null;
  renderFleetBody();
}
function closeFleetModule() {
  fleetModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchFleetModule() { openFleetModule(); }

function renderFleetBody() {
  const body = document.getElementById('fleet-body');
  if (!body) return;
  if (fleetView === 'detail') { body.innerHTML = renderFleetVehicleDetail(); return; }
  if (fleetView === 'new-vehicle') { body.innerHTML = renderFleetNewVehicleForm(); return; }
  if (fleetView === 'new-inspection') { body.innerHTML = renderFleetNewInspectionForm(); return; }
  body.innerHTML = renderFleetList();
}

function renderFleetList() {
  const k = getVehicleFleetKPIs();
  const rows = vehicles.map(v => {
    const last = getLatestInspection(v.id);
    const overdue = isInspectionOverdue(v.id);
    const badge = !last ? `<span class="pill grey">Never inspected</span>`
      : last.overallStatus === 'fail' ? `<span class="pill bad">Failed ${fdEsc(last.date)}</span>`
      : overdue ? `<span class="pill warn">Overdue (last ${fdEsc(last.date)})</span>`
      : `<span class="pill ok">Passed ${fdEsc(last.date)}</span>`;
    return `<tr style="cursor:pointer;" onclick="fleetOpenVehicle('${v.id}')">
      <td>${fdEsc(v.plateNumber)}<br><span style="color:#94a3b8;font-size:10.5px;">${fdEsc(v.make)} ${fdEsc(v.model)}</span></td>
      <td>${fdEsc(v.type)}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">${k.total}</div><div class="lbl">Total Vehicles</div></div>
      <div class="sales-kpi-tile"><div class="num" style="${k.overdue ? 'color:var(--warn,#c47d00);' : ''}">${k.overdue}</div><div class="lbl">Overdue</div></div>
      <div class="sales-kpi-tile"><div class="num" style="${k.failedLast ? 'color:var(--bad,#d9342b);' : ''}">${k.failedLast}</div><div class="lbl">Failed Last</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.active}</div><div class="lbl">Active</div></div>
    </div>
    <div class="sales-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <p style="font-weight:700;font-size:13px;margin:0;">Fleet</p>
        <button class="secondary" style="font-size:11.5px;padding:6px 12px;" onclick="fleetView='new-vehicle';renderFleetBody();">+ Add Vehicle</button>
      </div>
      ${vehicles.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">No vehicles yet.</p>` : `<table class="sales-items"><tr><th>Vehicle</th><th>Type</th><th>Inspection</th></tr>${rows}</table>`}
    </div>`;
}

function fleetOpenVehicle(id) { fleetActiveVehicleId = id; fleetView = 'detail'; renderFleetBody(); }

function renderFleetVehicleDetail() {
  const v = vehicles.find(x => x.id === fleetActiveVehicleId);
  if (!v) return `<p>Vehicle not found.</p>`;
  const history = getInspectionsForVehicle(v.id);
  return `
    <span class="sales-back" onclick="fleetView='list';renderFleetBody();">‹ Back to Fleet</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">${fdEsc(v.plateNumber)}</p>
      <p style="font-size:12px;color:#94a3b8;">${fdEsc(v.make)} ${fdEsc(v.model)} · ${fdEsc(v.type)} · ${fdEsc(v.status)}</p>
      <button class="primary" style="font-size:12px;margin-top:8px;" onclick="fleetView='new-inspection';renderFleetBody();">+ New Inspection</button>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Inspection History</p>
      ${history.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">No inspections recorded yet.</p>` : history.map(i => `
        <div style="padding:8px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:12.5px;font-weight:600;">${fdEsc(i.date)} — ${fdEsc(i.inspectedBy)}</span>
            <span class="pill ${i.overallStatus === 'pass' ? 'ok' : 'bad'}">${i.overallStatus === 'pass' ? 'Passed' : 'Failed'}</span>
          </div>
          ${i.checklist.filter(c => !c.pass).map(c => `<p style="font-size:11px;color:var(--bad,#d9342b);margin:2px 0 0;">✕ ${fdEsc(c.item)}${c.notes ? ' — ' + fdEsc(c.notes) : ''}</p>`).join('')}
        </div>`).join('')}
    </div>`;
}

function renderFleetNewVehicleForm() {
  return `
    <span class="sales-back" onclick="fleetView='list';renderFleetBody();">‹ Back to Fleet</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:10px;">Add Vehicle</p>
      <div class="field"><label>Plate Number</label><input id="fleet-new-plate" type="text"></div>
      <div class="field"><label>Make</label><input id="fleet-new-make" type="text"></div>
      <div class="field"><label>Model</label><input id="fleet-new-model" type="text"></div>
      <div class="field"><label>Type</label><select id="fleet-new-type"><option>Van</option><option>Truck</option><option>Pickup</option><option>Car</option></select></div>
      <button class="primary" onclick="fleetSubmitNewVehicle()">Save Vehicle</button>
    </div>`;
}
function fleetSubmitNewVehicle() {
  const plateNumber = document.getElementById('fleet-new-plate').value;
  const make = document.getElementById('fleet-new-make').value;
  const model = document.getElementById('fleet-new-model').value;
  const type = document.getElementById('fleet-new-type').value;
  const result = addVehicle({ plateNumber, make, model, type });
  if (result.error) { fdToast(result.error); return; }
  fleetView = 'list';
  renderFleetBody();
}

function renderFleetNewInspectionForm() {
  const v = vehicles.find(x => x.id === fleetActiveVehicleId);
  if (!v) return `<p>Vehicle not found.</p>`;
  return `
    <span class="sales-back" onclick="fleetView='detail';renderFleetBody();">‹ Back to ${fdEsc(v.plateNumber)}</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:10px;">New Inspection — ${fdEsc(v.plateNumber)}</p>
      ${VEHICLE_INSPECTION_CHECKLIST_ITEMS.map((item, i) => `
        <div class="field">
          <label>${fdEsc(item)}</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="fleet-insp-pass-${i}" style="flex:1;"><option value="pass">Pass</option><option value="fail">Fail</option></select>
            <input id="fleet-insp-notes-${i}" type="text" placeholder="Notes (if fail)" style="flex:2;">
          </div>
        </div>`).join('')}
      <button class="primary" onclick="fleetSubmitInspection()">Submit Inspection</button>
    </div>`;
}
function fleetSubmitInspection() {
  const checklist = VEHICLE_INSPECTION_CHECKLIST_ITEMS.map((item, i) => ({
    item, pass: document.getElementById(`fleet-insp-pass-${i}`).value === 'pass',
    notes: document.getElementById(`fleet-insp-notes-${i}`).value || ''
  }));
  const result = recordVehicleInspection(fleetActiveVehicleId, checklist, window.cloudIdentity || 'Vehicle Fleet Inspector');
  if (result.error) { fdToast(result.error); return; }
  fdToast(result.overallStatus === 'pass' ? '✓ Inspection passed.' : '⚠ Inspection failed — see history for details.');
  fleetView = 'detail';
  renderFleetBody();
}

// ══════════════════════════════════════════
// DELIVERY / SCHEDULING
// ══════════════════════════════════════════
const deliverySchedModuleWrap = document.createElement('div');
deliverySchedModuleWrap.id = 'delivery-sched-module-wrap';
deliverySchedModuleWrap.style.cssText = 'display:none;';
deliverySchedModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">📅</span>
      <div><div style="color:#fff;font-weight:700;font-size:15px;">Delivery / Scheduling</div><div style="color:rgba(255,255,255,.7);font-size:11px;">Plan &amp; track job deliveries</div></div>
    </div>
    <button onclick="closeDeliverySchedModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="fleet-scroll"><div id="delivery-sched-body"></div></div>
`;
document.body.appendChild(deliverySchedModuleWrap);

let deliverySchedView = 'list'; // list | new-schedule
let deliverySchedActiveJobId = null;

function openDeliverySchedModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ALL_MODULE_WRAP_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  deliverySchedModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  deliverySchedView = 'list';
  renderDeliverySchedBody();
}
function closeDeliverySchedModule() {
  deliverySchedModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchDeliverySchedModule() { openDeliverySchedModule(); }

function renderDeliverySchedBody() {
  const body = document.getElementById('delivery-sched-body');
  if (!body) return;
  if (deliverySchedView === 'new-schedule') { body.innerHTML = renderNewScheduleForm(); return; }
  body.innerHTML = renderDeliverySchedList();
}

function renderDeliverySchedList() {
  const needsScheduling = getJobsNeedingDeliveryScheduling();
  const schedule = getDeliverySchedule();
  const planned = schedule.filter(s => s.status === 'planned').length;
  const completed = schedule.filter(s => s.status === 'completed').length;
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">${needsScheduling.length}</div><div class="lbl">Needs Scheduling</div></div>
      <div class="sales-kpi-tile"><div class="num">${planned}</div><div class="lbl">Planned</div></div>
      <div class="sales-kpi-tile"><div class="num">${completed}</div><div class="lbl">Completed</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Jobs needing scheduling</p>
      ${needsScheduling.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">Nothing pending — every routed job is either fully delivered or already scheduled.</p>` : needsScheduling.map(j => {
        const c = customers.find(x => x.id === j.customerId);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
          <div><p style="font-size:12.5px;font-weight:600;margin:0;">${fdEsc(j.id)}</p><p style="font-size:10.5px;color:#94a3b8;margin:0;">${fdEsc(c ? c.name : '—')}</p></div>
          <button class="secondary" style="font-size:11px;padding:6px 10px;" onclick="deliverySchedOpenNewSchedule('${j.id}')">Schedule →</button>
        </div>`;
      }).join('')}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Delivery schedule</p>
      ${schedule.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">No deliveries scheduled yet.</p>` : `<table class="sales-items"><tr><th>Job</th><th>Date</th><th>Driver</th><th>Status</th><th>Action</th></tr>${schedule.map(s => `
        <tr>
          <td>${fdEsc(s.jobId)}</td>
          <td>${fdEsc(s.plannedDate)}</td>
          <td>${fdEsc(s.driver || '—')}</td>
          <td><span class="pill ${s.status === 'completed' ? 'ok' : s.status === 'cancelled' ? 'bad' : 'info'}">${fdEsc(s.status)}</span></td>
          <td>${s.status === 'planned' ? `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deliverySchedMark('${s.id}','completed')">Delivered</button> <button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#b91c1c;" onclick="deliverySchedMark('${s.id}','cancelled')">Cancel</button>` : ''}</td>
        </tr>`).join('')}</table>`}
    </div>`;
}

function deliverySchedOpenNewSchedule(jobId) { deliverySchedActiveJobId = jobId; deliverySchedView = 'new-schedule'; renderDeliverySchedBody(); }

function renderNewScheduleForm() {
  const job = getJobCard(deliverySchedActiveJobId);
  if (!job) return `<p>Job not found.</p>`;
  const vehicleOptions = vehicles.map(v => `<option value="${fdEsc(v.id)}">${fdEsc(v.plateNumber)}</option>`).join('');
  return `
    <span class="sales-back" onclick="deliverySchedView='list';renderDeliverySchedBody();">‹ Back to Schedule</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:10px;">Schedule Delivery — ${fdEsc(job.id)}</p>
      <div class="field"><label>Planned Date</label><input id="ds-new-date" type="date"></div>
      <div class="field"><label>Driver</label><input id="ds-new-driver" type="text"></div>
      <div class="field"><label>Vehicle (optional)</label><select id="ds-new-vehicle"><option value="">— None —</option>${vehicleOptions}</select></div>
      <div class="field"><label>Notes</label><input id="ds-new-notes" type="text"></div>
      <button class="primary" onclick="deliverySchedSubmit()">Save Schedule</button>
    </div>`;
}
function deliverySchedSubmit() {
  const plannedDate = document.getElementById('ds-new-date').value;
  const driver = document.getElementById('ds-new-driver').value;
  const vehicleId = document.getElementById('ds-new-vehicle').value || null;
  const notes = document.getElementById('ds-new-notes').value;
  const result = scheduleDelivery(deliverySchedActiveJobId, { plannedDate, driver, vehicleId, notes });
  if (result.error) { fdToast(result.error); return; }
  deliverySchedView = 'list';
  renderDeliverySchedBody();
}
function deliverySchedMark(id, status) {
  const result = markDeliveryScheduleStatus(id, status);
  if (result.error) { fdToast(result.error); return; }
  renderDeliverySchedBody();
}
