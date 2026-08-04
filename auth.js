// ══════════════════════════════════════════
// AUTH — real Supabase login, the app's entry gate (4 Aug 2026, Phase 1
// of the cloud migration). Replaces the old shared 4-digit PIN outright
// (removed same day) — that PIN was never real security, just a
// hardcoded code shown as an on-screen hint, so it added friction
// without adding protection. This gates "who specifically are you"
// with a real per-person login, replacing the old dropdown-picks-your-
// name simulation every module used until now.
//
// Email + password (not magic link — swapped same day after Salman's
// call: checking email on every single login is real friction, and it
// didn't match "a real app with a real login"). Sign-up still requires
// a one-time email confirmation click (standard, prevents fake
// registrations), but every login AFTER that first confirm is just
// email + password, no email step at all. The name you pick at sign-up
// is stored in Supabase auth's own user metadata and auto-claimed the
// moment your account is confirmed — no separate "pick your name"
// screen needed on the happy path (still exists as a fallback, see
// renderIdentityClaim, for the rare case metadata is missing).
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
  // service-worker tests — e2e-pwa-offline.js) and can't complete a real
  // email round trip either way. The real deployed app is only ever
  // reached over https://salmanabdullah13-arch.github.io or as an
  // installed PWA — never file:// or localhost — so this can't activate
  // for a real user; it exists purely so the existing test suite doesn't
  // stall forever waiting on an email nobody can click. e2e-cloud-login.js
  // opts back OUT of the bypass (via ?test_cloud_login=1) since that's the
  // one suite actually testing this screen for real.
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

  if (mode === 'signup') {
    body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Loading…</p>`;
    sb.from('allowed_identities').select('display_name').order('display_name').then(({ data: roster, error }) => {
      if (error) { body.innerHTML = tabsHtml + `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't load the roster: ${authEsc(error.message)}</p>`; return; }
      body.innerHTML = tabsHtml + `
        ${messageHtml}
        <select id="auth-identity-select" style="${authFieldStyle}">
          <option value="">— Which of these are you? —</option>
          ${roster.map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('')}
        </select>
        <input id="auth-email-input" type="email" placeholder="Email" autocapitalize="off" autocorrect="off" spellcheck="false" style="${authFieldStyle}">
        <input id="auth-password-input" type="password" placeholder="Choose a password (6+ characters)" style="${authFieldStyle}">
        <button onclick="handleSignUp()" style="${authBtnStyle}">Create Account</button>
      `;
    });
    return;
  }

  // mode === 'signin'
  body.innerHTML = tabsHtml + `
    ${messageHtml}
    <input id="auth-email-input" type="email" placeholder="Email" autocapitalize="off" autocorrect="off" spellcheck="false" style="${authFieldStyle}">
    <input id="auth-password-input" type="password" placeholder="Password" style="${authFieldStyle}">
    <button onclick="handleSignIn()" style="${authBtnStyle}">Sign In</button>
    <p style="${authLinkStyle}" onclick="renderForgotPassword()">Forgot password?</p>
  `;
}

async function handleSignIn() {
  const email = (document.getElementById('auth-email-input').value || '').trim();
  const password = document.getElementById('auth-password-input').value || '';
  if (!email || !password) { renderAuthForms('signin', 'Enter your email and password.'); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Signing in…</p>`;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { renderAuthForms('signin', error.message); return; }
  await afterSignedIn();
}

async function handleSignUp() {
  const displayName = document.getElementById('auth-identity-select').value;
  const email = (document.getElementById('auth-email-input').value || '').trim();
  const password = document.getElementById('auth-password-input').value || '';
  if (!displayName) { renderAuthForms('signup', 'Pick which of the names you are.'); return; }
  if (!email || !email.includes('@')) { renderAuthForms('signup', 'Enter a valid email address.'); return; }
  if (password.length < 6) { renderAuthForms('signup', 'Password needs to be at least 6 characters.'); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Creating account…</p>`;
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  // The chosen name travels in Supabase's own user metadata (not this
  // app's DB) so it survives the confirm-email round trip even though
  // no session exists yet to write to `profiles` directly — RLS
  // requires `authenticated`, and signUp() with confirmation required
  // returns no session, only a pending user.
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { intended_identity: displayName }, emailRedirectTo: redirectTo }
  });
  if (error) { renderAuthForms('signup', error.message); return; }
  if (data.session) {
    // Confirmation isn't actually required on this project — got a
    // real session immediately, so just finish claiming right now.
    await afterSignedIn();
    return;
  }
  body.innerHTML = `
    <p style="font-size:14px;color:var(--shell-ink);text-align:center;margin-bottom:8px;font-weight:600;">Confirm your account</p>
    <p style="font-size:12.5px;color:var(--shell-ink-muted);text-align:center;line-height:1.4;">We sent a confirmation link to <b>${authEsc(email)}</b>. Open it on this device — after that, you can sign in with your password any time, no email needed.</p>
    <p style="${authLinkStyle}" onclick="renderAuthForms('signin')">Back to Sign In</p>
  `;
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
  // First login after confirming sign-up — auto-claim the name picked
  // at sign-up time, no extra screen needed. Falls back to the manual
  // picker only if that metadata is somehow missing.
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

// ── Forgot password / set new password ──────────────────────────────
function renderForgotPassword(message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <p style="font-size:13px;color:var(--shell-ink-muted);text-align:center;margin-bottom:16px;line-height:1.4;">Enter your email and we'll send you a reset link.</p>
    ${message ? `<p style="font-size:12.5px;color:${message.startsWith('Sent') ? 'var(--ok)' : 'var(--bad)'};text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : ''}
    <input id="auth-email-input" type="email" placeholder="Email" autocapitalize="off" autocorrect="off" spellcheck="false" style="${authFieldStyle}">
    <button onclick="handleForgotPassword()" style="${authBtnStyle}">Send Reset Link</button>
    <p style="${authLinkStyle}" onclick="renderAuthForms('signin')">Back to Sign In</p>
  `;
}

async function handleForgotPassword() {
  const email = (document.getElementById('auth-email-input').value || '').trim();
  if (!email || !email.includes('@')) { renderForgotPassword('Enter a valid email address.'); return; }
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) { renderForgotPassword(error.message); return; }
  renderForgotPassword(`Sent — check ${email} for a reset link.`);
}

function renderSetNewPassword(message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <p style="font-size:13px;color:var(--shell-ink-muted);text-align:center;margin-bottom:16px;">Choose a new password.</p>
    ${message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : ''}
    <input id="auth-new-password-input" type="password" placeholder="New password (6+ characters)" style="${authFieldStyle}">
    <button onclick="handleSetNewPassword()" style="${authBtnStyle}">Set Password</button>
  `;
}

async function handleSetNewPassword() {
  const password = document.getElementById('auth-new-password-input').value || '';
  if (password.length < 6) { renderSetNewPassword('Password needs to be at least 6 characters.'); return; }
  const { error } = await sb.auth.updateUser({ password });
  if (error) { renderSetNewPassword(error.message); return; }
  await afterSignedIn();
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

// Catches the confirm-email / password-recovery redirect completing
// while this screen is already showing (supabase-js parses the URL's
// auth tokens on load and fires this).
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (!cloudLoginActive) return;
    if (event === 'PASSWORD_RECOVERY') { renderSetNewPassword(); return; }
    if (session && event === 'SIGNED_IN') { afterSignedIn(); }
  });
}

// Entry point — the app now starts here instead of behind a PIN.
cloudLoginStart();
