/* ==========================================================================
   StudySpot — Express server

   Auth:  Firebase Authentication (email/password + Google).
          The browser signs in, hands the server an ID token, and the server
          returns a Firebase *session cookie*. That cookie is self-contained —
          no session store — which is what makes this work on Vercel, where
          every request may hit a different serverless instance.

   Data:  Firestore when the Firebase env vars are set, otherwise the JSON
          files in /data (see lib/store.js).
   ========================================================================== */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const firebase = require('./lib/firebase');
const store    = require('./lib/store');

const Spot        = require('./models/Spot');
const User        = require('./models/User');
const PendingSpot = require('./models/PendingSpot');
const Review      = require('./models/Review');
const Message     = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 3001;

const SESSION_COOKIE = '__session';                 // name Vercel & Firebase both allow
const SESSION_DAYS = 5;

/* ---------- middleware ---------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

/* ---------- helpers ---------- */

const page = (file) => path.join(__dirname, 'public', file);

/** Redirect back with a message the front-end turns into a toast. */
const flash = (res, url, ok, error) => {
    const q = ok ? `ok=${encodeURIComponent(ok)}` : `error=${encodeURIComponent(error)}`;
    const hashAt = url.indexOf('#');
    const base = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? ''  : url.slice(hashAt);
    res.redirect(`${base}${base.includes('?') ? '&' : '?'}${q}${hash}`);
};

/** Send the user back to the page they submitted from, when it's one of ours. */
const backTo = (req, fallback) => {
    try {
        const url = new URL(req.get('referer') || '', `http://${req.headers.host}`);
        if (url.host === req.headers.host && url.pathname.startsWith('/')) return url.pathname;
    } catch (e) { /* malformed referer */ }
    return fallback;
};

const wantsJson = (req) =>
    req.xhr || (req.get('accept') || '').includes('application/json') ||
    (req.get('content-type') || '').includes('application/json');

const isAdmin = (req) => !!(req.user && req.user.role === 'admin');

/** Wraps an async route so a rejected promise becomes a 500 instead of a hang. */
const run = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/* ==========================================================================
   Who is signed in
   ========================================================================== */

/**
 * Reads the Firebase session cookie on every request and attaches the matching
 * profile to req.user. Never throws — a bad or expired cookie just means
 * "signed out".
 */
app.use(run(async (req, res, next) => {
    req.user = null;
    const cookie = req.cookies[SESSION_COOKIE];
    if (!cookie || !firebase.enabled) return next();

    try {
        const claims = await firebase.auth().verifySessionCookie(cookie, true);
        const profile = await User.findOne({ id: claims.uid });
        if (profile) req.user = profile;
    } catch (err) {
        res.clearCookie(SESSION_COOKIE);            // expired or revoked
    }
    next();
}));

function requireLogin(req, res, next) {
    if (req.user) return next();
    if (wantsJson(req)) return res.status(401).json({ error: 'Please log in.' });
    return flash(res, '/', null, 'Please log in first.');
}

function requireAdmin(req, res, next) {
    if (isAdmin(req)) return next();
    if (wantsJson(req)) return res.status(403).json({ error: 'Admins only.' });
    return flash(res, '/studyspot', null, 'That area is for admins only.');
}

/* ==========================================================================
   Auth endpoints (the browser does the actual sign-in with Firebase)
   ========================================================================== */

/** The public web config, served from env vars so no keys live in the repo. */
app.get('/api/firebase-config', (req, res) => {
    res.json({
        enabled: firebase.enabled,
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        projectId: firebase.projectId,
        appId: process.env.FIREBASE_APP_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || ''
    });
});

/**
 * Exchange a freshly minted Firebase ID token for a session cookie, creating
 * the app-side profile the first time we see this uid.
 */
