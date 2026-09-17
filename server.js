/* ==========================================================================
   StudySpot — Express server
   Data lives in JSON files under /data (see the models folder).
   ========================================================================== */

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const passport = require('passport');
const session = require('express-session');

const Spot        = require('./models/Spot');
const User        = require('./models/User');
const PendingSpot = require('./models/PendingSpot');
const Review      = require('./models/Review');
const Message     = require('./models/Message');
const { ensureData } = require('./models/bootstrap');

// make sure /data exists (and migrate older copies) before anything reads it
ensureData();

const app = express();
const PORT = process.env.PORT || 3001;

/* ---------- middleware ---------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'studyspotsecret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

passport.serializeUser((user, done) => done(null, user.username));

passport.deserializeUser((username, done) => {
    try {
        done(null, User.safe(User.findOne({ username })) || false);
    } catch (err) {
        done(err, null);
    }
});

/* ---------- small helpers ---------- */

const page = (file) => path.join(__dirname, 'public', file);

/** Redirect back with a message the front-end turns into a toast. */
const flash = (res, url, ok, error) => {
    const q = ok ? `ok=${encodeURIComponent(ok)}` : `error=${encodeURIComponent(error)}`;
    res.redirect(`${url}${url.includes('?') ? '&' : '?'}${q}`);
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

/* ==========================================================================
   Auth
   ========================================================================== */

app.get('/', (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});

app.get('/signup', (req, res) => {
    if (req.user) return res.redirect('/studyspot');
    res.sendFile(page('login.html'));
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect('/?ok=' + encodeURIComponent('Logged out.'));
        });
    });
});

// some browsers / older links may POST to it
app.post('/logout', (req, res) => {
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
        const user = User.findOne({ login: username });
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

        if (User.findOne({ username })) return flash(res, '/signup', null, 'That username is taken.');
        if (email && User.findOne({ email })) return flash(res, '/signup', null, 'That email is already registered.');

        const hashedPassword = await bcrypt.hash(password, 10);
        const created = User.create({ username, email, password: hashedPassword, role: 'user' });

        req.login(User.safe(created), (err) => {
            if (err) return flash(res, '/', null, 'Account created — please log in.');
            req.session.save(() => res.redirect('/studyspot?ok=' + encodeURIComponent('Account created. Welcome!')));
        });
    } catch (err) {
        console.error(err);
        flash(res, '/signup', null, 'Server error during registration.');
    }
});

/* ==========================================================================
   Pages
   ========================================================================== */

app.get('/studyspot', (req, res) => res.sendFile(page('studyspot.html')));
app.get('/spots',     (req, res) => res.sendFile(page('spots.html')));
app.get('/about',     (req, res) => res.sendFile(page('about.html')));
app.get('/contact',   (req, res) => res.sendFile(page('contact.html')));

app.get('/add-spot', requireLogin, (req, res) => {
    res.sendFile(page(isAdmin(req) ? 'add-spot.html' : 'request-spot.html'));
});

app.get('/edit-spot/:id', requireAdmin, (req, res) => res.sendFile(page('edit-spot.html')));
app.get('/admin/pending', requireAdmin, (req, res) => res.sendFile(page('admin-pending.html')));
app.get('/admin/users',   requireAdmin, (req, res) => res.sendFile(page('admin-users.html')));
app.get('/profile',       requireLogin, (req, res) => res.sendFile(page('profile.html')));
app.get('/request-sent',  requireLogin, (req, res) => res.sendFile(page('request-sent.html')));

/* ==========================================================================
   API — spots
   ========================================================================== */

app.get('/api/current-user', (req, res) => res.json(req.user || null));

/** Every spot, each with its review summary attached. */
app.get('/api/spots', (req, res) => {
    const spots = Spot.getAll().map(spot => ({ ...spot, reviews: Review.summaryFor(spot.id) }));
    res.json(spots);
});

app.get('/api/search', (req, res) => {
    const results = Spot.search(req.query.q).map(spot => ({ ...spot, reviews: Review.summaryFor(spot.id) }));
    res.json(results);
});

app.get('/api/spot/:id', (req, res) => {
    const spot = Spot.findById(req.params.id);
    if (!spot) return res.status(404).json({ error: 'Spot not found.' });
    res.json({ ...spot, reviews: Review.summaryFor(spot.id) });
});

/**
 * Admins create a spot outright; everyone else files a request for approval.
 */
app.post('/api/spots', requireLogin, (req, res) => {
    const { name, city, seats } = req.body;
    if (!name || !city || seats === undefined || seats === '') {
        return flash(res, isAdmin(req) ? '/add-spot' : '/add-spot', null, 'Please fill in name, city and seats.');
    }

    if (isAdmin(req)) {
        Spot.create({ ...req.body, addedBy: req.user.username });
        return flash(res, '/spots', 'Study spot added.');
    }

    const created = PendingSpot.create({ ...req.body, submittedBy: req.user.username });
    return res.redirect(`/request-sent?id=${encodeURIComponent(created.id)}`);
});

app.post('/api/edit-spot/:id', requireAdmin, (req, res) => {
    const updated = Spot.update(req.params.id, req.body);
    if (!updated) return flash(res, '/spots', null, 'That spot no longer exists.');
    flash(res, '/spots', 'Spot updated.');
});

