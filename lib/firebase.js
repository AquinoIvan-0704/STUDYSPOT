/* ==========================================================================
   lib/firebase.js — Firebase Admin SDK (server side)

   Reads its credentials from environment variables so nothing secret is ever
   committed. On Vercel you set these under Project → Settings → Environment
   Variables; locally you can put them in a .env file (see SETUP-FIREBASE.md).

   If the variables are missing, Firebase is simply "off" and the app falls
   back to the JSON files in /data — that way the project still runs on a
   laptop with no internet or no Firebase project.
   ========================================================================== */

const admin = require('firebase-admin');

/** Emulators announce themselves through these, and need no real credentials. */
const usingEmulator = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);

const projectId   = process.env.FIREBASE_PROJECT_ID || '';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
// Vercel stores the key on one line, so the escaped newlines must be put back.
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const enabled = !!projectId && (usingEmulator || (!!clientEmail && !!privateKey));

/* Storage is a separate question from auth: you can run Firebase Auth while
   still keeping data in the JSON files (handy for local development, and the
   only option if Firestore isn't reachable). STUDYSPOT_STORAGE=files forces it. */
const firestoreReady = enabled && String(process.env.STUDYSPOT_STORAGE || '').toLowerCase() !== 'files';

/* Serverless calls this file on every cold start, and re-initialising throws,
   so the app is cached on globalThis and reused. */
function getApp() {
    if (!enabled) return null;
    if (globalThis.__studyspotFirebase) return globalThis.__studyspotFirebase;

    const config = usingEmulator
        ? { projectId }
        : { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) };

    const app = admin.apps.length ? admin.app() : admin.initializeApp(config);
    globalThis.__studyspotFirebase = app;
    return app;
}

function db() {
    const app = getApp();
    return app ? app.firestore() : null;
}

function auth() {
    const app = getApp();
    return app ? app.auth() : null;
}

/** Printed once at boot so it's obvious which mode the server came up in. */
function describe() {
    if (!enabled) return 'JSON files in /data (Firebase env vars not set)';
    const data = firestoreReady ? 'Firestore' : 'JSON files in /data';
    const where = usingEmulator ? 'emulator' : 'cloud';
    return `${data} + Firebase Auth (${where}, project ${projectId})`;
}

module.exports = { enabled, firestoreReady, usingEmulator, projectId, db, auth, describe };
