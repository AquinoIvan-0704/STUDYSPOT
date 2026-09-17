
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const passport = require('passport');
const session = require('express-session');
const { getFirebaseAdmin } = require('./lib/firebase-admin');

const Spot        = require('./models/Spot');
const User        = require('./models/User');
const PendingSpot = require('./models/PendingSpot');
const Review      = require('./models/Review');
const Message     = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();



app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'studyspotsecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

passport.serializeUser((user, done) => done(null, user.username));

passport.deserializeUser(async (username, done) => {
    try {
        done(null, User.safe(await User.findOne({ username })) || false);
    } catch (err) {
        done(err, null);
    }
});

/* ---------- small helpers ---------- */

const page = (file) => path.join(__dirname, 'public', file);

/** Redirect back with a message the front-end turns into a toast. */
const flash = (res, url, ok, error) => {
    const q = ok ? `ok=${encodeURIComponent(ok)}` : `error=${encodeURIComponent(error)}`;

    // a #fragment must stay at the very end, after the query string
    const hashAt = url.indexOf('#');
    const base = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? ''  : url.slice(hashAt);

    res.redirect(`${base}${base.includes('?') ? '&' : '?'}${q}${hash}`);
};

/** Send the user back to the page they submitted from, when it's one of ours. */
const backTo = (req, fallback) => {
    const ref = req.get('referer') || '';
    try {
        const url = new URL(ref, `http://${req.headers.host}`);
        if (url.host === req.headers.host && url.pathname.startsWith('/')) return url.pathname;
    } catch (e) { /* ignore a malformed referer */ }
    return fallback;
};

const wantsJson = (req) =>
    req.xhr || (req.get('accept') || '').includes('application/json') ||
    (req.get('content-type') || '').includes('application/json');

function requireLogin(req, res, next) {
    if (req.user) return next();
    if (wantsJson(req)) return res.status(401).json({ error: 'Please log in.' });
    return flash(res, '/', null, 'Please log in first.');
}

function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') return next();
    if (wantsJson(req)) return res.status(403).json({ error: 'Admins only.' });
    return flash(res, '/studyspot', null, 'That area is for admins only.');
}

const isAdmin = (req) => !!(req.user && req.user.role === 'admin');

app.get('/', async (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});

app.get('/signup', async (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});

app.get('/logout', async (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/?ok=' + encodeURIComponent('Logged out.'));
        });
    });
});

// some browsers / older links may POST to it
app.post('/logout', async (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/?ok=' + encodeURIComponent('Logged out.'));
        });
    });
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return flash(res, '/', null, 'Enter your username and password.');

        // matches either the username or the email address
        const user = await User.findOne({ login: username });
        if (!user) return flash(res, '/', null, 'Invalid credentials.');

        const isMatch = await bcrypt.compare(password, user.password || '');
        if (!isMatch) return flash(res, '/', null, 'Invalid credentials.');

        req.login(User.safe(user), (err) => {
            if (err) return flash(res, '/', null, 'Something went wrong signing you in.');
            req.session.save(() => res.redirect('/studyspot?ok=' + encodeURIComponent(`Welcome back, ${user.username}!`)));
        });
    } catch (err) {
        console.error(err);
        flash(res, '/', null, 'Server error during login.');
    }
});

app.post('/signup', async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const email    = String(req.body.email || '').trim();
        const password = String(req.body.password || '');

        if (username.length < 3) return flash(res, '/signup', null, 'Username must be at least 3 characters.');
        if (password.length < 6) return flash(res, '/signup', null, 'Password must be at least 6 characters.');
        if (req.body.confirm !== undefined && req.body.confirm !== password) {
            return flash(res, '/signup', null, 'The two passwords do not match.');
        }

        if (await User.findOne({ username })) return flash(res, '/signup', null, 'That username is taken.');
        if (email && await User.findOne({ email })) return flash(res, '/signup', null, 'That email is already registered.');

        const hashedPassword = await bcrypt.hash(password, 10);
        const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
        const created = await User.create({ username, email, password: hashedPassword, role });

        req.login(User.safe(created), (err) => {
            if (err) return flash(res, '/', null, 'Account created â€” please log in.');
            req.session.save(() => res.redirect('/studyspot?ok=' + encodeURIComponent('Account created. Welcome!')));
        });

        app.get('/api/firebase-config', (req, res) => {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            if (!projectId) return res.status(503).json({ error: 'Firebase is not configured.' });
            res.json({
                apiKey: process.env.FIREBASE_API_KEY || '',
                authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
                projectId,
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
                messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
                appId: process.env.FIREBASE_APP_ID || ''
            });
        });

        app.post('/api/firebase-session', async (req, res) => {
            try {
                const header = req.get('authorization') || '';
                if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Firebase token.' });
                const decoded = await getFirebaseAdmin().auth().verifyIdToken(header.slice(7));
                const email = String(decoded.email || '').trim().toLowerCase();
                if (!email) return res.status(400).json({ error: 'Firebase account has no email address.' });

                const existing = await User.findOne({ email });
                const username = existing
                    ? existing.username
                    : String(decoded.name || email.split('@')[0]).trim().slice(0, 30);
                const user = existing || await User.create({
                    username,
                    email,
                    password: '',
                    role: email === ADMIN_EMAIL ? 'admin' : 'user'
                });

                req.login(User.safe(user), (error) => {
                    if (error) return res.status(500).json({ error: 'Could not create a session.' });
                    req.session.save((saveError) => {
                        if (saveError) return res.status(500).json({ error: 'Could not save the session.' });
                        res.json({ user: User.safe(user) });
                    });
                });
            } catch (error) {
                console.error(error);
                res.status(401).json({ error: 'Invalid Firebase token.' });
            }
        });
    } catch (err) {
        console.error(err);
        flash(res, '/signup', null, 'Server error during registration.');
    }
});


