/* ==========================================================================
   crew-timer-data.js — the crew clock: the ONE way hours are logged
   ==========================================================================
   Salman, 2 Sep 2026: create crew → add members → select job → select
   item → Start → Pause (with a reason) → End → photos and a progress
   marker. One session per crew per day. For a job running four or five
   days the crew stops the clock each evening and sends progress photos.
   And this replaces the per-person forms in the workshop too — "one
   mechanism everywhere and the forms go."

   What it writes: at End, the elapsed hours (minus pauses) go to the
   EXISTING per-person day-logs (logLabourDay) for every member present,
   each at their own real payroll rate — so the cost ledger, the capacity
   page, the payroll run and estimate-vs-actual all keep working unchanged.
   The clock is a faster way of writing the same records, not a new ledger.

   The start time is a record, not a timer in the browser: a running
   session is a row that survives the phone locking, the app closing and a
   reload. Reopening the app shows it still running.
   ========================================================================== */

const timerCrews = [];       // crews made in the timer itself (site crews, ad-hoc floor teams)
const crewSessions = [];     // one per crew per day: running | paused | ended
const progressPhotos = [];   // photos against job + line + session

// Closed list, so the pattern is reportable. Same reasoning as the overtime
// causes: free text cannot be counted.
const PAUSE_REASONS = ["Waiting on material", "Client not on site", "No power", "Weather", "Break", "Other"];
const TIMER_DEPTS = [
  { key: "carp", name: "Joinery", roster: "carp" },
  { key: "uph", name: "Upholstery", roster: "uph" },
  { key: "paint", name: "Paint & polish", roster: "paint" },
  { key: "curt", name: "Curtain & blinds", roster: "curt" },
  { key: "install", name: "Site installation", roster: null }   // any production trade
];
const TIMER_ACTIVITIES = ["production", "installation", "steaming", "site survey", "snagging"];

function nextTimerId(prefix, arr) {
  const n = arr.reduce((mx, r) => { const m = String(r.id || "").match(/(\d+)$/); return m ? Math.max(mx, parseInt(m[1], 10)) : mx; }, 0);
  return prefix + "-" + String(n + 1).padStart(4, "0");
}
function timerNow() { return new Date().toISOString(); }

// ═══ Crews ═════════════════════════════════════════════════════════════
// Every crew the clock can run for, in one shape: production's five (19a),
// upholstery's five stages (20a), and the crews made here. A crew is a
// name, a department and the people standing in it.
function timerCrewsAll() {
  const out = [];
  if (typeof crews !== "undefined" && typeof getCrewMembers === "function") {
    crews.forEach(c => out.push({
      id: c.id, name: c.name, dept: c.id === "CREW-I" ? "install" : c.dept, source: "production",
      members: getCrewMembers(c.id).map(m => m.name), lead: (typeof crewLeader === "function" && crewLeader(c.id) || {}).name || null
    }));
  }
  if (typeof UPH_STAGES !== "undefined" && typeof getUphStageMembers === "function") {
    UPH_STAGES.forEach(st => out.push({
      id: "UPH-" + st.id, name: "Upholstery · " + st.name.replace(/^\d · /, ""), dept: "uph", source: "upholstery",
      members: getUphStageMembers(st.id).map(m => m.name), lead: (typeof uphStageLeader === "function" && uphStageLeader(st.id) || {}).name || null
    }));
  }
  timerCrews.forEach(c => out.push({ id: c.id, name: c.name, dept: c.dept, source: "timer", members: c.members.slice(), lead: c.lead }));
  return out;
}
function timerCrew(id) { return timerCrewsAll().find(c => c.id === id) || null; }
function timerDeptRoster(dept) {
  if (typeof EMPLOYEE_RATES === "undefined") return [];
  if (dept === "install") {
    return Object.keys(EMPLOYEE_RATES).filter(n => EMPLOYEE_RATES[n].category === "Production").sort();
  }
  return typeof getDeptRoster === "function" ? getDeptRoster(dept) : [];
}
function createTimerCrew({ name, dept, members = [], lead = null, byWhom = "Crew Lead" } = {}) {
  if (!name || !name.trim()) return { error: "A crew needs a name." };
  if (!TIMER_DEPTS.some(d => d.key === dept)) return { error: "Which department is this crew for?" };
  if (timerCrewsAll().some(c => c.name.toLowerCase() === name.trim().toLowerCase())) return { error: "There is already a crew called " + name.trim() + "." };
  const roster = timerDeptRoster(dept);
  const bad = members.filter(m => roster.indexOf(m) === -1);
  if (bad.length) return { error: bad[0] + " is not on the " + (TIMER_DEPTS.find(d => d.key === dept) || {}).name + " roster. Names come from the payroll, not typed." };
  if (lead && members.indexOf(lead) === -1) return { error: "The lead has to be in the crew." };
  const crew = { id: nextTimerId("TCREW", timerCrews), name: name.trim(), dept, members: [...new Set(members)], lead: lead || members[0] || null, createdOn: todayISO(), createdBy: byWhom };
  timerCrews.push(crew);
  return crew;
}
function addTimerCrewMember(crewId, name) {
  const c = timerCrews.find(x => x.id === crewId);
  if (!c) return { error: "Only a crew made here can be edited here — production and upholstery crews are edited on their own labour pages." };
  if (timerDeptRoster(c.dept).indexOf(name) === -1) return { error: name + " is not on the roster for this crew." };
  if (c.members.indexOf(name) === -1) c.members.push(name);
  return c;
}
function removeTimerCrewMember(crewId, name) {
  const c = timerCrews.find(x => x.id === crewId);
  if (!c) return { error: "Only a crew made here can be edited here." };
  c.members = c.members.filter(m => m !== name);
  if (c.lead === name) c.lead = c.members[0] || null;
  return c;
}