app.post('/auth/session', run(async (req, res) => {
    if (!firebase.enabled) return res.status(503).json({ error: 'Firebase is not configured on the server.' });

    const idToken = String(req.body.idToken || '');
    if (!idToken) return res.status(400).json({ error: 'Missing sign-in token.' });

    let decoded;
    try {
        decoded = await firebase.auth().verifyIdToken(idToken, true);
    } catch (err) {
        return res.status(401).json({ error: 'That sign-in could not be verified.' });
    }

    let profile = await User.findOne({ id: decoded.uid });

    if (!profile) {
        // the very first account to sign in owns the site; after that, admins
        // are promoted from the Users page (or listed in ADMIN_EMAILS)
        const adminEmails = String(process.env.ADMIN_EMAILS || '')
            .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const existing = await User.getAll();

        const wanted = String(req.body.username || '').trim()
            || decoded.name || (decoded.email || '').split('@')[0];

        profile = await User.create({
            id: decoded.uid,
            username: await User.uniqueUsername(wanted),
            email: decoded.email || '',
            photo: decoded.picture || '',
            provider: (decoded.firebase && decoded.firebase.sign_in_provider) || 'password',
            role: (existing.length === 0 || adminEmails.includes(String(decoded.email).toLowerCase()))
                ? 'admin' : 'user'
        });
    } else if (decoded.email && profile.email !== decoded.email) {
        profile = await User.update(profile.id, { email: decoded.email });
    }

    const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await firebase.auth().createSessionCookie(idToken, { expiresIn });

    res.cookie(SESSION_COOKIE, sessionCookie, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });

    res.json({ ok: true, user: profile });
}));

app.post('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
});

app.get('/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.redirect('/?ok=' + encodeURIComponent('Logged out.'));
});

/* ==========================================================================
   Pages
   ========================================================================== */

app.get('/', (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});
app.get('/signup', (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});

app.get('/studyspot', (req, res) => res.sendFile(page('studyspot.html')));
app.get('/spots',     (req, res) => res.sendFile(page('spots.html')));
app.get('/about',     (req, res) => res.sendFile(page('about.html')));
app.get('/contact',   (req, res) => res.sendFile(page('contact.html')));
app.get('/spot/:id',  (req, res) => res.sendFile(page('spot-detail.html')));

app.get('/add-spot', requireLogin, (req, res) =>
    res.sendFile(page(isAdmin(req) ? 'add-spot.html' : 'request-spot.html')));

app.get('/edit-spot/:id', requireAdmin, (req, res) => res.sendFile(page('edit-spot.html')));
app.get('/admin/pending', requireAdmin, (req, res) => res.sendFile(page('admin-pending.html')));
app.get('/admin/users',   requireAdmin, (req, res) => res.sendFile(page('admin-users.html')));
app.get('/profile',       requireLogin, (req, res) => res.sendFile(page('profile.html')));
app.get('/request-sent',  requireLogin, (req, res) => res.sendFile(page('request-sent.html')));

/* ==========================================================================
   API — spots
   ========================================================================== */

app.get('/api/version', (req, res) =>
    res.json({ version: require('./package.json').version, storage: firebase.firestoreReady ? 'firestore' : 'files' }));

app.get('/api/current-user', (req, res) => res.json(req.user || null));

/** Attaches each spot's review summary in one pass over the reviews. */
async function withReviewSummaries(spots) {
    const reviews = await Review.getAll();
    return spots.map(spot => {
        const mine = reviews.filter(r => String(r.spotId) === String(spot.id));
        const total = mine.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        return {
            ...spot,
            reviews: mine.length
                ? { average: Math.round((total / mine.length) * 10) / 10, count: mine.length }
                : { average: 0, count: 0 }
        };
    });
}

app.get('/api/spots', run(async (req, res) => res.json(await withReviewSummaries(await Spot.getAll()))));

app.get('/api/search', run(async (req, res) =>
    res.json(await withReviewSummaries(await Spot.search(req.query.q)))));

