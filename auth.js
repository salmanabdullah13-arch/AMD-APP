// ══════════════════════════════════════════
// AUTH — real Supabase login, the app's entry gate (4 Aug 2026, Phase 1
// of the cloud migration). Replaces the old shared 4-digit PIN outright
// (removed same day) — that PIN was never real security, just a
// hardcoded code shown as an on-screen hint, so it added friction
// without adding protection. This gates "who specifically are you"
// with a real per-person login, replacing the old dropdown-picks-your-
// name simulation every module used until now.
//
// Username (your name, picked from the roster) + password — no real
// email anywhere in the flow. Went through two earlier iterations
// same day: magic link (checking email every login was too much
// friction), then email+password (still required typing/remembering
// an email address, and several roster identities are ROLES —
// "Storekeeper", "Accounts" — that don't have a real personal inbox
// at all). Supabase's accounts still need SOME unique string under the
// hood, so each name gets a deterministic synthetic address (e.g.
// "Karthik Silva" -> "karthik-silva@amd-app.internal") that's never
// shown to the user and never receives real mail.
//
// Real consequence of that: nothing can be emailed to a fake address,
// so there's no self-service "forgot password" anymore, and email
// confirmation on sign-up MUST be turned off in Supabase's dashboard
// (Authentication -> Sign In / Providers -> Email -> "Confirm email"),
// otherwise signUp() fails outright trying to send a confirmation mail
// that can never be delivered. Password recovery is manual now: an
// employee who's locked out gets their account deleted (Authentication
// -> Users) and signs up again — which conveniently also frees their
// name to reclaim. Salman's explicit call, given an 11-person roster
// where he's directly reachable.
//
// Depends on the supabase-js CDN script tag (index.html, loads right
// before this file) and the schema in supabase/schema.sql already
// having been run against the project below.
// ══════════════════════════════════════════

const SUPABASE_URL = 'https://rwbxycxrrslgxskoufxo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-ksrLB1Xw8DiHeVH3EpkDQ_SolsWr7t';

// Defensive: if the CDN script failed to load (network/CDN outage),
// `supabase` is undefined and this would otherwise throw, silently
// killing every function below and leaving a blank screen forever.
let sb = null;
try {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
} catch (e) {
  sb = null;
}

// Set once real login completes — the rest of the app doesn't read
// this yet (that's Phase 2/3, migrating each module's own simulated
// currentUser over to this), but it's available from here on.
window.cloudIdentity = null;

let cloudLoginActive = false;

function authEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