// ═══ What a crew can clock on to ═══════════════════════════════════════
function timerJobsForCrew(crewId) {
  const crew = timerCrew(crewId);
  if (!crew) return [];
  const jobs = (typeof jobCards === "undefined" ? [] : jobCards).filter(j => j.status !== "cancelled" && j.routingConfirmed);
  const out = [];
  if (crew.dept === "install" || crew.dept === "curt") {
    // A site crew clocks on to anything routed that is not delivered, and
    // to curtain jobs with an installation on the calendar.
    jobs.forEach(j => {
      const delivered = (j.items || []).every(it => (Number(it.deliveredQty) || 0) >= (Number(it.qty) || 0));
      if (!delivered || crew.dept === "curt") out.push({ id: j.id, label: j.id + " — " + (j.projectName || j.customerName || ""), kind: "job" });
    });
    if (typeof curtainJobs !== "undefined") {
      curtainJobs.forEach(cj => { if (!out.some(o => o.id === cj.id)) out.push({ id: cj.id, label: cj.id + " — " + (cj.name || ""), kind: "curtain" }); });
    }
    return out;
  }
  jobs.forEach(j => {
    if ((j.items || []).some(it => (it.departmentSequence || []).indexOf(crew.dept) !== -1)) {
      out.push({ id: j.id, label: j.id + " — " + (j.projectName || j.customerName || ""), kind: "job" });
    }
  });
  return out;
}
function timerLinesForJob(jobId, crewId) {
  const crew = timerCrew(crewId);
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  return (job.items || [])
    .filter(it => !crew || crew.dept === "install" || crew.dept === "curt" || (it.departmentSequence || []).indexOf(crew.dept) !== -1)
    .map(it => {
      const entry = crew && (it.departmentStatuses || []).find(d => d.department === crew.dept);
      return { lineId: it.lineId, product: it.product || it.name || "", qty: it.qty, unit: it.unit,
        status: entry ? entry.status : null, progressPct: entry ? (entry.progressPct || 0) : 0,
        done: entry ? entry.status === "done" : false };
    });
}