app.post('/api/delete-spot/:id', requireAdmin, (req, res) => {
    const removed = Spot.remove(req.params.id);
    if (removed) Review.removeBySpotId(req.params.id);
    flash(res, '/spots', removed ? 'Spot deleted.' : null, removed ? null : 'That spot no longer exists.');
});

/* ==========================================================================
   API — pending requests
   ========================================================================== */

app.get('/api/pending-spots', requireAdmin, (req, res) => res.json(PendingSpot.getAll()));

app.post('/api/approve-spot/:id', requireAdmin, (req, res) => {
    const pending = PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    Spot.create({ ...pending, addedBy: pending.submittedBy });
    PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Approved “${pending.name}”.`);
});

app.post('/api/decline-spot/:id', requireAdmin, (req, res) => {
    const pending = PendingSpot.findById(req.params.id);
    if (!pending) return flash(res, '/admin/pending', null, 'That request is gone.');

    PendingSpot.remove(req.params.id);
    flash(res, '/admin/pending', `Declined “${pending.name}”.`);
});

/* ==========================================================================
   API — reviews
   ========================================================================== */

app.get('/api/spots/:id/reviews', (req, res) => {
    const mine = req.user ? Review.findByUserAndSpot(req.user.username, req.params.id) : null;
    res.json({ reviews: Review.getBySpotId(req.params.id), mine: mine || null });
});

app.post('/api/spots/:id/reviews', requireLogin, (req, res) => {
    const spot = Spot.findById(req.params.id);
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

    flash(res, `/spots#spot-${req.params.id}`, updated ? 'Your review was updated.' : 'Review posted.');
});

/** A review can be removed by whoever wrote it, or by an admin. */
app.post('/api/reviews/:id/delete', requireLogin, (req, res) => {
    const review = Review.findById(req.params.id);
    if (!review) return flash(res, '/spots', null, 'That review is gone.');

    const owner = String(review.username).toLowerCase() === String(req.user.username).toLowerCase();
    if (!owner && !isAdmin(req)) return flash(res, '/spots', null, 'You can only delete your own review.');

    Review.remove(req.params.id);
    flash(res, '/spots', 'Review deleted.');
});

/* ==========================================================================
   API — profile & contact
   ========================================================================== */

app.get('/api/user-profile', requireLogin, (req, res) => res.json(req.user));

/** Everything the signed-in user has contributed. */
app.get('/api/my-activity', requireLogin, (req, res) => {
    const me = req.user.username;
    const mine = (value) => String(value || '').toLowerCase() === String(me).toLowerCase();

    const myReviews = Review.getByUser(me).map(r => {
        const spot = Spot.findById(r.spotId);
        return { ...r, spotName: spot ? spot.name : 'Deleted spot' };
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
        user: req.user,
        spots: Spot.getAll().filter(s => mine(s.addedBy)),
        pending: PendingSpot.getAll().filter(s => mine(s.submittedBy)),
        reviews: myReviews
    });
});

app.post('/api/contact', (req, res) => {
    const { name, email, subject, body } = req.body;
    if (!name || !email || !body) {
        return res.status(400).json({ error: 'Name, email and message are required.' });
    }

    const saved = Message.create({
        name, email, subject, body,
        fromUser: req.user ? req.user.username : ''
    });

    res.json({ ok: true, id: saved.id });
});

/* ---------- user management (admin) ---------- */

app.get('/api/users', requireAdmin, (req, res) => {
    const users = User.getAll().map(u => {
        const safe = User.safe(u);
        return {
            ...safe,
            spotCount: Spot.getAll().filter(s =>
                String(s.addedBy).toLowerCase() === String(u.username).toLowerCase()).length,
            reviewCount: Review.getByUser(u.username).length,
            pendingCount: PendingSpot.countBy(u.username),
            isYou: u.username === req.user.username
        };
    });
    res.json(users);
});

app.post('/api/users/:username/role', requireAdmin, (req, res) => {
    const target = User.findOne({ username: req.params.username });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (target.username === req.user.username && role !== 'admin') {
        return flash(res, '/admin/users', null, "You can't remove your own admin access.");
    }
    if (target.role === 'admin' && role !== 'admin' && User.countAdmins() <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    User.setRole(target.username, role);
    flash(res, '/admin/users', `${target.username} is now ${role === 'admin' ? 'an admin' : 'a member'}.`);
});

app.post('/api/users/:username/delete', requireAdmin, (req, res) => {
    const target = User.findOne({ username: req.params.username });
    if (!target) return flash(res, '/admin/users', null, 'That account no longer exists.');

    if (target.username === req.user.username) {
        return flash(res, '/admin/users', null, "You can't delete your own account while signed in.");
    }
    if (target.role === 'admin' && User.countAdmins() <= 1) {
        return flash(res, '/admin/users', null, 'There has to be at least one admin.');
    }

    User.remove(target.username);
    Review.removeByUser(target.username);        // their reviews go with them
    flash(res, '/admin/users', `Deleted ${target.username}.`);
});

app.get('/api/messages', requireAdmin, (req, res) => res.json(Message.getAll()));

app.post('/api/messages/:id/delete', requireAdmin, (req, res) => {
    Message.remove(req.params.id);
    flash(res, '/admin/pending', 'Message removed.');
});

/* ==========================================================================
   Fallbacks
   ========================================================================== */

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

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
