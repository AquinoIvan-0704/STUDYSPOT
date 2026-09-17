/* ==========================================================================
   auth.js — sign in / register with Firebase Authentication.

   Flow:
     1. the browser signs in with Firebase (email+password, or Google popup)
     2. it gets an ID token and POSTs it to /auth/session
     3. the server verifies it and sets a session cookie
     4. we redirect — from then on every page is authenticated by that cookie

   Loaded as a module so it can import the Firebase SDK.
   ========================================================================== */

/* The SDK is imported dynamically, inside a try/catch. A static import would
   mean that if the CDN is unreachable for a moment the whole module fails and
   even the tabs stop working — this way the page degrades instead. */
const SDK_VERSION = '10.12.2';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let fb = null;          // filled in by loadSdk()

async function loadSdk() {
    const [appMod, authMod] = await Promise.all([
        import(`${SDK_BASE}/firebase-app.js`),
        import(`${SDK_BASE}/firebase-auth.js`)
    ]);
    return { ...appMod, ...authMod };
}

const $ = (id) => document.getElementById(id);
let auth = null;

/* ---------- small UI helpers ---------- */

function showAlert(message) {
    $('authAlertText').textContent = message;
    $('authAlert').classList.remove('hidden');
    $('authAlert').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
const clearAlert = () => $('authAlert').classList.add('hidden');

function fieldError(id, message) {
    const el = document.querySelector(`[data-error-for="${id}"]`);
    const input = $(id);
    if (!el) return;
    if (message) {
        el.textContent = message;
        el.classList.remove('hidden');
        if (input) input.classList.add('invalid');
    } else {
        el.classList.add('hidden');
        if (input) input.classList.remove('invalid');
    }
}
const clearFieldErrors = () =>
    document.querySelectorAll('[data-error-for]').forEach(el => {
        el.classList.add('hidden');
        const input = $(el.getAttribute('data-error-for'));
        if (input) input.classList.remove('invalid');
    });

function busy(button, on, label) {
    button.classList.toggle('is-loading', on);
    if (on) { button.dataset.label = button.textContent; button.textContent = label; }
    else if (button.dataset.label) { button.textContent = button.dataset.label; }
}

/** Firebase error codes are not for humans. */
function readable(err) {
    const code = (err && err.code) || '';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':       return 'That email and password don\'t match an account.';
        case 'auth/invalid-email':        return 'That email address doesn\'t look right.';
        case 'auth/email-already-in-use': return 'An account with that email already exists — try signing in.';
        case 'auth/weak-password':        return 'Pick a password of at least 6 characters.';
        case 'auth/too-many-requests':    return 'Too many attempts. Wait a minute and try again.';
        case 'auth/popup-closed-by-user': return 'The Google window closed before sign-in finished.';
        case 'auth/popup-blocked':        return 'Your browser blocked the Google popup — allow popups and retry.';
        case 'auth/unauthorized-domain':  return 'This site isn\'t in the Firebase authorised domains list yet.';
        case 'auth/operation-not-allowed': return 'That sign-in method is switched off in the Firebase console.';
        case 'auth/network-request-failed': return 'Network problem — check the connection and try again.';
        default: return (err && err.message) ? err.message.replace('Firebase: ', '') : 'Something went wrong.';
    }
}

/* ---------- hand the token to our server ---------- */

