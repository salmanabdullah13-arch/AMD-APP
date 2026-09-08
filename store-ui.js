// ══════════════════════════════════════════
// 18a STORE KEEPER — the interface (Salman, 6 Sep 2026).
//
// The data layer landed 19 Aug: locations, bins keyed per store, lots,
// reservations with derived held/free, the hard job gate on every issue,
// transfers, returns, tool loans and counts — all live on the project with
// server-side triggers. The SCREENS were never built, so the storekeeper
// still landed on the legacy stock-pool dashboard and could not reach any
// of it. The design scorecard called this the largest single gap in the
// app. This is that interface, recreated in this codebase's idiom (the
// package's own README: its prototype is a design reference, not code to
// copy) and sharing 17a Purchase's shell, page and form templates exactly
// as the package instructs.
//
// The module's three commitments, carried in the UI because the data layer
// already carries them:
//   • Where it is comes before what it is — every line leads with its bin,
//     and a bin is always qualified by its store (A1 in Riffa is not A1 in
//     Tubli).
//   • On hand, Held and Free are three different numbers. Free is the only
//     one you can give somebody, and when it is zero the row says what is
//     waiting on it rather than showing a dash.
//   • No job card, no material. The issue form's gate cannot be overridden
//     and refuses "general use" however it is typed.
//
// Cover mode is the module's own idea: when the storekeeper is away,
// every line shows what it looks like and exactly where it sits, so
// somebody who does not know the store can still run it.
// ══════════════════════════════════════════

const stkModuleWrap = document.createElement('div');
stkModuleWrap.id = 'store-module-wrap';
stkModuleWrap.className = 'xshell';   // execThemeApply() toggles .x-dark on .xshell — without it the module never goes dark
stkModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(stkModuleWrap);

const STK_OTHER_WRAPS = ['sales-module-wrap', 'accounts-module-wrap', 'jobs-module-wrap', 'hr-module-wrap', 'estimator-module-wrap',
  'approver-module-wrap', 'purch-module-wrap', 'sk-module-wrap', 'curt-module-wrap', 'ops-module-wrap', 'owner-module-wrap',
  'admin-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'uph-module-wrap', 'painting-module-wrap',
  'prd-module-wrap', 'timer-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap'];

function openStoreModule(initialPage) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  STK_OTHER_WRAPS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  stkModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  stkBuildShell();
  execSetContext('store', 'renderStoreBody');
  execThemeApply();
  StoreUI.reset();
  if (initialPage) StoreUI.go('page', initialPage);
  renderStoreBody();
  execMarkActive(StoreUI.state.view === 'dash' ? 'stk-dash' : 'stk-' + StoreUI.state.page);
  execRefreshBadges();
}
function closeStoreModule() { closeModuleWrap(stkModuleWrap, 'launchStoreModule'); }
function launchStoreModule() { openStoreModule(); }
function renderStoreBody() {
  const el = document.getElementById('store-body');
  if (el && typeof StoreUI !== 'undefined') StoreUI.mount(el);
}

// The rail — the package's own order, labels, icons and count tones.
function stkBuildShell() {
  const cnt = (fn) => { try { const n = fn(); return n > 0 ? n : ''; } catch (e) { return ''; } };
  stkModuleWrap.innerHTML = execShellHTML({
    title: 'Store', sub: null, role: 'Storekeeper',
    contentId: 'store-body', closeFn: 'closeStoreModule',
    navGroups: [{
      label: 'Workspace', items: [
        nv('stk-dash', '▤', 'Dashboard', "StoreUI.go('dash','stk')"),
        nv('stk-stk', '◱', 'Stock on hand', "StoreUI.go('page','stk')", cnt(() => getStockRows(r => r.free <= 0).length)),
        nv('stk-iss', '⇢', 'Issue to job', "StoreUI.go('page','iss')", cnt(() => stkQueueISS().length)),
        nv('stk-rec', '⇠', 'Receiving', "StoreUI.go('page','rec')", cnt(() => stkQueueREC().length)),
        nv('stk-res', '◷', 'Reservations', "StoreUI.go('page','res')", cnt(() => stkQueueRES().length)),
        nv('stk-short', '!', 'Shorts', "StoreUI.go('page','short')", cnt(() => stkQueueSHORT().length)),
        nv('stk-trf', '⇄', 'Transfers', "StoreUI.go('page','trf')", cnt(() => storeTransfers.filter(t => t.status === 'in-transit').length)),
        nv('stk-ret', '↩', 'Returns to store', "StoreUI.go('page','ret')", cnt(() => storeReturns.length)),
        nv('stk-loc', '▦', 'Locations & bins', "StoreUI.go('page','loc')", cnt(() => storeBins.filter(b => !b.lastCheckedDate).length)),
        nv('stk-tool', '⚒', 'Tools on loan', "StoreUI.go('page','tool')", cnt(() => getOverdueTools().length)),
        nv('stk-cnt', '✓', 'Stock count', "StoreUI.go('page','cnt')", cnt(() => stockCounts.filter(c => c.status === 'open').length)),
        nv('stk-rem', '⏱', 'Reminders', "StoreUI.go('page','rem')", cnt(() => stkReminders().length)),
        nv('stk-doc', '▩', 'Documents', "StoreUI.go('page','doc')", cnt(() => stkDocuments().filter(d => d.tone === 'bad').length)),
        nv('stk-create', '＋', 'Create…', "StoreUI.go('form','iss')")
      ]
    }]
  });
}