// Deterministic — the same name always maps to the same fake address,
// so sign-in can derive it fresh from the picked name without ever
// storing or displaying it anywhere.
function identityToInternalEmail(displayName) {
  const slug = displayName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug}@amd-app.internal`;
}

// Age gate (5 Aug 2026) — anyone under 18 cannot be approved. Enforced
// in two places: here, for immediate feedback at sign-up (handleSignUp()
// below), and again in approval-queue.js's actual approve action — a
// determined signer could still get a bad DOB past the sign-up form
// (e.g. the manual identity-claim fallback doesn't collect DOB at all),
// so the approval-side check is the real gate, this one is just the
// fast, friendly rejection.
function calculateAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const authFieldStyle = 'width:100%;padding:13px 14px;border:1px solid var(--shell-border);border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:12px;';
const authBtnStyle = 'width:100%;padding:13px;background:var(--maraya);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;';
const authLinkStyle = 'font-size:12px;color:var(--maraya);text-align:center;margin-top:14px;cursor:pointer;font-weight:600;';

// The app's entry point — called once, automatically, at the bottom of
// this file when the page loads.
function cloudLoginStart() {
  cloudLoginActive = true;
  document.getElementById('cloud-login').style.display = 'flex';
  if (!sb) {
    document.getElementById('cloud-login-body').innerHTML =
      `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the login library. Check your connection and reload.</p>`;
    return;
  }
  // Automated tests (this repo's e2e-*.js suite) open index.html either
  // directly via a file:// URL or via a local http server (needed for
  // service-worker tests — e2e-pwa-offline.js). The real deployed app is
  // only ever reached over https://salmanabdullah13-arch.github.io or as
  // an installed PWA — never file:// or localhost — so this can't
  // activate for a real user; it exists purely so the existing test
  // suite doesn't stall on this screen. e2e-cloud-login.js opts back OUT
  // (via ?test_cloud_login=1) since that's the one suite testing this
  // screen for real.
  const testingCloudLoginItself = new URLSearchParams(location.search).get('test_cloud_login') === '1';
  if (isLocalTestOrigin() && !testingCloudLoginItself) {
    finishCloudLogin('E2E Test User', false);
    return;
  }
  checkCloudSession();
}

// Shared with the roster filter below — the real deployed app is only
// ever reached over https://salmanabdullah13-arch.github.io or as an
// installed PWA, never file:// or localhost.
function isLocalTestOrigin() {
  return location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// The e2e suite's own accounts live in the same allowed_identities table
// real staff do (they have to — profiles.display_name and
// messages.sender_name/recipient_name both FK-reference it). Two suites
// (e2e-signup-approval.js, e2e-role-gating.js) each create a fresh
// timestamped throwaway account per run to exercise the real sign-up →
// approve flow, and can't delete it afterwards (removing an auth user
// needs the service_role key, which must never reach client code) — so
// these accumulate indefinitely. By 5 Aug 2026 that was 73 test names
// against 11 real staff in the sign-in dropdown, which is what Salman
// reported. Filtered out here rather than in the query so the fix holds
// no matter how many more accumulate; test origins still see everything
// so the suites that sign in as these accounts keep working unchanged.
function filterRealIdentities(roster) {
  if (isLocalTestOrigin()) return roster;
  return (roster || []).filter(r => !/^E2E /i.test(r.display_name || ''));
}

async function checkCloudSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    await afterSignedIn();
  } else {
    renderAuthForms('signin');
  }
}

// ── Sign In / Sign Up (tabbed) ──────────────────────────────────────
// Sign-up is a real registration form (5 Aug 2026, role-based access
// rollout) — Full Name/DOB/Telephone/Designation/User Type, replacing
// "pick your name off a fixed roster" (the actual access gate before
// this). Sign-in deliberately KEEPS the roster dropdown — by the time
// someone signs in, their name is already in allowed_identities from
// their own sign-up, so a dropdown is still lower-friction than typing
// (fewer login failures from a typo not matching the stored name
// exactly) and there's no reason to change working UX here.
function renderAuthForms(mode, message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  const tab = (m, label) => `<button onclick="renderAuthForms('${m}')" style="flex:1;padding:9px;border:none;background:${mode === m ? 'var(--maraya)' : 'transparent'};color:${mode === m ? '#fff' : 'var(--shell-ink-muted)'};border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">${label}</button>`;
  const tabsHtml = `<div style="display:flex;gap:4px;background:var(--shell-tint);border-radius:10px;padding:3px;margin-bottom:18px;">${tab('signin', 'Sign In')}${tab('signup', 'Sign Up')}</div>`;
  const messageHtml = message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : '';

  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Loading…</p>`;

  if (mode === 'signup') {
    sb.from('user_types').select('key,label,department').order('department').order('label').then(({ data: userTypes, error }) => {
      if (error) { body.innerHTML = tabsHtml + `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load role list: ${authEsc(error.message)}</p>`; return; }
      const userTypeOptions = userTypes.map(t => `<option value="${authEsc(t.key)}">${authEsc(t.label)}</option>`).join('');
      // max=18-years-ago (5 Aug 2026, age gate) — the date picker itself
      // won't let you select anything younger, which also directly
      // closes the "just pick today's date" loophole this was built to
      // stop. onkeydown/onpaste block manual typing — a native <input
      // type="date"> on iOS is already a wheel picker with no keyboard
      // involved, but desktop browsers allow typing digits into the
      // date segments unless explicitly blocked.
      const maxDob = new Date();
      maxDob.setFullYear(maxDob.getFullYear() - 18);
      const maxDobStr = maxDob.toISOString().slice(0, 10);
      body.innerHTML = tabsHtml + `
        ${messageHtml}
        <input id="auth-fullname-input" type="text" placeholder="Full Name" style="${authFieldStyle}">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--shell-ink-muted);margin:-4px 0 5px;">Date of Birth <span style="font-weight:400;color:var(--shell-ink-faint);">(must be 18 or older)</span></label>
        <input id="auth-dob-input" type="date" max="${maxDobStr}" onkeydown="return false" onpaste="return false" style="${authFieldStyle}">
        <input id="auth-phone-input" type="tel" placeholder="Telephone Number" style="${authFieldStyle}">
        <input id="auth-designation-input" type="text" placeholder="Designation (your job title)" style="${authFieldStyle}">
        <select id="auth-usertype-select" style="${authFieldStyle}">
          <option value="">— User Type —</option>
          ${userTypeOptions}
        </select>
        <input id="auth-password-input" type="password" placeholder="Choose a password (6+ characters)" style="${authFieldStyle}">
        <input id="auth-password-confirm-input" type="password" placeholder="Confirm password" style="${authFieldStyle}">
        <button onclick="handleSignUp()" style="${authBtnStyle}">Create Account</button>
        <p style="font-size:11px;color:var(--shell-ink-faint);text-align:center;margin-top:10px;line-height:1.4;">Your account needs approval from an Owner or HR admin before you can sign in.</p>
      `;
    });
    return;
  }

  // mode === 'signin'
  sb.from('allowed_identities').select('display_name').order('display_name').then(({ data: roster, error }) => {
    if (error) { body.innerHTML = tabsHtml + `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the roster: ${authEsc(error.message)}</p>`; return; }
    const rosterOptions = filterRealIdentities(roster).map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('');
    body.innerHTML = tabsHtml + `
      ${messageHtml}
      <select id="auth-identity-select" style="${authFieldStyle}">
        <option value="">— Which of these are you? —</option>
        ${rosterOptions}
      </select>
      <input id="auth-password-input" type="password" placeholder="Password" style="${authFieldStyle}">
      <button onclick="handleSignIn()" style="${authBtnStyle}">Sign In</button>
      <p onclick="handleForgotPassword()" style="font-size:11.5px;color:var(--maraya);text-align:center;margin-top:14px;line-height:1.4;font-weight:600;cursor:pointer;">Forgot your password?</p>
    `;
  });
}