// ═══ Sessions — Start · Pause · Resume · End ═══════════════════════════
function getRunningSession(crewId) {
  return crewSessions.find(s => s.crewId === crewId && s.status !== "ended") || null;
}
function getOpenSessions() { return crewSessions.filter(s => s.status !== "ended"); }
function startCrewSession({ crewId, jobCardId, lineIds = [], present = null, activity = "production", leadName = null, byWhom = "Crew Lead" } = {}) {
  const crew = timerCrew(crewId);
  if (!crew) return { error: "Which crew?" };
  const open = getRunningSession(crewId);
  if (open) return { error: crew.name + " is already on the clock (" + open.jobCardId + ", since " + open.startedAt.slice(11, 16) + "). End that first." };
  if (!jobCardId) return { error: "Which job?" };
  const jobs = timerJobsForCrew(crewId);
  const jb = jobs.find(j => j.id === jobCardId);
  if (!jb) return { error: jobCardId + " is not something " + crew.name + " can clock on to." };
  const who = (present === null ? crew.members : present).filter(n => crew.members.indexOf(n) !== -1);
  if (!who.length) return { error: "Nobody present? Tick at least one man, or the day logs against nobody." };
  const lines = jb.kind === "job" ? timerLinesForJob(jobCardId, crewId) : [];
  const picked = [...new Set((lineIds || []).map(Number))];
  // A curtain or site crew clocks on to the job as a whole — its hours land on
  // the job, never on a line (the ledger allows lineId null). Found by the
  // end-to-end run: a curtain crew was asked to tick items it never has.
  const wholeJob = crew.dept === "curt" || crew.dept === "install";
  if (lines.length && !picked.length && !wholeJob) return { error: "Which items? Tick at least one, or the hours land on nothing." };
  const stray = picked.filter(id => !lines.some(l => Number(l.lineId) === id));
  if (stray.length) return { error: "Item " + stray[0] + " is not on that job for " + crew.name + "." };
  const finished = picked.filter(id => (lines.find(l => Number(l.lineId) === id) || {}).done);
  if (finished.length) return { error: "Item " + finished[0] + " is already finished — nothing to clock on to." };
  if (TIMER_ACTIVITIES.indexOf(activity) === -1) activity = "production";
  const s = {
    id: nextTimerId("SESS", crewSessions),
    crewId, crewName: crew.name, dept: crew.dept, jobCardId, jobKind: jb.kind, lineIds: picked,
    present: who, leadName: leadName || crew.lead || who[0], activity,
    date: todayISO(), startedAt: timerNow(), pauses: [], status: "running",
    endedAt: null, hours: null, progressPct: null, note: "", logIds: [], byWhom
  };
  crewSessions.push(s);
  if (typeof logActivity === "function") {
    logActivity({ type: "clock-started", linkedType: "job", linkedId: jobCardId, user: s.leadName, message: crew.name + " on the clock — " + who.length + " present · " + activity, dept: crew.dept });
  }
  return s;
}
function pauseCrewSession(sessionId, reason, note = "") {
  const s = crewSessions.find(x => x.id === sessionId);
  if (!s) return { error: "Which session?" };
  if (s.status !== "running") return { error: s.status === "paused" ? "Already paused." : "That day is already ended." };
  if (PAUSE_REASONS.indexOf(reason) === -1) return { error: "Why is the clock stopping? One of: " + PAUSE_REASONS.join(" · ") + "." };
  s.pauses.push({ at: timerNow(), reason, note: note || "", resumedAt: null });
  s.status = "paused";
  return s;
}
function resumeCrewSession(sessionId) {
  const s = crewSessions.find(x => x.id === sessionId);
  if (!s) return { error: "Which session?" };
  if (s.status !== "paused") return { error: "The clock is not paused." };
  const p = s.pauses[s.pauses.length - 1];
  if (p && !p.resumedAt) p.resumedAt = timerNow();
  s.status = "running";
  return s;
}
// Elapsed hours right now, minus every pause (an open pause counts to now).
function sessionElapsedHours(s, nowIso) {
  const now = new Date(nowIso || timerNow()).getTime();
  const start = new Date(s.startedAt).getTime();
  const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
  let paused = 0;
  (s.pauses || []).forEach(p => {
    const a = new Date(p.at).getTime(), b = p.resumedAt ? new Date(p.resumedAt).getTime() : end;
    paused += Math.max(0, b - a);
  });
  return Math.max(0, (end - start - paused) / 3600000);
}
function roundQuarter(h) { return Math.round(h * 4) / 4; }
/**
 * End the day. The elapsed hours (minus pauses, to the nearest quarter,
 * never below the ledger's half-hour floor) are written per PRESENT member
 * to the existing day-logs at real payroll rates, split evenly across the
 * items the crew was on — so the ledger stays per person, per line, and
 * nothing downstream changes. Progress (25/50/75) is applied to each line;
 * 100 still only comes from QC.
 */
