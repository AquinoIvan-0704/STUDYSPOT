require('dotenv').config();
const admin = require('firebase-admin');

function getFirebaseAdmin() {
    if (admin.apps.length) return admin.app();

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credentialsFile) {
        return admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: `https://${projectId || 'study-spot-edba9'}-default-rtdb.firebaseio.com`
        });
    }

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, ' +
            'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or set ' +
            'GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.'
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n')
        }),
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
    });
}

function getRealtimeDatabase() {
    return getFirebaseAdmin().database();
}

module.exports = { getFirebaseAdmin, getRealtimeDatabase };