// Reminders and Documents are derived, like Production's — the store's own
// dated promises, and the paper each movement is still missing.
function stkReminders() {
  const out = [], today = storeToday();
  getStaleReservations().forEach(r => {
    const item = itemMaster.find(i => i.id === r.itemId);
    out.push({ what: 'Hold on ' + ((item && item.name) || r.itemId) + ' is ' + reservationState(r, today),
      against: r.jobCardId || '—', who: 'Production', due: r.heldSince || '', tone: reservationState(r, today) === 'expired' ? 'bad' : 'warn',
      status: reservationState(r, today) === 'expired' ? 'Expired' : 'Going stale' });
  });
  getOverdueTools().forEach(l => out.push({ what: l.toolName + ' is overdue back', against: l.site || '—', who: l.withWhom || '—',
    due: l.dueBack || '', tone: 'bad', status: 'Overdue' }));
  stkQueuePUT().forEach(p => out.push({ what: 'Put away ' + (p.line.name || p.line.itemName || 'a delivered line'), against: p.grn.id,
    who: 'Store', due: p.grn.date || '', tone: 'warn', status: 'Waiting on a bin' }));
  // Reorder alerts belong here rather than on the legacy stock-pool screen:
  // an item at or below its reorder level, or with demand it cannot cover,
  // is the storekeeper's to act on, and this is where they work now.
  // Plain try/catch, not the module's own safe(): that helper lives inside
  // the StoreUI closure and this function sits outside it.
  let reorder = [];
  try { reorder = getReorderAlerts() || []; } catch (e) { reorder = []; }
  reorder.forEach(r => {
    const item = itemMaster.find(i => i.id === r.itemId);
    const name = (item && item.name) || r.itemName || r.itemId;
    out.push({ what: r.reqQty > 0 ? name + ' is short ' + r.reqQty + ' against open jobs' : name + ' is at its reorder level',
      against: 'Stock', who: 'Purchase', due: '', tone: r.reqQty > 0 ? 'bad' : 'warn',
      status: r.reqQty > 0 ? 'Short' : 'Low stock' });
  });
  return out;
}
function stkDocuments() {
  const out = [];
  storeIssues.forEach(i => out.push({ doc: 'Issue slip ' + i.id, against: i.jobCardId, type: 'Issue', filed: i.date,
    tone: i.signedBy ? 'ok' : 'bad', status: i.signedBy ? 'Signed by ' + i.signedBy : 'Not signed' }));
  storeTransfers.forEach(t => out.push({ doc: 'Movement note ' + t.id, against: (t.fromStoreId || '') + ' → ' + (t.toStoreId || ''),
    type: 'Transfer', filed: t.date, tone: t.status === 'received' ? 'ok' : 'warn', status: t.status === 'received' ? 'Received' : 'In transit' }));
  storeReturns.forEach(r => out.push({ doc: 'Return note ' + r.id, against: r.jobCardId || '—', type: 'Return', filed: r.date, tone: 'ok', status: 'Filed' }));
  stockCounts.forEach(c => out.push({ doc: 'Count sheet ' + c.id, against: c.area || '—', type: 'Count', filed: c.date,
    tone: c.status === 'closed' ? 'ok' : 'warn', status: c.status === 'closed' ? 'Closed' : 'Open' }));
  return out.sort((a, b) => String(b.filed).localeCompare(String(a.filed)));
}