app.get('/api/spot/:id', run(async (req, res) => {
    const spot = await Spot.findById(req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found.' });
    res.json({ ...spot, reviews: await Review.summaryFor(spot.id) });
}));

/** Admins publish immediately; everyone else files a request for approval. */
app.post('/api/spots', requireLogin, run(async (req, res) => {
    const { name, city, seats } = req.body;
    if (!name || !city || seats === undefined || seats === '') {
        return flash(res, '/add-spot', null, 'Please fill in name, city and seats.');
    }

    if (isAdmin(req)) {
        await Spot.create({ ...req.body, addedBy: req.user.username });
        return flash(res, '/spots', 'Study spot added.');
    }

    const created = await PendingSpot.create({ ...req.body, submittedBy: req.user.username });
    res.redirect(`/request-sent?id=${encodeURIComponent(created.id)}`);
}));

app.post('/api/edit-spot/:id', requireAdmin, run(async (req, res) => {
    const updated = await Spot.update(req.params.id, req.body);
    if (!updated) return flash(res, '/spots', null, 'That spot no longer exists.');
    flash(res, '/spots', 'Spot updated.');
}));

app.post('/api/delete-spot/:id', requireAdmin, run(async (req, res) => {
    const removed = await Spot.remove(req.params.id);
    if (removed) await Review.removeBySpotId(req.params.id);
    flash(res, '/spots', removed ? 'Spot deleted.' : null, removed ? null : 'That spot no longer exists.');
}));

/* ==========================================================================
   API — pending requests
   ========================================================================== */

app.get('/api/pending-spots', requireAdmin, run(async (req, res) => res.json(await PendingSpot.getAll())));

app.post('/api/approve-spot/:id', requireAdmin, run(async (req, res) => {
    const pending = await PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    await Spot.create({ ...pending, addedBy: pending.submittedBy });
    await PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Approved “${pending.name}”.`);
}));

app.post('/api/decline-spot/:id', requireAdmin, run(async (req, res) => {
    const pending = await PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    await PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Declined “${pending.name}”.`);
}));

/* ==========================================================================
   API — reviews
   ========================================================================== */

app.get('/api/spots/:id/reviews', run(async (req, res) => {
    const mine = req.user ? await Review.findByUserAndSpot(req.user.username, req.params.id) : null;
    res.json({ reviews: await Review.getBySpotId(req.params.id), mine: mine || null });
}));

app.post('/api/spots/:id/reviews', requireLogin, run(async (req, res) => {
    const spot = await Spot.findById(req.params.id);
    if (!spot) return flash(res, '/spots', null, 'That spot no longer exists.');

    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) return flash(res, '/spots', null, 'Pick a rating from 1 to 5.');
    if (!String(req.body.comment || '').trim()) return flash(res, '/spots', null, 'Write a short comment.');

    const { updated } = await Review.save({
        spotId: req.params.id,
        username: req.user.username,
        rating,
        comment: req.body.comment
    });

    const back = backTo(req, `/spot/${req.params.id}`);
    const target = back === '/spots' ? `/spots#spot-${req.params.id}` : back;
    flash(res, target, updated ? 'Your review was updated.' : 'Review posted.');
}));

app.post('/api/reviews/:id/delete', requireLogin, run(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) return flash(res, '/spots', null, 'That review is gone.');

    const owner = String(review.username).toLowerCase() === String(req.user.username).toLowerCase();
    if (!owner && !isAdmin(req)) return flash(res, '/spots', null, 'You can only delete your own review.');

    await Review.remove(req.params.id);
    flash(res, backTo(req, '/spots'), 'Review deleted.');
}));

/* ==========================================================================
   API — profile, users, contact
   ========================================================================== */

app.get('/api/user-profile', requireLogin, (req, res) => res.json(req.user));

app.get('/api/my-activity', requireLogin, run(async (req, res) => {
    const me = req.user.username;
    const mine = (value) => String(value || '').toLowerCase() === String(me).toLowerCase();

    const [spots, pending, reviews] = await Promise.all([
        Spot.getAll(), PendingSpot.getAll(), Review.getByUser(me)
    ]);

    const myReviews = reviews.map(r => {
        const spot = spots.find(s => String(s.id) === String(r.spotId));
        return { ...r, spotName: spot ? spot.name : 'Deleted spot' };
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
        user: req.user,
        spots: spots.filter(s => mine(s.addedBy)),
        pending: pending.filter(s => mine(s.submittedBy)),
        reviews: myReviews
    });
}));