async function startSession(user, username) {
    const idToken = await user.getIdToken(true);
    const res = await fetch('/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, username: username || user.displayName || '' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'The server rejected that sign-in.');

    const next = new URLSearchParams(location.search).get('next');
    location.href = next && next.startsWith('/') ? next : '/studyspot';
}

/* ---------- boot ---------- */

async function boot() {
    let config;
    try {
        config = await (await fetch('/api/firebase-config')).json();
    } catch (e) {
        return showAlert('Could not reach the server to load the sign-in settings.');
    }

    if (!config.enabled || !config.apiKey) {
        showAlert('Firebase isn\'t configured on this server yet — see SETUP-FIREBASE.md. ' +
                  'Browsing still works without an account.');
        ['loginBtn', 'registerBtn'].forEach(id => { if ($(id)) $(id).disabled = true; });
        document.querySelectorAll('[data-google]').forEach(b => { b.disabled = true; });
        return;
    }

    try {
        fb = await loadSdk();
    } catch (err) {
        return showAlert('Could not load the Firebase sign-in library — check your internet connection and reload.');
    }

    const app = fb.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId
    });
    auth = fb.getAuth(app);

    if (config.authEmulatorHost) {
        fb.connectAuthEmulator(auth, `http://${config.authEmulatorHost}`, { disableWarnings: true });
    }

    /* --- Google --- */
    document.querySelectorAll('[data-google]').forEach(btn => {
        btn.addEventListener('click', async () => {
            clearAlert();
            const original = btn.innerHTML;
            btn.classList.add('is-loading');
            btn.textContent = 'Opening Google…';
            try {
                const provider = new fb.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                const result = await fb.signInWithPopup(auth, provider);
                await startSession(result.user, result.user.displayName);
            } catch (err) {
                showAlert(readable(err));
                btn.classList.remove('is-loading');
                btn.innerHTML = original;
            }
        });
    });

    /* --- email sign in --- */
    $('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert(); clearFieldErrors();

        const email = $('log-email').value.trim();
        const password = $('log-password').value;
        if (!email) return fieldError('log-email', 'Enter your email address.');
        if (!password) return fieldError('log-password', 'Enter your password.');

        busy($('loginBtn'), true, 'Signing in…');
        try {
            await fb.setPersistence(auth, $('remember').checked ? fb.browserLocalPersistence : fb.browserSessionPersistence);
            const cred = await fb.signInWithEmailAndPassword(auth, email, password);
            await startSession(cred.user);
        } catch (err) {
            showAlert(readable(err));
            busy($('loginBtn'), false);
        }
    });

    /* --- register --- */
    $('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert(); clearFieldErrors();

        const username = $('reg-username').value.trim();
        const email = $('reg-email').value.trim();
        const password = $('reg-password').value;
        const confirm = $('reg-confirm').value;

        if (username.length < 3) return fieldError('reg-username', 'At least 3 characters.');
        if (!email) return fieldError('reg-email', 'Enter your email address.');
        if (password.length < 6) return fieldError('reg-password', 'At least 6 characters.');
        if (password !== confirm) return fieldError('reg-confirm', 'The two passwords don\'t match.');

        busy($('registerBtn'), true, 'Creating account…');
        try {
            const cred = await fb.createUserWithEmailAndPassword(auth, email, password);
            await fb.updateProfile(cred.user, { displayName: username });
            await startSession(cred.user, username);
        } catch (err) {
            showAlert(readable(err));
            busy($('registerBtn'), false);
        }
    });

    /* --- password reset --- */
    $('forgotBtn').addEventListener('click', async () => {
        clearAlert(); clearFieldErrors();
        const email = $('log-email').value.trim();
        if (!email) return fieldError('log-email', 'Type your email first, then press this again.');
        try {
            await fb.sendPasswordResetEmail(auth, email);
            $('authFoot').textContent = `Reset link sent to ${email}. Check your inbox.`;
        } catch (err) {
            showAlert(readable(err));
        }
    });
}

/* ---------- tabs, reveal, strength meter (work with or without Firebase) ---------- */

function wireStaticBits() {
    const card = $('authCard');
    const cover = $('authCover');
    const overlayLogin = $('overlayLogin');
    const overlayRegister = $('overlayRegister');
    const strip = $('switchStrip');

    let animating = false;
    const PHASE = 600;

    function renderStrip() {
        const onRegister = card.classList.contains('show-register');
        strip.innerHTML = onRegister
            ? `Already have an account? <button type="button" id="stripLogin">Login</button>`
            : `New here? <button type="button" id="stripRegister">Create an account</button>`;
        const a = $('stripLogin'), b = $('stripRegister');
        if (a) a.addEventListener('click', showLogin);
        if (b) b.addEventListener('click', showRegister);
    }

    function showRegister() {
        if (animating || card.classList.contains('show-register')) return;
        animating = true;
        clearAlert(); clearFieldErrors(); $('authFoot').textContent = '';

        card.classList.add('show-register');
        overlayLogin.classList.remove('visible');
        cover.classList.remove('parked-left');
        cover.classList.add('covering');

        setTimeout(() => {
            cover.classList.remove('covering');
            cover.classList.add('parked-right');
            overlayRegister.classList.add('visible');
            animating = false;
        }, PHASE);

        renderStrip();
        history.replaceState({}, '', '/signup');
    }

    function showLogin() {
        if (animating || !card.classList.contains('show-register')) return;
        animating = true;
        clearAlert(); clearFieldErrors(); $('authFoot').textContent = '';

        card.classList.remove('show-register');
        overlayRegister.classList.remove('visible');
        cover.classList.remove('parked-right');
        cover.classList.add('covering');

        setTimeout(() => {
            cover.classList.remove('covering');
            cover.classList.add('parked-left');
            overlayLogin.classList.add('visible');
            animating = false;
        }, PHASE);

        renderStrip();
        history.replaceState({}, '', '/');
    }

    $('toRegister').addEventListener('click', showRegister);
    $('toLogin').addEventListener('click', showLogin);
    renderStrip();

    // /signup opens straight on the register panel, with no animation
    if (location.pathname === '/signup') {
        card.classList.add('show-register');
        cover.classList.remove('parked-left');
        cover.classList.add('parked-right');
        overlayLogin.classList.remove('visible');
        overlayRegister.classList.add('visible');
        renderStrip();
    }

    document.querySelectorAll('[data-reveal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $(btn.getAttribute('data-reveal'));
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.classList.toggle('on', !showing);
        });
    });

    const pw = $('reg-password');
    if (pw) {
        pw.addEventListener('input', () => {
            const v = pw.value;
            let score = 0;
            if (v.length >= 6) score++;
            if (v.length >= 10 && /[^a-zA-Z]/.test(v)) score++;
            if (v.length >= 12 && /[A-Z]/.test(v) && /[0-9]/.test(v)) score++;
            $('strength').dataset.score = v ? String(score || 1) : '0';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    wireStaticBits();
    boot();
});