app.get('/studyspot', async (req, res) => res.sendFile(page('studyspot.html')));
app.get('/spots',     (req, res) => res.sendFile(page('spots.html')));
app.get('/about',     (req, res) => res.sendFile(page('about.html')));
app.get('/contact',   (req, res) => res.sendFile(page('contact.html')));

app.get('/add-spot', requireLogin, async (req, res) => {
    res.sendFile(page(isAdmin(req) ? 'add-spot.html' : 'request-spot.html'));
});

app.get('/spot/:id',      (req, res) => res.sendFile(page('spot-detail.html')));
app.get('/edit-spot/:id', requireAdmin, async (req, res) => res.sendFile(page('edit-spot.html')));
app.get('/admin/pending', requireAdmin, async (req, res) => res.sendFile(page('admin-pending.html')));
app.get('/admin/users',   requireAdmin, async (req, res) => res.sendFile(page('admin-users.html')));
app.get('/profile',       requireLogin, async (req, res) => res.sendFile(page('profile.html')));
app.get('/request-sent',  requireLogin, async (req, res) => res.sendFile(page('request-sent.html')));

/** What the running process is â€” the front-end compares this to its own
 *  constant so a stale server (edited files, never restarted) is obvious. */
app.get('/api/version', async (req, res) => res.json({ version: require('./package.json').version }));

app.get('/api/current-user', async (req, res) => res.json(req.user || null));

/** Every spot, each with its review summary attached. */
app.get('/api/spots', async (req, res) => {
    const spots = await Promise.all((await Spot.getAll()).map(async spot => ({ ...spot, reviews: await Review.summaryFor(spot.id) })));
    res.json(spots);
});

app.get('/api/search', async (req, res) => {
    const results = await Promise.all((await Spot.search(req.query.q)).map(async spot => ({ ...spot, reviews: await Review.summaryFor(spot.id) })));
    res.json(results);
});

app.get('/api/spot/:id', async (req, res) => {
    const spot = await Spot.findById(req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found.' });
    res.json({ ...spot, reviews: await Review.summaryFor(spot.id) });
});

app.post('/api/spots', requireLogin, async (req, res) => {
    const { name, city, seats } = req.body;
    if (!name || !city || seats === undefined || seats === '') {
        return flash(res, isAdmin(req) ? '/add-spot' : '/add-spot', null, 'Please fill in name, city and seats.');
    }

    if (isAdmin(req)) {
        await Spot.create({ ...req.body, addedBy: req.user.username });
        return flash(res, '/spots', 'Study spot added.');
    }

    const created = await PendingSpot.create({ ...req.body, submittedBy: req.user.username });
    return res.redirect(`/request-sent?id=${encodeURIComponent(created.id)}`);
});

app.post('/api/edit-spot/:id', requireAdmin, async (req, res) => {
    const updated = await Spot.update(req.params.id, req.body);
    if (!updated) return flash(res, '/spots', null, 'That spot no longer exists.');
    flash(res, '/spots', 'Spot updated.');
});

app.post('/api/delete-spot/:id', requireAdmin, async (req, res) => {
    const removed = await Spot.remove(req.params.id);
    if (removed) await Review.removeBySpotId(req.params.id);
    flash(res, '/spots', removed ? 'Spot deleted.' : null, removed ? null : 'That spot no longer exists.');
});


app.get('/api/pending-spots', requireAdmin, async (req, res) => res.json(await PendingSpot.getAll()));

app.post('/api/approve-spot/:id', requireAdmin, async (req, res) => {
    const pending = await PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    await Spot.create({ ...pending, addedBy: pending.submittedBy });
    await PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Approved â€œ${pending.name}â€.`);
});

app.post('/api/decline-spot/:id', requireAdmin, async (req, res) => {
    const pending = await PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    await PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Declined â€œ${pending.name}â€.`);
});