app.get('/api/users', requireAdmin, run(async (req, res) => {
    const [users, spots, reviews, pending] = await Promise.all([
        User.getAll(), Spot.getAll(), Review.getAll(), PendingSpot.getAll()
    ]);
    const by = (value, name) => String(value || '').toLowerCase() === String(name).toLowerCase();

    res.json(users.map(u => ({
        ...u,
        spotCount: spots.filter(s => by(s.addedBy, u.username)).length,
        reviewCount: reviews.filter(r => by(r.username, u.username)).length,
        pendingCount: pending.filter(p => by(p.submittedBy, u.username)).length,
        isYou: String(u.id) === String(req.user.id)
    })));
}));

app.post('/api/users/:id/role', requireAdmin, run(async (req, res) => {
    const target = await User.findOne({ id: req.params.id });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    const role = req.body.role === 'admin' ? 'admin' : 'user';
    if (String(target.id) === String(req.user.id) && role !== 'admin') {
        return flash(res, '/admin/users', null, "You can't remove your own admin access.");
    }
    if (target.role === 'admin' && role !== 'admin' && (await User.countAdmins()) <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    await User.setRole(target.id, role);
    flash(res, '/admin/users', `${target.username} is now ${role === 'admin' ? 'an admin' : 'a member'}.`);
}));

app.post('/api/users/:id/delete', requireAdmin, run(async (req, res) => {
    const target = await User.findOne({ id: req.params.id });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    if (String(target.id) === String(req.user.id)) {
        return flash(res, '/admin/users', null, "You can't delete your own account while signed in.");
    }
    if (target.role === 'admin' && (await User.countAdmins()) <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    await User.remove(target.id);
    await Review.removeByUser(target.username);
    // remove the Firebase credential too, so they can't sign back in
    try { await firebase.auth().deleteUser(target.id); } catch (e) { /* already gone */ }

    flash(res, '/admin/users', `Deleted ${target.username}.`);
}));

app.post('/api/contact', run(async (req, res) => {
    const { name, email, subject, body } = req.body;
    if (!name || !email || !body) {
        return res.status(400).json({ error: 'Name, email and message are required.' });
    }
    const saved = await Message.create({
        name, email, subject, body,
        fromUser: req.user ? req.user.username : ''
    });
    res.json({ ok: true, id: saved.id });
}));

app.get('/api/messages', requireAdmin, run(async (req, res) => res.json(await Message.getAll())));

app.post('/api/messages/:id/delete', requireAdmin, run(async (req, res) => {
    await Message.remove(req.params.id);
    flash(res, '/admin/pending', 'Message removed.');
}));

/* ==========================================================================
   Fallbacks
   ========================================================================== */

app.use((req, res) => {
    if (wantsJson(req) || req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
    res.status(404).sendFile(page('404.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    if (wantsJson(req) || req.path.startsWith('/api/')) return res.status(500).json({ error: 'Server error.' });
    res.status(500).send('Server error. <a href="/studyspot">Back to StudySpot</a>');
});

/* ==========================================================================
   Start (skipped on Vercel, which imports the app instead)
   ========================================================================== */

async function start() {
    if (firebase.firestoreReady) {
        try {
            await store.seedFromFiles(['spots', 'users', 'pending_spots', 'reviews', 'messages']);
        } catch (err) {
            console.error('Could not seed Firestore:', err.message);
        }
    }
    app.listen(PORT, () => {
        console.log(`StudySpot v${require('./package.json').version} running at http://localhost:${PORT}`);
        console.log(`Storage: ${firebase.describe()}`);
    });
}

if (require.main === module) start();

module.exports = app;