window.StoreUI = (function () {
  const S = { view: 'dash', page: 'stk', step: 'iss', form: 'iss', ticks: {}, chip: 0, gate: null, formJob: '', formBin: '', formItem: '', toast: '' };
  let root = null;
  const esc = (s) => (s === null || s === undefined) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safe = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const qty = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toString();

  /* ── the day, in the order it runs ── */
  const STEPS = [
    { k: 'rec', label: 'Receive what arrived', sub: 'check it before you sign', q: () => safe(stkQueueREC, []) },
    { k: 'iss', label: 'Issue against job cards', sub: 'no job card, no material', q: () => safe(stkQueueISS, []) },
    { k: 'res', label: 'Reserved, not collected', sub: 'holds older than three days freeze good stock', q: () => safe(stkQueueRES, []) },
    { k: 'short', label: 'Short before the job starts', sub: 'a job cannot start without its material', q: () => safe(stkQueueSHORT, []) },
    { k: 'put', label: 'Put away and fix locations', sub: 'a line with no bin is stock nobody can find', q: () => safe(stkQueuePUT, []) }
  ];
  // The signature line table: the widths never change, the headings do.
  const HEADS = {
    rec: ['Item', 'Put it in', 'Ordered', 'Arrived'],
    iss: ['Item', 'Where it is', 'Need', 'Free'],
    res: ['Held for', 'Where it is', 'Qty', 'Age'],
    short: ['Item', 'Where it is', 'Needed', 'Free'],
    put: ['Item', 'System says', 'Actually in', 'Qty']
  };
  function stepLines(k) {
    const cover = safe(() => coverModeOn(), false);
    if (k === 'iss') return safe(stkQueueISS, []).slice(0, 12).map(r => {
      const free = safe(() => stockFree(r.itemId, null), 0);
      return { id: r.id, name: r.itemName || r.name || '', where: safe(() => { const rows = getStockRows(x => x.itemId === r.itemId && x.free > 0); return rows.length ? rows[0].where : 'Not in any bin'; }, '—'),
        hint: cover ? safe(() => { const rows = getStockRows(x => x.itemId === r.itemId && x.free > 0); return rows.length ? rows[0].hint : ''; }, '') : '',
        c3: qty(r.qty), c4: qty(free), tone: free <= 0 ? 'bad' : (free < (Number(r.qty) || 0) ? 'warn' : 'ok'),
        sub: r.jobId ? 'for ' + r.jobId : '' };
    });
    if (k === 'rec') return safe(stkQueuePUT, []).slice(0, 12).map(p => ({ id: p.grn.id + ':' + p.lineIndex,
      name: p.line.name || p.line.itemName || '', where: 'No bin yet', hint: '', c3: qty(p.line.orderedQty), c4: qty(p.line.receivedQty),
      tone: (Number(p.line.receivedQty) || 0) < (Number(p.line.orderedQty) || 0) ? 'warn' : 'ok', sub: 'on ' + p.grn.id }));
    if (k === 'res') return safe(stkQueueRES, []).slice(0, 12).map(r => {
      const item = itemMaster.find(i => i.id === r.itemId);
      return { id: r.id, name: (item && item.name) || r.itemId, where: safe(() => binLabel(r.binId), '—'), hint: cover ? safe(() => binHint(r.binId), '') : '',
        c3: qty(r.qty), c4: safe(() => storeDaysBetween(r.heldSince, storeToday()), 0) + 'd',
        tone: safe(() => reservationState(r, storeToday()), '') === 'expired' ? 'bad' : 'warn', sub: 'held for ' + (r.jobCardId || '—') };
    });
    if (k === 'short') return safe(stkQueueSHORT, []).slice(0, 12).map(r => ({ id: r.itemId + ':' + r.forJob, name: r.name,
      where: r.free > 0 ? safe(() => { const rows = getStockRows(x => x.itemId === r.itemId && x.free > 0); return rows.length ? rows[0].where : '—'; }, '—') : 'Nothing free',
      hint: '', c3: qty(r.needed), c4: qty(r.free), tone: 'bad', sub: r.why }));
    return safe(stkQueuePUT, []).slice(0, 12).map(p => ({ id: 'put:' + p.grn.id + ':' + p.lineIndex, name: p.line.name || p.line.itemName || '',
      where: 'No bin yet', hint: '', c3: qty(p.line.receivedQty), c4: qty(p.line.receivedQty), tone: 'warn', sub: 'from ' + p.grn.id }));
  }

  function dashHTML() {
    const k = safe(getStoreKPIs, {});
    const cover = safe(() => coverModeOn(), false);
    const step = STEPS.find(s => s.k === S.step) || STEPS[1];
    const lines = stepLines(S.step);
    const heads = HEADS[S.step];
    const chip = (n) => n > 0 ? `<span class="stk-chip on">${n}</span>` : `<span class="stk-chip clear">✓</span>`;
    return `<div class="stk-dash">
      <div class="stk-l">
        ${cover ? `<section class="stk-cover"><span class="stk-cover-g">◍</span><div>
          <div class="stk-cover-t">Cover mode — you are standing in for the storekeeper</div>
          <div class="stk-cover-s">Every line now shows what it looks like and exactly where it sits, so you do not have to know the store to run it. Turn it off when he is back.</div>
        </div><button class="stk-btn ghost" data-a="cover" data-v="off">Turn off</button></section>` : ''}
        <section class="stk-card">
          <div class="stk-t">Your day, in the order it runs</div>
          <div class="stk-steps">
            ${STEPS.map(s => `<button class="stk-step${S.step === s.k ? ' on' : ''}" data-a="step" data-v="${s.k}">
              ${chip(s.q().length)}<span class="stk-step-l">${esc(s.label)}</span><span class="stk-step-s">${esc(s.sub)}</span></button>`).join('')}
          </div>
        </section>
        <section class="stk-widget">
          <div class="stk-w-h"><div><div class="stk-w-t">${esc(step.label)}</div><div class="stk-w-s">${esc(step.sub)}</div></div>
            <span class="stk-w-n">${lines.length}</span></div>
          <div class="stk-w-b">
            ${lines.length ? `<div class="stk-lines">
              <div class="stk-lh"><span class="stk-tickcol"></span><span class="stk-c1">${esc(heads[0])}</span><span class="stk-c2">${esc(heads[1])}</span><span class="stk-c3">${esc(heads[2])}</span><span class="stk-c4">${esc(heads[3])}</span></div>
              ${lines.map(l => {
                const dead = l.tone === 'bad';
                const on = !!S.ticks[l.id];
                return `<div class="stk-ln${on ? ' on' : ''}">
                  <span class="stk-tick${dead ? ' dead' : ''}${on ? ' on' : ''}"${dead ? ' title="Nothing free — this line cannot be ticked"' : ` data-a="tick" data-v="${esc(l.id)}"`}>${on ? '✓' : ''}</span>
                  <span class="stk-c1"><span class="stk-n">${esc(l.name)}</span>${l.sub ? `<span class="stk-sub">${esc(l.sub)}</span>` : ''}${l.hint ? `<span class="stk-hint">${esc(l.hint)}</span>` : ''}</span>
                  <span class="stk-c2"><span class="stk-loc${dead ? ' bad' : ''}">${esc(l.where)}</span></span>
                  <span class="stk-c3">${esc(l.c3)}</span>
                  <span class="stk-c4 t-${l.tone}">${esc(l.c4)}</span></div>`;
              }).join('')}</div>`
              : `<div class="stk-empty">Nothing waiting here — that step is clear.</div>`}
          </div>
          <div class="stk-w-f">
            <button class="stk-btn" data-a="form" data-v="${S.step === 'rec' || S.step === 'put' ? 'rec' : S.step === 'res' ? 'res' : S.step === 'short' ? 'res' : 'iss'}">${S.step === 'rec' || S.step === 'put' ? 'Receive a delivery' : S.step === 'res' ? 'Reserve for a job' : S.step === 'short' ? 'Reserve what is free' : 'Issue material'}</button>
            <button class="stk-btn ghost" data-a="page" data-v="${S.step === 'put' ? 'rec' : S.step}">Open the full page ⤢</button>
          </div>
        </section>
      </div>
      <div class="stk-r">
        <section class="stk-card"><div class="stk-t">The store right now</div>
          <div class="stk-kpis">
            ${[['At the gate', k.atTheGate, 'warn'], ['Teams waiting', k.teamsWaiting, 'bad'], ['Stale holds', k.staleHolds, 'warn'],
               ['Shorts', k.shorts, 'bad'], ['Tools out', k.toolsOut, k.toolsOverdue ? 'bad' : 'ok'], ['Bins checked', (k.binsChecked || 0) + '/' + (k.binsTotal || 0), 'ok']]
              .map(x => `<div class="stk-kpi"><div class="stk-kpi-n t-${x[2]}">${esc(x[1] === undefined ? 0 : x[1])}</div><div class="stk-kpi-l">${esc(x[0])}</div></div>`).join('')}
          </div>
          ${!cover ? `<button class="stk-btn ghost" style="width:100%;margin-top:10px;" data-a="cover" data-v="on">Turn on cover mode</button>` : ''}
        </section>
        <section class="stk-card"><div class="stk-t">Where the stock sits</div>
          ${safe(getStoreSummaries, []).map(s => `<div class="stk-store"><span class="stk-store-n">${esc(s.name)}</span>
            <span class="stk-store-m">${esc(s.bins === undefined ? '' : s.bins + ' bins')}${s.lines !== undefined ? ' · ' + s.lines + ' lines' : ''}</span></div>`).join('')
            || '<div class="stk-empty-sm">No store has been set up yet — add one on Locations &amp; bins.</div>'}
        </section>
        ${safe(() => typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('store') : '', '')}
      </div>
    </div>`;
  }

  /* ── the twelve pages, one template ── */
  const PAGES = {
    stk: () => {
      const rows = getStockRows();
      const shortsBy = {}; safe(stkQueueSHORT, []).forEach(s => { shortsBy[s.itemId] = (shortsBy[s.itemId] || 0) + 1; });
      return { title: 'Stock on hand', sub: 'On hand is what exists. Held is what is spoken for. Free is the only number you can give somebody.',
        stats: [['Lines', rows.length], ['Nothing free', rows.filter(r => r.free <= 0).length, rows.filter(r => r.free <= 0).length ? 'bad' : 'ok'],
          ['Held', rows.reduce((s, r) => s + r.held, 0)], ['Bins in use', new Set(rows.map(r => r.binId)).size]],
        primary: ['＋ Issue to a job', 'iss'],
        cols: ['Item', 'Where it is', 'On hand', 'Held', 'Free'],
        rows: rows.map(r => ({ cells: [
            { main: r.name, sub: coverModeOn() ? r.hint : '' },
            { main: r.where, tag: true, tone: r.free <= 0 ? 'bad' : '' },
            { main: qty(r.onHand), n: true }, { main: qty(r.held), n: true },
            { main: qty(r.free), n: true, tone: r.free <= 0 ? 'bad' : 'ok',
              sub: r.free <= 0 ? (shortsBy[r.itemId] ? shortsBy[r.itemId] + (shortsBy[r.itemId] === 1 ? ' job waiting' : ' jobs waiting') : 'all of it is held') : '' }] })) };
    },
    iss: () => {
      const q = safe(stkQueueISS, []);
      return { title: 'Issue to job', sub: 'Every issue is booked against a job card. There is no general-use issue and no override.',
        stats: [['Requests open', q.length, q.length ? 'bad' : 'ok'], ['Issued today', storeIssues.filter(i => i.date === storeToday()).length],
          ['Issues on file', storeIssues.length], ['Unsigned', storeIssues.filter(i => !i.signedBy).length, storeIssues.filter(i => !i.signedBy).length ? 'warn' : 'ok']],
        primary: ['＋ Issue material', 'iss'],
        cols: ['Request', 'Job card', 'Wanted', 'Lines', 'Status'],
        rows: q.map(r => ({ cells: [{ main: r.itemName || r.name || r.id, sub: r.requestedBy ? 'asked by ' + r.requestedBy : '' },
          { main: r.jobId || '—', tag: true }, { main: r.neededBy || '—' }, { main: qty(r.qty), n: true },
          { main: 'Waiting', pill: 'warn' }] }))
          .concat(storeIssues.slice(-12).reverse().map(i => ({ cells: [{ main: i.id, sub: (i.lines || []).length + ' line(s)' },
            { main: i.jobCardId, tag: true }, { main: i.date }, { main: qty((i.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0)), n: true },
            { main: i.signedBy ? 'Signed' : 'Issued', pill: i.signedBy ? 'ok' : 'warn' }] }))) };
    },
    rec: () => {
      const put = safe(stkQueuePUT, []);
      return { title: 'Receiving', sub: 'What arrived, and what still has no bin. A line with no bin is stock nobody can find.',
        stats: [['Awaiting a bin', put.length, put.length ? 'warn' : 'ok'], ['At the gate', safe(() => stkQueueREC().length, 0)],
          ['Lots on the shelf', stockLots.filter(l => l.onHand > 0).length], ['Bins in use', new Set(stockLots.filter(l => l.onHand > 0).map(l => l.binId)).size]],
        primary: ['＋ Receive a delivery', 'rec'],
        cols: ['Delivery', 'Item', 'Ordered', 'Arrived', 'Status'],
        rows: put.map(p => ({ cells: [{ main: p.grn.id, sub: p.grn.date || '' }, { main: p.line.name || p.line.itemName || '' },
          { main: qty(p.line.orderedQty), n: true }, { main: qty(p.line.receivedQty), n: true },
          { main: 'Needs a bin', pill: 'warn' }] })) };
    },
    res: () => {
      const all = (typeof reservations !== 'undefined' ? reservations : []).filter(r => r.status === 'held');
      return { title: 'Reservations', sub: 'A hold takes stock out of Free. Holds older than three days go stale and freeze good material.',
        stats: [['Held now', all.length], ['Stale or expired', safe(() => stkQueueRES().length, 0), safe(() => stkQueueRES().length, 0) ? 'bad' : 'ok'],
          ['Jobs holding', new Set(all.map(r => r.jobCardId)).size], ['Qty held', all.reduce((s, r) => s + (Number(r.qty) || 0), 0)]],
        primary: ['＋ Reserve for a job', 'res'], secondary: ['Release lapsed holds', 'expire'],
        cols: ['Held for', 'Item', 'Where it is', 'Qty', 'Status'],
        rows: all.map(r => {
          const item = itemMaster.find(i => i.id === r.itemId);
          const st = safe(() => reservationState(r, storeToday()), 'held');
          return { cells: [{ main: r.jobCardId || '—', sub: 'since ' + (r.heldSince || '—') }, { main: (item && item.name) || r.itemId },
            { main: safe(() => binLabel(r.binId), '—'), tag: true }, { main: qty(r.qty), n: true },
            { main: st === 'expired' ? 'Expired' : st === 'stale' ? 'Going stale' : 'Held', pill: st === 'expired' ? 'bad' : st === 'stale' ? 'warn' : 'ok' }] };
        }) };
    },
    short: () => {
      const rows = safe(stkQueueSHORT, []);
      return { title: 'Shorts', sub: 'What a routed job needs and the store cannot cover. Every line here is a job that cannot start.',
        stats: [['Short lines', rows.length, rows.length ? 'bad' : 'ok'], ['Jobs affected', new Set(rows.map(r => r.forJob)).size],
          ['Nothing at all', rows.filter(r => r.free <= 0).length, rows.filter(r => r.free <= 0).length ? 'bad' : 'ok'],
          ['Partly covered', rows.filter(r => r.free > 0).length]],
        primary: ['Raise a purchase request', 'pr'],
        cols: ['Item', 'For', 'Needed', 'Free', 'Why'],
        rows: rows.map(r => ({ cells: [{ main: r.name }, { main: r.forJob, tag: true, sub: r.promisedDate ? 'promised ' + r.promisedDate : '' },
          { main: qty(r.needed), n: true }, { main: qty(r.free), n: true, tone: 'bad' }, { main: r.why, pill: 'bad' }] })) };
    },
    trf: () => ({ title: 'Transfers', sub: 'Stock moving between stores. It leaves the source the moment it is sent, and only lands when somebody receives it.',
      stats: [['In transit', storeTransfers.filter(t => t.status === 'in-transit').length, storeTransfers.filter(t => t.status === 'in-transit').length ? 'warn' : 'ok'],
        ['Received', storeTransfers.filter(t => t.status === 'received').length], ['Movements', storeTransfers.length], ['Stores', storeLocations.length]],
      primary: ['＋ New transfer', 'trf'],
      cols: ['Movement', 'From', 'To', 'Lines', 'Status'],
      rows: storeTransfers.slice().reverse().map(t => ({ cells: [{ main: t.id, sub: t.date || '' },
        { main: safe(() => (storeLocations.find(l => l.id === t.fromStoreId) || {}).name, t.fromStoreId) || '—', tag: true },
        { main: safe(() => (storeLocations.find(l => l.id === t.toStoreId) || {}).name, t.toStoreId) || '—', tag: true },
        { main: qty((t.lines || []).length), n: true },
        { main: t.status === 'received' ? 'Received' : 'In transit', pill: t.status === 'received' ? 'ok' : 'warn' }] })) }),
    ret: () => ({ title: 'Returns to store', sub: 'What came back off a job, and in what condition. Scrap never goes back on the shelf.',
      stats: [['Returns', storeReturns.length], ['Good back on the shelf', storeReturns.filter(r => r.condition === 'good').length],
        ['Scrapped', storeReturns.filter(r => r.condition === 'scrap').length, storeReturns.filter(r => r.condition === 'scrap').length ? 'warn' : 'ok'],
        ['Jobs returning', new Set(storeReturns.map(r => r.jobCardId)).size]],
      primary: ['＋ Book a return', 'ret'],
      cols: ['Item', 'Came back from', 'Qty', 'Condition', 'Status'],
      rows: storeReturns.slice().reverse().map(r => {
        const item = itemMaster.find(i => i.id === r.itemId);
        return { cells: [{ main: (item && item.name) || r.itemId }, { main: r.jobCardId || '—', tag: true }, { main: qty(r.qty), n: true },
          { main: r.condition === 'scrap' ? 'Scrap' : 'Good', tone: r.condition === 'scrap' ? 'bad' : '' },
          { main: r.condition === 'scrap' ? 'Written off' : 'Back in ' + safe(() => binLabel(r.binId), 'store'), pill: r.condition === 'scrap' ? 'warn' : 'ok' }] };
      }) }),
    loc: () => ({ title: 'Locations & bins', sub: 'The map. A bin is always read with its store — A1 in one store is not A1 in another.',
      stats: [['Stores', storeLocations.length], ['Bins', storeBins.length], ['Never checked', storeBins.filter(b => !b.lastCheckedDate).length, storeBins.filter(b => !b.lastCheckedDate).length ? 'warn' : 'ok'],
        ['Bins holding stock', new Set(stockLots.filter(l => l.onHand > 0).map(l => l.binId)).size]],
      primary: ['＋ Add a bin', 'bin'],
      cols: ['Bin', 'What lives here', 'Store', 'Lines', 'Checked'],
      rows: storeBins.map(b => {
        const lots = stockLots.filter(l => l.binId === b.id && l.onHand > 0);
        const dupe = storeBins.filter(x => x.storeId === b.storeId && x.code === b.code).length > 1;
        return { cells: [{ main: safe(() => binLabel(b.id), b.code), tone: dupe ? 'bad' : '', sub: dupe ? 'duplicate code in this store' : '' },
          { main: lots.length ? lots.map(l => (itemMaster.find(i => i.id === l.itemId) || {}).name || l.itemId).slice(0, 3).join(', ') : 'Empty',
            sub: safe(() => binHint(b.id), '') },
          { main: safe(() => (storeLocations.find(l => l.id === b.storeId) || {}).name, b.storeId) || '—', tag: true },
          { main: qty(lots.length), n: true },
          { main: b.lastCheckedDate || 'never', pill: b.lastCheckedDate ? 'ok' : 'warn' }] };
      }) }),
    tool: () => ({ title: 'Tools on loan', sub: 'Who has what, and since when. A tool nobody signed for is a tool nobody brings back.',
      stats: [['Out now', toolLoans.filter(l => l.status === 'out').length], ['Overdue', safe(() => getOverdueTools().length, 0), safe(() => getOverdueTools().length, 0) ? 'bad' : 'ok'],
        ['Returned', toolLoans.filter(l => l.status === 'returned').length], ['People holding', new Set(toolLoans.filter(l => l.status === 'out').map(l => l.withWhom)).size]],
      primary: ['＋ Book a tool out', 'tool'],
      cols: ['Tool', 'With', 'Site', 'Out since', 'Status'],
      rows: toolLoans.slice().reverse().map(l => {
        const over = safe(() => getOverdueTools().some(o => o.id === l.id), false);
        return { cells: [{ main: l.toolName }, { main: l.withWhom || '—', tag: true }, { main: l.site || '—' }, { main: l.outDate || '—' },
          { main: l.status === 'returned' ? 'Returned' : over ? 'Overdue' : 'Out', pill: l.status === 'returned' ? 'ok' : over ? 'bad' : 'warn' }] };
      }) }),
    cnt: () => ({ title: 'Stock count', sub: 'What the shelf actually holds against what the system says. Closing a count applies its variances.',
      stats: [['Counts', stockCounts.length], ['Open', stockCounts.filter(c => c.status === 'open').length, stockCounts.filter(c => c.status === 'open').length ? 'warn' : 'ok'],
        ['Closed', stockCounts.filter(c => c.status === 'closed').length],
        ['Variances found', stockCounts.reduce((s, c) => s + safe(() => countVariances(c.id).length, 0), 0)]],
      primary: ['＋ Start a count', 'cnt'],
      cols: ['Count', 'Area', 'Lines', 'Variances', 'Status'],
      rows: stockCounts.slice().reverse().map(c => ({ cells: [{ main: c.id, sub: c.date || '' }, { main: c.area || '—', tag: true },
        { main: qty((c.lines || []).length), n: true }, { main: qty(safe(() => countVariances(c.id).length, 0)), n: true, tone: safe(() => countVariances(c.id).length, 0) ? 'warn' : '' },
        { main: c.status === 'closed' ? 'Closed' : 'Open', pill: c.status === 'closed' ? 'ok' : 'warn' }] })) }),
    rem: () => {
      const rows = stkReminders();
      return { title: 'Reminders', sub: "The store's own list of dated promises from other people. Nothing here is automatic.",
        stats: [['Open', rows.length], ['Overdue', rows.filter(r => r.tone === 'bad').length, rows.filter(r => r.tone === 'bad').length ? 'bad' : 'ok'],
          ['Holds', rows.filter(r => /Hold/.test(r.what)).length], ['Tools', rows.filter(r => /overdue back/.test(r.what)).length]],
        cols: ['Reminder', 'Against', 'Who owes it', 'Due', 'Status'],
        rows: rows.map(r => ({ cells: [{ main: r.what }, { main: r.against, tag: true }, { main: r.who }, { main: r.due || '—' },
          { main: r.status, pill: r.tone }] })) };
    },
    doc: () => {
      const rows = stkDocuments();
      return { title: 'Documents', sub: 'Every movement and its paper. The status that matters is the absence — an issue nobody signed is material nobody can account for.',
        stats: [['On file', rows.length], ['Not signed', rows.filter(r => r.tone === 'bad').length, rows.filter(r => r.tone === 'bad').length ? 'bad' : 'ok'],
          ['Issues', rows.filter(r => r.type === 'Issue').length], ['Counts', rows.filter(r => r.type === 'Count').length]],
        cols: ['Document', 'Against', 'Type', 'Filed', 'Status'],
        rows: rows.map(r => ({ cells: [{ main: r.doc }, { main: r.against, tag: true }, { main: r.type }, { main: r.filed || '—' },
          { main: r.status, pill: r.tone }] })) };
    }
  };
  const PAGE_TITLES = { stk: 'Stock on hand', iss: 'Issue to job', rec: 'Receiving', res: 'Reservations', short: 'Shorts', trf: 'Transfers',
    ret: 'Returns to store', loc: 'Locations & bins', tool: 'Tools on loan', cnt: 'Stock count', rem: 'Reminders', doc: 'Documents' };

  function pageHTML() {
    const def = safe(() => (PAGES[S.page] || PAGES.stk)(), null);
    if (!def) return `<div class="stk-dash"><div class="stk-l"><section class="stk-card"><div class="stk-empty">This page could not be built from the current data.</div></section></div></div>`;
    return `<div class="stk-dash stk-page">
      <div class="stk-l">
        <div class="stk-page-h"><span class="stk-page-t">${esc(def.title)}</span></div>
        <div class="stk-page-s">${esc(def.sub)}</div>
        <div class="stk-stats">${(def.stats || []).map(s => `<div class="stk-stat"><div class="stk-stat-n t-${s[2] || ''}">${esc(s[1])}</div><div class="stk-stat-l">${esc(s[0])}</div></div>`).join('')}</div>
        <div class="stk-chips">
          ${def.primary ? `<button class="stk-btn" data-a="${def.primary[1] === 'pr' ? 'pr' : 'form'}" data-v="${esc(def.primary[1])}">${esc(def.primary[0])}</button>` : ''}
          ${def.secondary ? `<button class="stk-btn ghost" data-a="${esc(def.secondary[1])}">${esc(def.secondary[0])}</button>` : ''}
          <button class="stk-btn ghost" data-a="printpage">🖨 Print this page</button>
        </div>
        <section class="stk-card stk-tablecard">
          ${def.rows.length ? `<table class="stk-table"><tr>${def.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
            ${def.rows.map(r => `<tr>${r.cells.map(c => `<td class="${c.n ? 'n' : ''}">
              ${c.pill ? `<span class="stk-pill ${esc(c.pill)}">${esc(c.main)}</span>`
                : c.tag ? `<span class="stk-loc${c.tone === 'bad' ? ' bad' : ''}">${esc(c.main)}</span>`
                : `<span class="stk-cellmain${c.tone ? ' t-' + c.tone : ''}">${esc(c.main)}</span>`}
              ${c.sub ? `<span class="stk-sub">${esc(c.sub)}</span>` : ''}</td>`).join('')}</tr>`).join('')}
            </table>` : `<div class="stk-empty">Nothing on this page yet.</div>`}
        </section>
      </div>
      <div class="stk-r">
        <section class="stk-rule"><div class="stk-rule-t">Where it is comes before what it is</div>
          <div class="stk-rule-s">Nothing on this screen carries a price, a cost or a supplier value — the store works in quantities.</div></section>
        ${safe(() => typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('store') : '', '')}
      </div>
    </div>`;
  }

  /* ── the seven create flows ── */
  const FORMS = {
    iss: { title: 'Issue material to a job', gate: {
        q: 'Which job card is this material for?',
        opts: [['A job card, and the person collecting is named on it', 'ok'], ['A job card, but somebody else is collecting', 'warn'], ['General use — no job card', 'bad']],
        blocked: 'No job card, no material. There is no general-use issue and no override — every issue has to be traceable to the job it was for.' } },
    rec: { title: 'Receive a delivery and put it away', gate: {
        q: 'Has it been checked against the order?',
        opts: [['Checked, and it matches', 'ok'], ['Checked, and it is short or damaged', 'warn'], ['Not checked yet', 'bad']],
        blocked: 'Check it before you sign. Once it is booked in, a short delivery is our problem, not the supplier’s.' } },
    trf: { title: 'Transfer between stores', gate: {
        q: 'Is the stock free to move?',
        opts: [['Free — nothing is holding it', 'ok'], ['Some of it is held, and the job agrees', 'warn'], ['It is held for a job starting now', 'bad']],
        blocked: 'Held stock stays where the job that holds it can reach it. Release the hold first, or move something else.' } },
    res: { title: 'Reserve stock for a job', gate: {
        q: 'When does the job need it?',
        opts: [['Within three days', 'ok'], ['This week', 'warn'], ['No date yet', 'bad']],
        blocked: 'A hold with no date is how good stock freezes. Give it a date, or leave it free until the job is real.' } },
    ret: { title: 'Book a return into store', gate: {
        q: 'What condition did it come back in?',
        opts: [['Good — it goes back on the shelf', 'ok'], ['Usable offcut — label it', 'warn'], ['Scrap', 'bad']],
        blocked: 'Scrap never goes back on the shelf. Book it as scrap so the job keeps the cost and nobody issues it again.', allowBad: true } },
    tool: { title: 'Book a tool out', gate: {
        q: 'Who is taking it, and when is it back?',
        opts: [['Named person, with a date', 'ok'], ['Named person, no date yet', 'warn'], ['Nobody named', 'bad']],
        blocked: 'A tool nobody signed for is a tool nobody brings back. Name the person taking it.' } },
    cnt: { title: 'Start a stock count', gate: {
        q: 'Is the area quiet enough to count?',
        opts: [['Quiet — nothing moving in or out', 'ok'], ['Busy, but the lines are isolated', 'warn'], ['Issues are going out of it right now', 'bad']],
        blocked: 'Counting a bay while material leaves it produces a variance that is not real. Count it when it is quiet.' } },
    bin: { title: 'Add a bin', gate: {
        q: 'Which store is this bin in?',
        opts: [['A store already on the map', 'ok'], ['A new store — add it too', 'warn'], ['Not sure', 'bad']],
        blocked: 'A bin without a store is a code that means nothing — A1 in one store is not A1 in another.' } },
    pr: null
  };
  function formHTML() {
    const f = FORMS[S.form] || FORMS.iss;
    const tone = S.gate === null ? null : f.gate.opts[S.gate][1];
    const blocked = tone === 'bad' && !f.gate.allowBad;
    return `<div class="stk-dash stk-form">
      <div class="stk-l">
        <div class="stk-pills">${Object.keys(FORMS).filter(k => FORMS[k]).map(k => `<button class="stk-pill-b${S.form === k ? ' on' : ''}" data-a="form" data-v="${k}">${esc(FORMS[k].title.split(' ').slice(0, 3).join(' '))}</button>`).join('')}</div>
        <section class="stk-card"><div class="stk-t">${esc(f.title)}</div>
          <div class="stk-gate t-${tone || 'none'}">
            <div class="stk-gate-q">${esc(f.gate.q)}<span class="stk-gate-b">${S.gate === null ? '?' : tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '✕'}</span></div>
            ${f.gate.opts.map((o, i) => `<button class="stk-gate-o${S.gate === i ? ' on t-' + o[1] : ''}" data-a="gate" data-v="${i}">${esc(o[0])}</button>`).join('')}
            ${blocked ? `<div class="stk-blocked">${esc(f.gate.blocked)}</div>` : ''}
          </div>
          ${stkFormFields()}
          <div class="stk-actions">
            <button class="stk-btn${blocked || S.gate === null ? ' dead' : tone === 'warn' ? ' warn' : ''}"${blocked || S.gate === null ? ' disabled' : ` data-a="submit"`}>${esc(stkSubmitLabel())}</button>
            <button class="stk-btn ghost" data-a="page" data-v="${S.form === 'bin' ? 'loc' : S.form === 'cnt' ? 'cnt' : S.form}">Cancel</button>
          </div>
          ${S.toast ? `<div class="stk-toast">${esc(S.toast)}</div>` : ''}
        </section>
      </div>
      <div class="stk-r">
        <section class="stk-rule"><div class="stk-rule-t">Where it is comes before what it is</div>
          <div class="stk-rule-s">Nothing on this screen carries a price, a cost or a supplier value — the store works in quantities.</div></section>
        ${S.form === 'iss' ? `<section class="stk-card"><div class="stk-t">What this job already holds</div>
          ${S.formJob ? (safe(() => (typeof reservations !== 'undefined' ? reservations : []).filter(r => r.jobCardId === S.formJob && r.status === 'held'), []).map(r => {
            const item = itemMaster.find(i => i.id === r.itemId);
            return `<div class="stk-store"><span class="stk-store-n">${esc((item && item.name) || r.itemId)}</span><span class="stk-store-m">${qty(r.qty)} · ${esc(safe(() => binLabel(r.binId), '—'))}</span></div>`;
          }).join('') || '<div class="stk-empty-sm">Nothing held for this job.</div>') : '<div class="stk-empty-sm">Pick a job card to see what it already holds.</div>'}
        </section>` : ''}
      </div>
    </div>`;
  }
  function stkSubmitLabel() {
    return { iss: 'Issue it', rec: 'Book it in', trf: 'Send it', res: 'Hold it', ret: 'Book the return', tool: 'Book it out', cnt: 'Start the count', bin: 'Add the bin' }[S.form] || 'Save';
  }
  function stkFormFields() {
    const jobs = (typeof jobCards !== 'undefined' ? jobCards : []).filter(j => j.status !== 'cancelled' && j.routingConfirmed);
    const jobSel = `<label class="stk-f"><span>Job card</span><select data-a-input="job"><option value="">Choose…</option>${jobs.map(j => `<option value="${esc(j.id)}"${S.formJob === j.id ? ' selected' : ''}>${esc(j.id)} — ${esc(j.projectName || '')}</option>`).join('')}</select></label>`;
    const binSel = `<label class="stk-f"><span>Bin</span><select data-a-input="bin"><option value="">Choose…</option>${storeBins.map(b => `<option value="${esc(b.id)}"${S.formBin === b.id ? ' selected' : ''}>${esc(safe(() => binLabel(b.id), b.code))}</option>`).join('')}</select></label>`;
    const itemSel = `<label class="stk-f"><span>Item</span><select data-a-input="item"><option value="">Choose…</option>${itemMaster.slice(0, 400).map(i => `<option value="${esc(i.id)}"${S.formItem === i.id ? ' selected' : ''}>${esc(i.name)}</option>`).join('')}</select></label>`;
    const q = `<label class="stk-f"><span>Quantity</span><input type="number" min="0" step="0.001" data-a-input="qty" value="${esc(S.formQty || '')}"></label>`;
    const who = `<label class="stk-f"><span>Person</span><input type="text" data-a-input="who" value="${esc(S.formWho || '')}" placeholder="Who is collecting it"></label>`;
    /* Which LINE of the job. Without it an issue is job-level only, and the
       cost ledger cannot say which product the material went into — which is
       exactly what the owner reads the product P&L for. */
    const jobLines = ((typeof getJobCard === 'function' && S.formJob ? getJobCard(S.formJob) : null) || {}).items || [];
    const lineSel = jobLines.length
      ? `<label class="stk-f"><span>Job item</span><select data-a-input="line"><option value="">Choose…</option>${jobLines.map(l => `<option value="${l.lineId}"${String(S.formLine) === String(l.lineId) ? ' selected' : ''}>#${l.lineId} — ${esc(l.product || '')}</option>`).join('')}</select></label>`
      : '<label class="stk-f"><span>Job item</span><select data-a-input="line" disabled><option>Pick a job card first</option></select></label>';
    if (S.form === 'iss') return jobSel + lineSel + itemSel + binSel + q + who;
    if (S.form === 'rec') return itemSel + binSel + q;
    if (S.form === 'trf') return `<label class="stk-f"><span>From store</span><select data-a-input="from"><option value="">Choose…</option>${storeLocations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label>
      <label class="stk-f"><span>To store</span><select data-a-input="to"><option value="">Choose…</option>${storeLocations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label>` + itemSel + q;
    if (S.form === 'res') return jobSel + itemSel + q;
    if (S.form === 'ret') return jobSel + itemSel + binSel + q +
      `<label class="stk-f"><span>Condition</span><select data-a-input="cond"><option value="good">Good — back on the shelf</option><option value="offcut">Usable offcut</option><option value="scrap">Scrap</option></select></label>`;
    if (S.form === 'tool') return `<label class="stk-f"><span>Tool</span><input type="text" data-a-input="tool" value="${esc(S.formTool || '')}" placeholder="What is going out"></label>` + who +
      `<label class="stk-f"><span>Site</span><input type="text" data-a-input="site" value="${esc(S.formSite || '')}"></label>
       <label class="stk-f"><span>Back by</span><input type="date" data-a-input="due" value="${esc(S.formDue || '')}"></label>`;
    if (S.form === 'cnt') return `<label class="stk-f"><span>Area</span><input type="text" data-a-input="area" value="${esc(S.formArea || '')}" placeholder="Which bay or aisle"></label>`;
    if (S.form === 'bin') return `<label class="stk-f"><span>Store</span><select data-a-input="store"><option value="">Choose…</option>${storeLocations.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label>
      <label class="stk-f"><span>Bin code</span><input type="text" data-a-input="code" value="${esc(S.formCode || '')}" placeholder="A1"></label>
      <label class="stk-f"><span>What lives here</span><input type="text" data-a-input="hint" value="${esc(S.formHint || '')}" placeholder="Board racks, left of the saw"></label>`;
    return '';
  }

  function submit() {
    const done = (msg) => { S.toast = msg; paint(); };
    const fail = (r) => { S.toast = (r && r.error) || 'That did not go through.'; paint(); return true; };
    if (S.form === 'iss') {
      const r = safe(() => issueMaterialToJob({ jobCardId: S.formJob,
        // lineId is what lets the cost ledger say which product this went into.
        lines: [{ itemId: S.formItem, binId: S.formBin, qty: Number(S.formQty) || 0, lineId: S.formLine || null }],
        issuedTo: S.formWho, byWhom: 'Storekeeper' }), { error: 'Issue failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Issued against ' + S.formJob + '.');
    }
    if (S.form === 'rec') {
      const r = safe(() => putAwayStock({ itemId: S.formItem, binId: S.formBin, qty: Number(S.formQty) || 0 }), { error: 'Put-away failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Booked in and put away.');
    }
    if (S.form === 'res') {
      const r = safe(() => reserveStockForJob({ jobCardId: S.formJob, itemId: S.formItem, qty: Number(S.formQty) || 0, byWhom: 'Storekeeper' }), { error: 'Hold failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Held for ' + S.formJob + '.');
    }
    if (S.form === 'trf') {
      const r = safe(() => createStoreTransfer({ fromStoreId: S.formFrom, toStoreId: S.formTo, lines: [{ itemId: S.formItem, qty: Number(S.formQty) || 0 }], byWhom: 'Storekeeper' }), { error: 'Transfer failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Sent. It lands when the other store receives it.');
    }
    if (S.form === 'ret') {
      const r = safe(() => bookStoreReturn({ jobCardId: S.formJob, itemId: S.formItem, binId: S.formBin, qty: Number(S.formQty) || 0, condition: S.formCond || 'good', byWhom: 'Storekeeper' }), { error: 'Return failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Return booked.');
    }
    if (S.form === 'tool') {
      const r = safe(() => bookToolOut({ toolName: S.formTool, withWhom: S.formWho, site: S.formSite, dueBack: S.formDue, byWhom: 'Storekeeper' }), { error: 'Loan failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Booked out.');
    }
    if (S.form === 'cnt') {
      const r = safe(() => startStockCount({ area: S.formArea, byWhom: 'Storekeeper' }), { error: 'Count failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Count started.');
    }
    if (S.form === 'bin') {
      const r = safe(() => createStoreBin({ storeId: S.formStore, code: S.formCode, hint: S.formHint }), { error: 'Bin failed.' });
      if (r && r.error) return fail(r);
      return done('✓ Bin added to the map.');
    }
  }

  const ACTIONS = {
    step: (el) => { S.step = el.getAttribute('data-v'); S.ticks = {}; },
    tick: (el) => { const k = el.getAttribute('data-v'); S.ticks[k] = !S.ticks[k]; },
    page: (el) => { S.view = 'page'; S.page = el.getAttribute('data-v'); },
    form: (el) => { S.view = 'form'; S.form = el.getAttribute('data-v'); S.gate = null; S.toast = ''; },
    gate: (el) => { S.gate = Number(el.getAttribute('data-v')); },
    submit: () => submit(),
    cover: (el) => { safe(() => setCoverMode(el.getAttribute('data-v') === 'on'), null); },
    expire: () => { const n = safe(() => expireLapsedReservations(), 0); S.toast = 'Released ' + (n || 0) + ' lapsed hold(s).'; },
    pr: () => { if (typeof requestPurchaseFromModule === 'function') requestPurchaseFromModule('closeStoreModule'); },
    printpage: () => {
      const def = safe(() => (PAGES[S.page] || PAGES.stk)(), null);
      if (!def || typeof printReport !== 'function') return;
      printReport({ title: def.title, subtitle: def.sub,
        meta: (def.stats || []).map(s => [String(s[0]), String(s[1])]),
        // A row without cells is a real shape here — an empty-state or a
        // note row — and reading through it threw when the page was printed.
        cols: def.cols.map((c, i) => ({ label: c, key: (r) => ((r && r.cells && r.cells[i]) || {}).main })),
        rows: (def.rows || []).filter(r => r && r.cells),
        noteHTML: '<div class="note-box">Where it is comes before what it is. The store works in quantities — nothing here carries a price.</div>' });
    }
  };
  function onClick(e) {
    const el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    const fn = ACTIONS[el.getAttribute('data-a')];
    if (!fn) return;
    const handled = fn(el);
    if (handled !== true) paint();
  }
  function onChange(e) {
    const el = e.target.closest('[data-a-input]');
    if (!el) return;
    const k = el.getAttribute('data-a-input');
    ({ job: () => { S.formJob = el.value; S.formLine = ''; }, line: () => S.formLine = el.value,
      bin: () => S.formBin = el.value, item: () => S.formItem = el.value,
      qty: () => S.formQty = el.value, who: () => S.formWho = el.value, from: () => S.formFrom = el.value,
      to: () => S.formTo = el.value, cond: () => S.formCond = el.value, tool: () => S.formTool = el.value,
      site: () => S.formSite = el.value, due: () => S.formDue = el.value, area: () => S.formArea = el.value,
      store: () => S.formStore = el.value, code: () => S.formCode = el.value, hint: () => S.formHint = el.value })[k]();
    // Only the job select changes what else the screen shows.
    if (k === 'job') paint();
  }
  function render() { return S.view === 'dash' ? dashHTML() : S.view === 'page' ? pageHTML() : formHTML(); }
  let painting = false;
  function paint() {
    if (!root || painting) return;
    painting = true;
    try { root.innerHTML = render(); } finally { painting = false; }
    if (typeof execMarkActive === 'function') execMarkActive(S.view === 'dash' ? 'stk-dash' : S.view === 'form' ? 'stk-create' : 'stk-' + S.page);
  }
  function mount(el) {
    root = el;
    if (!root.__stkBound) { root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.__stkBound = true; }
    root.classList.add('stk');
    paint();
  }
  return { mount, render, paint, state: S,
    reset: () => { S.view = 'dash'; S.page = 'stk'; S.step = 'iss'; S.ticks = {}; S.gate = null; S.toast = ''; },
    go: (view, key) => { S.view = view; if (view === 'page') S.page = key; if (view === 'form') { S.form = key; S.gate = null; S.toast = ''; } paint(); } };
})();