app.get('/api/spots/:id/reviews', async (req, res) => {
    const mine = req.user ? await Review.findByUserAndSpot(req.user.username, req.params.id) : null;
    res.json({ reviews: await Review.getBySpotId(req.params.id), mine: mine || null });
});

app.post('/api/spots/:id/reviews', requireLogin, async (req, res) => {
    const spot = await Spot.findById(req.params.id);
    if (!spot) return flash(res, '/spots', null, 'That spot no longer exists.');

    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) return flash(res, '/spots', null, 'Pick a rating from 1 to 5.');
    if (!String(req.body.comment || '').trim()) return flash(res, '/spots', null, 'Write a short comment.');

    const { updated } = Review.save({
        spotId: req.params.id,
        username: req.user.username,
        rating,
        comment: req.body.comment
    });

    const back = backTo(req, `/spot/${req.params.id}`);
    const target = back === '/spots' ? `/spots#spot-${req.params.id}` : back;
    flash(res, target, updated ? 'Your review was updated.' : 'Review posted.');s
});

/** A review can be removed by whoever wrote it, or by an admin. */
app.post('/api/reviews/:id/delete', requireLogin, async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) return flash(res, '/spots', null, 'That review is gone.');

    const owner = String(review.username).toLowerCase() === String(req.user.username).toLowerCase();
    if (!owner && !isAdmin(req)) return flash(res, '/spots', null, 'You can only delete your own review.');

    await Review.remove(req.params.id);
    flash(res, backTo(req, '/spots'), 'Review deleted.');
});


app.get('/api/user-profile', requireLogin, async (req, res) => res.json(req.user));

/** Everything the signed-in user has contributed. */
app.get('/api/my-activity', requireLogin, async (req, res) => {
    const me = req.user.username;
    const mine = (value) => String(value || '').toLowerCase() === String(me).toLowerCase();

    const myReviews = await Promise.all((await Review.getByUser(me)).map(async r => {
        const spot = await Spot.findById(r.spotId);
        return { ...r, spotName: spot ? spot.name : 'Deleted spot' };
    })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
        user: req.user,
        spots: (await Spot.getAll()).filter(s => mine(s.addedBy)),
        pending: (await PendingSpot.getAll()).filter(s => mine(s.submittedBy)),
        reviews: myReviews
    });
});

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, body } = req.body;
    if (!name || !email || !body) {
        return res.status(400).json({ error: 'Name, email and message are required.' });
    }

    const saved = await Message.create({
        name, email, subject, body,
        fromUser: req.user ? req.user.username : ''
    });

    res.json({ ok: true, id: saved.id });
});

/* ---------- user management (admin) ---------- */

app.get('/api/users', requireAdmin, async (req, res) => {
    const users = await Promise.all((await User.getAll()).map(async u => {
        const safe = User.safe(u);
        return {
            ...safe,
            spotCount: (await Spot.getAll()).filter(s =>
                String(s.addedBy).toLowerCase() === String(u.username).toLowerCase()).length,
            reviewCount: (await Review.getByUser(u.username)).length,
            pendingCount: await PendingSpot.countBy(u.username),
            isYou: u.username === req.user.username
        };
    }));
    res.json(users);
});

app.post('/api/users/:username/role', requireAdmin, async (req, res) => {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (target.username === req.user.username && role !== 'admin') {
        return flash(res, '/admin/users', null, "You can't remove your own admin access.");
    }
    if (target.role === 'admin' && role !== 'admin' && await User.countAdmins() <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    await User.setRole(target.username, role);
    flash(res, '/admin/users', `${target.username} is now ${role === 'admin' ? 'an admin' : 'a member'}.`);
});

app.post('/api/users/:username/delete', requireAdmin, async (req, res) => {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    if (target.username === req.user.username) {
        return flash(res, '/admin/users', null, "You can't delete your own account while signed in.");
    }
    if (target.role === 'admin' && await User.countAdmins() <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    await User.remove(target.username);
    await Review.removeByUser(target.username);
    flash(res, '/admin/users', `Deleted ${target.username}.`);
});

app.get('/api/messages', requireAdmin, async (req, res) => res.json(await Message.getAll()));

app.post('/api/messages/:id/delete', requireAdmin, async (req, res) => {
    await Message.remove(req.params.id);
    flash(res, '/admin/pending', 'Message removed.');
});


app.use((req, res) => {
    if (wantsJson(req) || req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found.' });
    }
    res.status(404).sendFile(page('404.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    if (wantsJson(req) || req.path.startsWith('/api/')) {
        return res.status(500).json({ error: 'Server error.' });
    }
    res.status(500).send('Server error. <a href="/studyspot">Back to StudySpot</a>');
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`StudySpot v${require('./package.json').version} running at http://localhost:${PORT}`);
    });
}

module.exports = app;