function endCrewSession(sessionId, { progressPct = null, note = "", byWhom = null } = {}) {
  const s = crewSessions.find(x => x.id === sessionId);
  if (!s) return { error: "Which session?" };
  if (s.status === "ended") return { error: "That day is already ended." };
  // 100 only ever comes from QC. Refuse it here, before the day ends — an
  // ignored marker on an ended day cannot be corrected.
  if (progressPct !== null && progressPct !== undefined && [25, 50, 75].indexOf(Number(progressPct)) === -1) {
    return { error: "Progress is 25, 50 or 75 — 100% comes from QC." };
  }
  if (s.status === "paused") resumeCrewSession(sessionId);
  s.endedAt = timerNow();
  const raw = sessionElapsedHours(s);
  const hours = Math.max(0.5, roundQuarter(raw));
  const lines = s.lineIds.length ? s.lineIds : [null];
  const per = roundQuarter(hours / lines.length) || 0.25;
  const logIds = [];
  let err = null;
  s.present.forEach(name => {
    lines.forEach(lineId => {
      if (typeof logLabourDay !== "function") return;
      const r = logLabourDay({ jobId: s.jobCardId, lineId, date: s.date, employeeName: name, hours: Math.max(0.5, per), activity: s.activity, loggedBy: s.leadName });
      if (r && r.error) err = r.error; else logIds.push(r.id);
    });
  });
  if (err && !logIds.length) { s.endedAt = null; s.status = "running"; return { error: err }; }
  s.status = "ended"; s.hours = hours; s.rawHours = Math.round(raw * 100) / 100; s.note = note || ""; s.logIds = logIds;
  if (progressPct !== null && progressPct !== undefined && s.jobKind === "job" && ["carp", "uph", "paint"].indexOf(s.dept) !== -1) {
    s.progressPct = Number(progressPct);
    s.lineIds.forEach(lineId => { if (typeof setLineProgress === "function") setLineProgress(s.jobCardId, lineId, s.dept, Number(progressPct), s.leadName); });
  }
  if (typeof logActivity === "function") {
    logActivity({ type: "clock-ended", linkedType: "job", linkedId: s.jobCardId, user: s.leadName,
      // No hours in the feed: Sales reads the job's activity, and Sales sees
      // the photo, never the hours. The hours are in the ledger.
      message: s.crewName + " off the clock — " + s.present.length + " present" + (s.progressPct !== null ? " · " + s.progressPct + "%" : ""), dept: s.dept });
  }
  return s;
}
function getCrewSessions(crewId, date) {
  return crewSessions.filter(s => (!crewId || s.crewId === crewId) && (!date || s.date === date));
}
function getJobSessions(jobId) { return crewSessions.filter(s => s.jobCardId === jobId); }
function getTodaySessions() { return crewSessions.filter(s => s.date === todayISO()); }

// ═══ Progress photos ═══════════════════════════════════════════════════
function addProgressPhoto({ sessionId = null, jobCardId, lineId = null, url, note = "", by = "Crew Lead" } = {}) {
  if (!jobCardId) return { error: "A photo lands against a job." };
  if (!url) return { error: "No photo." };
  const p = { id: nextTimerId("PHOTO", progressPhotos), sessionId, jobCardId, lineId: lineId === undefined ? null : lineId, url, note: note || "", at: timerNow(), date: todayISO(), by };
  progressPhotos.push(p);
  return p;
}
function getJobPhotos(jobId) { return progressPhotos.filter(p => p.jobCardId === jobId).slice().reverse(); }
function getLinePhotos(jobId, lineId) { return progressPhotos.filter(p => p.jobCardId === jobId && String(p.lineId) === String(lineId)).slice().reverse(); }
function getSessionPhotos(sessionId) { return progressPhotos.filter(p => p.sessionId === sessionId); }
// The bucket in a real session; a data URL offline, so the flow can be
// walked end to end without the network. Same shape sales.js uses for
// item photos.
async function uploadProgressPhoto(file, jobCardId) {
  if (!file) return { error: "No photo." };
  if (file.size > 8 * 1024 * 1024) return { error: "That photo is over 8 MB — take it at a lower size." };
  if (window.__realCloudSession && typeof sb !== "undefined" && sb && sb.storage) {
    const ext = (file.name || "jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = String(jobCardId) + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
    const { error } = await sb.storage.from("progress-photos").upload(key, file, { upsert: false });
    if (error) return { error: "Upload failed: " + error.message };
    const { data } = sb.storage.from("progress-photos").getPublicUrl(key);
    return { url: data.publicUrl };
  }
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res({ url: fr.result }); fr.onerror = () => res({ error: "Could not read the photo." }); fr.readAsDataURL(file); });
}