async function handleSignIn() {
  const displayName = document.getElementById('auth-identity-select').value;
  const password = document.getElementById('auth-password-input').value || '';
  if (!displayName) { renderAuthForms('signin', 'Pick which of the names you are.'); return; }
  if (!password) { renderAuthForms('signin', 'Enter your password.'); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Signing in…</p>`;
  const { error } = await sb.auth.signInWithPassword({ email: identityToInternalEmail(displayName), password });
  if (error) { renderAuthForms('signin', error.message.includes('Invalid') ? 'Wrong name or password.' : error.message); return; }
  await afterSignedIn();
}

// Real notification, not a real reset (5 Aug 2026) — see the design
// note on password_reset_requests in supabase/schema.sql. Works while
// signed out (the whole point) since that table's insert policy is
// `to public`. Requires the person to have already picked their name
// in the roster dropdown above, since that's the only identity we have
// for them without a session.
async function handleForgotPassword() {
  const select = document.getElementById('auth-identity-select');
  const displayName = select ? select.value : '';
  if (!displayName) { renderAuthForms('signin', 'Pick which of the names you are above, then tap "Forgot your password?" again.'); return; }
  const { error } = await sb.from('password_reset_requests').insert({ display_name: displayName });
  if (error) { renderAuthForms('signin', `Couldn't notify your admin: ${error.message}`); return; }
  renderAuthForms('signin', `✓ An admin has been notified and will reset your password soon.`);
}

async function handleSignUp() {
  const displayName = (document.getElementById('auth-fullname-input').value || '').trim();
  const dob = document.getElementById('auth-dob-input').value || '';
  const phone = (document.getElementById('auth-phone-input').value || '').trim();
  const designation = (document.getElementById('auth-designation-input').value || '').trim();
  const userType = document.getElementById('auth-usertype-select').value;
  const password = document.getElementById('auth-password-input').value || '';
  const confirmPassword = document.getElementById('auth-password-confirm-input').value || '';
  if (!displayName) { renderAuthForms('signup', 'Enter your full name.'); return; }
  if (!dob) { renderAuthForms('signup', 'Enter your date of birth.'); return; }
  const age = calculateAge(dob);
  if (age === null || age < 18) { renderAuthForms('signup', 'You must be at least 18 years old to sign up.'); return; }
  if (!phone) { renderAuthForms('signup', 'Enter your telephone number.'); return; }
  if (!designation) { renderAuthForms('signup', 'Enter your designation.'); return; }
  if (!userType) { renderAuthForms('signup', 'Pick your User Type.'); return; }
  if (password.length < 6) { renderAuthForms('signup', 'Password needs to be at least 6 characters.'); return; }
  if (password !== confirmPassword) { renderAuthForms('signup', "Passwords don't match."); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Creating account…</p>`;
  const { data, error } = await sb.auth.signUp({
    email: identityToInternalEmail(displayName), password,
    options: { data: {
      intended_identity: displayName, intended_dob: dob, intended_phone: phone,
      intended_designation: designation, intended_user_type: userType
    } }
  });
  if (error) {
    if (error.message.includes('already registered')) { renderAuthForms('signup', `"${displayName}" already has an account — try Sign In instead.`); return; }
    renderAuthForms('signup', error.message);
    return;
  }
  if (!data.session) {
    // Only reachable if "Confirm email" is still on in Supabase — with
    // a fake address, that confirmation mail can never arrive, so this
    // account would be permanently stuck pending. Point at the fix
    // rather than leave a silent dead end.
    renderAuthForms('signup', 'Account created but needs email confirmation, which is off for this app — ask your admin to disable "Confirm email" in Supabase, then try Sign In.');
    return;
  }
  await afterSignedIn();
}

// Idempotency guard (5 Aug 2026) — the direct call chain
// (handleSignUp/handleSignIn -> afterSignedIn) and Supabase's own
// onAuthStateChange listener both independently reach afterSignedIn()
// for the same SIGNED_IN event, the same race documented elsewhere in
// this app for finishCloudLogin(). That was previously harmless here
// because finishCloudLogin() itself sets cloudLoginActive=false, which
// stops the listener's second call before it mattered — but a PENDING
// account never reaches finishCloudLogin() at all (renderPendingApproval()
// is the whole point — no app access), so cloudLoginActive stayed true
// and the listener's second afterSignedIn() call raced the first one's
// profiles insert, lost (23505), and overwrote the pending screen with
// the identity-claim fallback. Found live-testing the new sign-up flow.
let afterSignedInInFlight = false;
async function afterSignedIn() {
  if (afterSignedInInFlight) return;
  afterSignedInInFlight = true;
  try {
    await afterSignedInImpl();
  } finally {
    afterSignedInInFlight = false;
  }
}
async function afterSignedInImpl() {
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) { renderAuthForms('signin'); return; }
  const { data: existingProfile, error } = await sb.from('profiles').select('display_name, user_type, approval_status').eq('id', user.id).maybeSingle();
  if (error) {
    const body = document.getElementById('cloud-login-body');
    if (body) body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't check your profile: ${authEsc(error.message)}</p>`;
    return;
  }
  if (existingProfile) {
    if (existingProfile.approval_status === 'pending') { renderPendingApproval(); return; }
    if (existingProfile.approval_status === 'rejected') { renderAccountRejected(); return; }
    if (existingProfile.approval_status === 'deactivated') { renderAccountDeactivated(); return; }
    finishCloudLogin(existingProfile.display_name, true, existingProfile.user_type);
    return;
  }
  // First login right after sign-up — claim the name/role picked at
  // sign-up time immediately, no extra screen needed. Falls back to
  // the manual picker only if that metadata is somehow missing.
  const meta = user.user_metadata || {};
  const intended = meta.intended_identity;
  if (intended) {
    // allowed_identities first — messages.sender_name/recipient_name
    // still FK-reference it, and profiles.display_name FK-references
    // it too, so this must land before the profiles insert below. A
    // 23505 here is harmless (someone else already registered this
    // exact name as a known participant) — the REAL uniqueness check
    // that matters is the one on profiles.display_name right after.
    await sb.from('allowed_identities').insert({ display_name: intended });
    const { error: claimError } = await sb.from('profiles').insert({
      id: user.id, display_name: intended,
      dob: meta.intended_dob || null, phone: meta.intended_phone || null,
      designation: meta.intended_designation || null, user_type: meta.intended_user_type || null,
      approval_status: 'pending'
    });
    if (!claimError) { renderPendingApproval(); return; }
    if (claimError.code !== '23505') { renderIdentityClaim(claimError.message); return; }
    // 23505 = that name got claimed by someone else in the meantime; fall through to manual picker.
  }
  renderIdentityClaim();
}

// Shown right after a fresh sign-up, and on every subsequent sign-in
// attempt until an Owner/HR admin approves the account (5 Aug 2026,
// role-based access rollout). No app access until approved — enforced
// for real in RLS (supabase/schema.sql's is_approved()), this screen is
// just the honest UI reflection of that, not the actual gate.
function renderPendingApproval() {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <div style="text-align:center;padding:10px 4px;">
      <p style="font-size:15px;font-weight:700;margin-bottom:8px;">Account created</p>
      <p style="font-size:13px;color:var(--shell-ink-muted);line-height:1.5;">Your account is waiting for approval from an Owner or HR admin before you can sign in. Come back once you've been notified you're approved.</p>
      <button onclick="cloudSignOut()" style="${authBtnStyle}margin-top:18px;">Back to Sign In</button>
    </div>`;
}

// Shown on sign-in for an account an Owner/HR admin rejected.
function renderAccountRejected() {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <div style="text-align:center;padding:10px 4px;">
      <p style="font-size:15px;font-weight:700;margin-bottom:8px;color:var(--bad);">Account not approved</p>
      <p style="font-size:13px;color:var(--shell-ink-muted);line-height:1.5;">Your sign-up wasn't approved. Contact your admin if you think this is a mistake.</p>
      <button onclick="cloudSignOut()" style="${authBtnStyle}margin-top:18px;">Sign Out</button>
    </div>`;
}

// Nav overhaul Phase 2 (5 Aug 2026) — reached when Admin's new User &
// Role Management screen (admin.js) flips a previously-approved account
// back to 'deactivated'. Distinct from "rejected" (which reads as a
// sign-up that never got approved in the first place) — this is a real
// offboarding action taken later on an account that used to work.
function renderAccountDeactivated() {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <div style="text-align:center;padding:10px 4px;">
      <p style="font-size:15px;font-weight:700;margin-bottom:8px;color:var(--bad);">Access deactivated</p>
      <p style="font-size:13px;color:var(--shell-ink-muted);line-height:1.5;">Your access has been deactivated. Contact an Owner or Admin if you think this is a mistake.</p>
      <button onclick="cloudSignOut()" style="${authBtnStyle}margin-top:18px;">Sign Out</button>
    </div>`;
}

// Manual fallback identity picker — only reached if sign-up metadata
// is missing or the intended name got claimed by someone else first.
// Still needs a User Type (profiles.user_type is not-null) since this
// bypasses the main sign-up form entirely.
async function renderIdentityClaim(message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Loading roster…</p>`;
  const [{ data: roster, error }, { data: userTypes, error: utError }] = await Promise.all([
    sb.from('allowed_identities').select('display_name').order('display_name'),
    sb.from('user_types').select('key,label').order('label')
  ]);
  if (error || utError) {
    body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the roster: ${authEsc((error || utError).message)}</p>`;
    return;
  }
  body.innerHTML = `
    <p style="font-size:13px;color:var(--shell-ink-muted);text-align:center;margin-bottom:16px;line-height:1.4;">Which of these are you? You'll be permanently signed in as this name on this login.</p>
    <select id="cloud-identity-usertype-select" style="${authFieldStyle}">
      <option value="">— Your User Type —</option>
      ${userTypes.map(t => `<option value="${authEsc(t.key)}">${authEsc(t.label)}</option>`).join('')}
    </select>
    ${message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : ''}
    <select id="cloud-identity-select" style="${authFieldStyle}">
      <option value="">— Select your name —</option>
      ${filterRealIdentities(roster).map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('')}
    </select>
    <button onclick="claimIdentity()" style="${authBtnStyle}">Continue</button>
  `;
}

async function claimIdentity() {
  const displayName = document.getElementById('cloud-identity-select').value;
  const userType = document.getElementById('cloud-identity-usertype-select').value;
  if (!displayName) { renderIdentityClaim('Pick a name from the list.'); return; }
  if (!userType) { renderIdentityClaim('Pick your User Type.'); return; }
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  const { error } = await sb.from('profiles').insert({ id: user.id, display_name: displayName, user_type: userType, approval_status: 'pending' });
  if (error) {
    if (error.code === '23505') {
      renderIdentityClaim(`"${displayName}" is already claimed by someone else — pick a different name.`);
    } else {
      renderIdentityClaim(error.message);
    }
    return;
  }
  renderPendingApproval();
}

// userType: a user_types.key value for a real session (fetched from the
// signed-in profile — see afterSignedIn()). Defaults to "owner" for a
// non-real session (the e2e test bypass, isRealSession=false) — there's
// no real profile in that path, and "owner" is the one role every
// role-gated check (getPendingBudgetApprovalsFor, the nav's role-gating
// framework) treats as a wildcard, so the ~20 pre-existing offline e2e
// tests keep exercising every module unimpeded, same as before this
// role-based access work existed.
// Nav overhaul Phase 3 (5 Aug 2026) — window.__eco3d (the 3D hub's own
// NODES + launch registry) is set by index.html's <script type="module">,
// which runs deferred, after every classic script including this one —
// there's a real race between finishCloudLogin() firing (as soon as a
// real Supabase session/profile check resolves) and that module script
// finishing. Polls briefly rather than assuming it's ready; gives up
// silently after ~2s (a safe, non-broken fallback — the user just sees
// the ecosystem hub and can tap in manually, not a crash).
function launchDashboardNode(nodeId, attemptsLeft = 40) {
  const nodes = window.__eco3d && window.__eco3d.NODES;
  if (nodes) {
    const node = nodes.find(n => n.id === nodeId);
    if (node && typeof node.launch === 'function') node.launch();
    return;
  }
  if (attemptsLeft <= 0) return;
  setTimeout(() => launchDashboardNode(nodeId, attemptsLeft - 1), 50);
}

function finishCloudLogin(displayName, isRealSession = true, userType = 'owner') {
  window.cloudIdentity = displayName;
  window.cloudUserType = userType;
  window.__realCloudSession = isRealSession;
  cloudLoginActive = false;
  document.getElementById('cloud-login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (isRealSession) {
    // window.__dashboardMap — the role-gating framework's actual data
    // (index.html's nodeAccessible()). Fetched fresh every real login
    // rather than cached across sessions, since it's tiny (28 rows) and
    // this way a dashboard_node_id change (Milestones B-E, as those
    // dashboards get built) takes effect on the next login with zero
    // cache-invalidation logic needed.
    sb.from('user_types').select('key,dashboard_node_id').then(({ data }) => {
      window.__dashboardMap = {};
      (data || []).forEach(t => { if (t.dashboard_node_id) window.__dashboardMap[t.key] = t.dashboard_node_id; });

      // Nav overhaul Phase 3 (5 Aug 2026) — land directly on the role's
      // own dashboard instead of the ecosystem hub picker, since
      // nodeAccessible() already knows exactly which one dashboard every
      // role is allowed to open. window.__dashboardHome (read by
      // closeModuleWrap(), shell.js, Phase 1) is the launch-fn name for
      // Owner/Admin's own hub to return to, or null for every other role
      // (their one dashboard IS the top level — closing it signs out).
      // Deliberately scoped to a REAL session only — the offline e2e
      // bypass (isRealSession=false, see cloudLoginStart()) must keep
      // landing on the ecosystem hub exactly as before, since ~40
      // existing suites navigate from there via window.__eco3d.branches.
      window.__dashboardHome = userType === 'owner' ? 'launchOwnerModule' : userType === 'admin' ? 'launchAdminModule' : null;
      const targetNodeId = window.__dashboardMap[userType];
      if (targetNodeId) launchDashboardNode(targetNodeId);
    });
    // Fire-and-forget — the app shouldn't wait on these to unlock, they
    // populate/subscribe in the background and re-render via
    // notifyLiveUpdateListeners() (data.js) once ready.
    if (typeof initCloudMessagesCache === 'function') initCloudMessagesCache();
    if (typeof initPresence === 'function') initPresence();
    // All four business-data caches load in parallel, same timing as
    // before jobCards existed — jobCards[] deliberately is NOT sequenced
    // behind the others (see initCloudJobCardsCache()'s own note in
    // data.js): nextJobCardNo() reads jobCards.length synchronously the
    // moment a quote is confirmed, so delaying this load would only widen
    // the window for that id scheme to collide with an already-persisted
    // job. Only the BRIDGE step (re-creating projects[]/curtainJobs[]
    // entries) genuinely needs customers/enquiries/quotations/jobCards all
    // loaded first, so that alone waits on all four here.
    const businessDataReady = Promise.all([
      typeof initCloudCustomersCache === 'function' ? initCloudCustomersCache() : Promise.resolve(),
      typeof initCloudEnquiriesCache === 'function' ? initCloudEnquiriesCache() : Promise.resolve(),
      typeof initCloudQuotationsCache === 'function' ? initCloudQuotationsCache() : Promise.resolve(),
      typeof initCloudJobCardsCache === 'function' ? initCloudJobCardsCache() : Promise.resolve(),
      // Phase 3 (5 Aug 2026) — independent of the other four/the bridge
      // step below; a non-Accounts/Owner session just gets an empty
      // cache back (RLS), not an error.
      typeof initCloudCustomerBankingCache === 'function' ? initCloudCustomerBankingCache() : Promise.resolve()
    ]);
    businessDataReady.then(() => { if (typeof bridgeAllJobCards === 'function') bridgeAllJobCards(); });
  }
  if (typeof updCP === 'function') updCP();
  if (typeof updateHubBadges === 'function') updateHubBadges();
}

async function cloudSignOut() {
  await sb.auth.signOut();
  window.cloudIdentity = null;
  location.reload();
}

// ── Change Password (5 Aug 2026) — self-service, for a signed-in user
// changing their OWN password. Built after having to reset Salman's
// account by hand (Admin API) since nothing let him do this himself.
// supabase.auth.updateUser() only requires the current session — no
// separate "current password" re-entry, matching Supabase's own
// default (the active session already proves who you are).
// ══════════════════════════════════════════
const changePasswordModal = document.createElement('div');
changePasswordModal.id = 'change-password-modal';
changePasswordModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.5);align-items:center;justify-content:center;padding:20px;';
changePasswordModal.innerHTML = `
  <div style="background:#fff;border-radius:14px;padding:22px 20px;width:100%;max-width:340px;box-sizing:border-box;">
    <h3 style="margin:0 0 14px;font-size:16px;">Change Password</h3>
    <div id="change-password-body"></div>
  </div>
`;
document.body.appendChild(changePasswordModal);

function openChangePasswordModal() {
  if (!window.__realCloudSession) return;
  document.getElementById('change-password-body').innerHTML = `
    <input id="cp-new-password" type="password" placeholder="New password (6+ characters)" style="${authFieldStyle}">
    <input id="cp-confirm-password" type="password" placeholder="Confirm new password" style="${authFieldStyle}">
    <p id="cp-message" style="font-size:12px;color:var(--bad);min-height:16px;margin:0 0 8px;"></p>
    <div style="display:flex;gap:8px;">
      <button onclick="closeChangePasswordModal()" style="flex:1;padding:11px;background:var(--shell-tint);border:none;border-radius:10px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
      <button onclick="submitChangePassword()" style="flex:1;padding:11px;background:var(--maraya);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;">Save</button>
    </div>
  `;
  changePasswordModal.style.display = 'flex';
}
function closeChangePasswordModal() {
  changePasswordModal.style.display = 'none';
}
async function submitChangePassword() {
  const pw = document.getElementById('cp-new-password').value || '';
  const confirmPw = document.getElementById('cp-confirm-password').value || '';
  const msg = document.getElementById('cp-message');
  if (pw.length < 6) { msg.textContent = 'Password needs to be at least 6 characters.'; return; }
  if (pw !== confirmPw) { msg.textContent = "Passwords don't match."; return; }
  msg.style.color = 'var(--shell-ink-muted)';
  msg.textContent = 'Saving…';
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) { msg.style.color = 'var(--bad)'; msg.textContent = error.message; return; }
  closeChangePasswordModal();
  if (typeof commsToast === 'function') commsToast('✓ Password changed.');
}

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (cloudLoginActive && session && event === 'SIGNED_IN') { afterSignedIn(); }
  });
}

// Entry point — the app now starts here instead of behind a PIN.
cloudLoginStart();
