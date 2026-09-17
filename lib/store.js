/* ==========================================================================
   lib/store.js — one tiny storage layer, two backends.

       Firebase configured   ->  Firestore collections
       Firebase not configured -> the JSON files in /data

   Every model talks to readAll()/writeAll() and doesn't care which is in use,
   so the same code runs on Vercel and on a laptop.

   Note: writeAll rewrites a whole collection in one batch. That is fine for a
   project of this size (tens of records) and keeps the model logic simple; a
   larger app would write individual documents instead.
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const firebase = require('./firebase');

const DATA_DIR = path.join(__dirname, '..', 'data');

/* ---------- JSON file backend ---------- */

function filePath(name) {
    return path.join(DATA_DIR, `${name}.json`);
}

function fileReadAll(name) {
    const file = filePath(name);
    if (!fs.existsSync(file)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(file, '[]');
        return [];
    }
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : [];
}

function fileWriteAll(name, rows) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath(name), JSON.stringify(rows, null, 2));
}

/* ---------- Firestore backend ---------- */

async function firestoreReadAll(name) {
    const snapshot = await firebase.db().collection(name).get();
    return snapshot.docs.map(doc => doc.data());
}

async function firestoreWriteAll(name, rows) {
    const col = firebase.db().collection(name);
    const snapshot = await col.get();

    const keep = new Set();
    const batch = firebase.db().batch();

    rows.forEach(row => {
        const id = String(row.id);
        keep.add(id);
        batch.set(col.doc(id), JSON.parse(JSON.stringify(row)));   // strip undefined
    });

    snapshot.docs.forEach(doc => {
        if (!keep.has(doc.id)) batch.delete(doc.ref);
    });

    await batch.commit();
}

/* ---------- what the models call ---------- */

async function readAll(name) {
    return firebase.firestoreReady ? firestoreReadAll(name) : fileReadAll(name);
}

async function writeAll(name, rows) {
    const list = Array.isArray(rows) ? rows : [];
    return firebase.firestoreReady ? firestoreWriteAll(name, list) : fileWriteAll(name, list);
}

/**
 * First run against an empty Firestore: copy whatever is in the JSON files up
 * to the cloud, so the spots and accounts already in the repo aren't lost.
 * Does nothing if the collection already has documents.
 */
async function seedFromFiles(names) {
    if (!firebase.firestoreReady) return;

    for (const name of names) {
        const existing = await firebase.db().collection(name).limit(1).get();
        if (!existing.empty) continue;

        let rows = [];
        try { rows = fileReadAll(name); } catch (e) { rows = []; }
        if (!rows.length) continue;

        await firestoreWriteAll(name, rows);
        console.log(`Seeded ${rows.length} record(s) into Firestore collection "${name}".`);
    }
}

module.exports = { readAll, writeAll, seedFromFiles };
