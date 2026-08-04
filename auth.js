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
  const isLocalTestOrigin = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const testingCloudLoginItself = new URLSearchParams(location.search).get('test_cloud_login') === '1';
  if (isLocalTestOrigin && !testingCloudLoginItself) {
    finishCloudLogin('E2E Test User');
    return;
  }
  checkCloudSession();
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
function renderAuthForms(mode, message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  const tab = (m, label) => `<button onclick="renderAuthForms('${m}')" style="flex:1;padding:9px;border:none;background:${mode === m ? 'var(--maraya)' : 'transparent'};color:${mode === m ? '#fff' : 'var(--shell-ink-muted)'};border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">${label}</button>`;
  const tabsHtml = `<div style="display:flex;gap:4px;background:var(--shell-tint);border-radius:10px;padding:3px;margin-bottom:18px;">${tab('signin', 'Sign In')}${tab('signup', 'Sign Up')}</div>`;
  const messageHtml = message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : '';

  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Loading…</p>`;
  sb.from('allowed_identities').select('display_name').order('display_name').then(({ data: roster, error }) => {
    if (error) { body.innerHTML = tabsHtml + `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the roster: ${authEsc(error.message)}</p>`; return; }
    const rosterOptions = roster.map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('');

    if (mode === 'signup') {
      body.innerHTML = tabsHtml + `
        ${messageHtml}
        <select id="auth-identity-select" style="${authFieldStyle}">
          <option value="">— Which of these are you? —</option>
          ${rosterOptions}
        </select>
        <input id="auth-password-input" type="password" placeholder="Choose a password (6+ characters)" style="${authFieldStyle}">
        <input id="auth-password-confirm-input" type="password" placeholder="Confirm password" style="${authFieldStyle}">
        <button onclick="handleSignUp()" style="${authBtnStyle}">Create Account</button>
        <p style="font-size:11px;color:var(--shell-ink-faint);text-align:center;margin-top:10px;line-height:1.4;">No email needed — just remember your password, since only your admin can reset it.</p>
      `;
      return;
    }

    // mode === 'signin'
    body.innerHTML = tabsHtml + `
      ${messageHtml}
      <select id="auth-identity-select" style="${authFieldStyle}">
        <option value="">— Which of these are you? —</option>
        ${rosterOptions}
      </select>
      <input id="auth-password-input" type="password" placeholder="Password" style="${authFieldStyle}">
      <button onclick="handleSignIn()" style="${authBtnStyle}">Sign In</button>
      <p style="font-size:11px;color:var(--shell-ink-faint);text-align:center;margin-top:14px;line-height:1.4;">Forgot your password? Ask your admin to reset your account.</p>
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

async function handleSignUp() {
  const displayName = document.getElementById('auth-identity-select').value;
  const password = document.getElementById('auth-password-input').value || '';
  const confirmPassword = document.getElementById('auth-password-confirm-input').value || '';
  if (!displayName) { renderAuthForms('signup', 'Pick which of the names you are.'); return; }
  if (password.length < 6) { renderAuthForms('signup', 'Password needs to be at least 6 characters.'); return; }
  if (password !== confirmPassword) { renderAuthForms('signup', "Passwords don't match."); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Creating account…</p>`;
  const { data, error } = await sb.auth.signUp({
    email: identityToInternalEmail(displayName), password,
    options: { data: { intended_identity: displayName } }
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

async function afterSignedIn() {
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) { renderAuthForms('signin'); return; }
  const { data: existingProfile, error } = await sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  if (error) {
    const body = document.getElementById('cloud-login-body');
    if (body) body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't check your profile: ${authEsc(error.message)}</p>`;
    return;
  }
  if (existingProfile) {
    finishCloudLogin(existingProfile.display_name);
    return;
  }
  // First login right after sign-up — claim the name picked at
  // sign-up time immediately, no extra screen needed. Falls back to
  // the manual picker only if that metadata is somehow missing.
  const intended = user.user_metadata && user.user_metadata.intended_identity;
  if (intended) {
    const { error: claimError } = await sb.from('profiles').insert({ id: user.id, display_name: intended });
    if (!claimError) { finishCloudLogin(intended); return; }
    if (claimError.code !== '23505') { renderIdentityClaim(claimError.message); return; }
    // 23505 = that name got claimed by someone else in the meantime; fall through to manual picker.
  }
  renderIdentityClaim();
}

// Manual fallback identity picker — only reached if sign-up metadata
// is missing or the intended name got claimed by someone else first.
async function renderIdentityClaim(message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Loading roster…</p>`;
  const { data: roster, error } = await sb.from('allowed_identities').select('display_name').order('display_name');
  if (error) {
    body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the roster: ${authEsc(error.message)}</p>`;
    return;
  }
  body.innerHTML = `
    <p style="font-size:13px;color:var(--shell-ink-muted);text-align:center;margin-bottom:16px;line-height:1.4;">Which of these are you? You'll be permanently signed in as this name on this login.</p>
    ${message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : ''}
    <select id="cloud-identity-select" style="${authFieldStyle}">
      <option value="">— Select your name —</option>
      ${roster.map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('')}
    </select>
    <button onclick="claimIdentity()" style="${authBtnStyle}">Continue</button>
  `;
}

async function claimIdentity() {
  const select = document.getElementById('cloud-identity-select');
  const displayName = select.value;
  if (!displayName) { renderIdentityClaim('Pick a name from the list.'); return; }
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  const { error } = await sb.from('profiles').insert({ id: user.id, display_name: displayName });
  if (error) {
    if (error.code === '23505') {
      renderIdentityClaim(`"${displayName}" is already claimed by someone else — pick a different name.`);
    } else {
      renderIdentityClaim(error.message);
    }
    return;
  }
  finishCloudLogin(displayName);
}

function finishCloudLogin(displayName) {
  window.cloudIdentity = displayName;
  cloudLoginActive = false;
  document.getElementById('cloud-login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (typeof updCP === 'function') updCP();
  if (typeof updateHubBadges === 'function') updateHubBadges();
}

async function cloudSignOut() {
  await sb.auth.signOut();
  window.cloudIdentity = null;
  location.reload();
}

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (cloudLoginActive && session && event === 'SIGNED_IN') { afterSignedIn(); }
  });
}

// Entry point — the app now starts here instead of behind a PIN.
cloudLoginStart();
