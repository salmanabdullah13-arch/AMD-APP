// ══════════════════════════════════════════
// AUTH — real Supabase login, the app's entry gate (4 Aug 2026, Phase 1
// of the cloud migration). Replaces the old shared 4-digit PIN outright
// (removed same day) — that PIN was never real security, just a
// hardcoded code shown as an on-screen hint, so it added friction
// without adding protection. This gates "who specifically are you"
// with a real per-person login, replacing the old dropdown-picks-your-
// name simulation every module used until now.
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
  // magic-link email round trip either way. The real deployed app is only
  // ever reached over https://salmanabdullah13-arch.github.io or as an
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
    renderEmailForm();
  }
}

function renderEmailForm(message) {
  const body = document.getElementById('cloud-login-body');
  if (!body) return;
  body.innerHTML = `
    <p style="font-size:13px;color:var(--shell-ink-muted);text-align:center;margin-bottom:20px;line-height:1.4;">Sign in with your work email to continue.</p>
    ${message ? `<p style="font-size:12.5px;color:var(--bad);text-align:center;margin-bottom:10px;">${authEsc(message)}</p>` : ''}
    <input id="cloud-email-input" type="email" placeholder="you@almarayadecor.com" autocapitalize="off" autocorrect="off" spellcheck="false"
      style="width:100%;padding:13px 14px;border:1px solid var(--shell-border);border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:12px;">
    <button onclick="sendMagicLink()" style="width:100%;padding:13px;background:var(--maraya);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;">Send Magic Link</button>
  `;
  document.getElementById('cloud-email-input')?.focus();
}

async function sendMagicLink() {
  const input = document.getElementById('cloud-email-input');
  const email = (input.value || '').trim();
  if (!email || !email.includes('@')) { renderEmailForm('Enter a valid email address.'); return; }
  const body = document.getElementById('cloud-login-body');
  body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--shell-ink-muted);">Sending…</p>`;
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) { renderEmailForm(error.message); return; }
  body.innerHTML = `
    <p style="font-size:14px;color:var(--shell-ink);text-align:center;margin-bottom:8px;font-weight:600;">Check your email</p>
    <p style="font-size:12.5px;color:var(--shell-ink-muted);text-align:center;line-height:1.4;">We sent a sign-in link to <b>${authEsc(email)}</b>. Open it on this device to continue.</p>
    <p style="font-size:12px;color:var(--maraya);text-align:center;margin-top:16px;cursor:pointer;font-weight:600;" onclick="renderEmailForm()">Use a different email</p>
  `;
}

async function afterSignedIn() {
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) { renderEmailForm(); return; }
  const { data: existingProfile, error } = await sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  if (error) {
    const body = document.getElementById('cloud-login-body');
    if (body) body.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--bad);">Couldn't check your profile: ${authEsc(error.message)}</p>`;
    return;
  }
  if (existingProfile) {
    finishCloudLogin(existingProfile.display_name);
  } else {
    renderIdentityClaim();
  }
}

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
    <select id="cloud-identity-select" style="width:100%;padding:13px 14px;border:1px solid var(--shell-border);border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:12px;">
      <option value="">— Select your name —</option>
      ${roster.map(r => `<option value="${authEsc(r.display_name)}">${authEsc(r.display_name)}</option>`).join('')}
    </select>
    <button onclick="claimIdentity()" style="width:100%;padding:13px;background:var(--maraya);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;">Continue</button>
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

// Catches the magic-link redirect completing while this screen is
// already showing (supabase-js parses the URL's auth tokens on load
// and fires this).
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (cloudLoginActive && session && event === 'SIGNED_IN') {
      afterSignedIn();
    }
  });
}

// Entry point — the app now starts here instead of behind a PIN.
cloudLoginStart();
