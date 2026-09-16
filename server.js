const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const passport = require('passport');
const session = require('express-session');
const Spot = require('./models/Spot');
const User = require('./models/User');
const PendingSpot = require('./models/PendingSpot');
const Review = require('./models/Review');

const app = express();
const PORT = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ 
    secret: 'studyspotsecret', 
    resave: false, 
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    console.log(`📥 INCOMING REQUEST: ${req.method} ${req.url}`);
    next();
});

passport.serializeUser((user, done) => done(null, user.username));

passport.deserializeUser((username, done) => {
    try {
        const user = User.findOne({ username });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

app.get('/', (req, res) => {
    req.logout?.((err) => {});
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = User.findOne({ username }) || User.findOne({ email: username });
        if (!user) {
            return res.send('Invalid credentials. <a href="/">Try again</a>');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.send('Invalid credentials. <a href="/">Try again</a>');
        }

        req.login(user, (err) => {
            if (err) {
                return res.status(500).send('Server error during login.');
            }
            req.session.save((err) => {
                if (err) {
                    return res.status(500).send('Session error.');
                }
                res.redirect('/studyspot');
            });
        });
    } catch (err) {
        res.status(500).send('Server error during login.');
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = User.findOne({ username }) || User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('User already exists! <a href="/">Try again</a>');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        User.create({ username, email, password: hashedPassword, role: 'user' });
        
        const newUser = User.findOne({ username });
        req.login(newUser, (err) => {
            if (err) {
                return res.status(500).send('Server error during registration.');
            }
            req.session.save((err) => {
                if (err) {
                    return res.status(500).send('Session error.');
                }
                res.redirect('/studyspot');
            });
        });
    } catch (err) {
        res.status(500).send('Server error during registration.');
    }
});

app.get('/studyspot', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'studyspot.html'));
});

app.get('/spots', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'spots.html'));
});

app.get('/add-spot', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'add-spot.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'request-spot.html'));
    }
});

app.get('/admin/pending', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'admin-pending.html'));
    } else {
        res.status(403).send('Access denied. Admins only.');
    }
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/api/current-user', (req, res) => {
    res.json(req.user || null);
});

app.get('/api/spots', (req, res) => {
    const studySpots = Spot.getAll();
    res.json(studySpots);
});

app.get('/api/pending-spots', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.json(PendingSpot.getAll());
    } else {
        res.status(403).json([]);
    }
});

app.get('/api/search', (req, res) => {
    const studySpots = Spot.getAll();
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    const filtered = studySpots.filter(spot => 
        spot.name.toLowerCase().includes(query) || 
        spot.city.toLowerCase().includes(query)
    );
    res.json(filtered);
});

app.get('/edit-spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'edit-spot.html'));
    } else {
        res.status(403).send('Access denied.');
    }
});

app.get('/api/spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        const spot = Spot.findById(req.params.id);
        res.json(spot || {});
    } else {
        res.status(403).json({});
    }
});

app.post('/api/edit-spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        Spot.update(req.params.id, req.body);
        res.redirect('/spots');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.post('/api/delete-spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        Spot.remove(req.params.id);
        res.redirect('/spots');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.post('/api/spots', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        Spot.create(req.body);
        res.redirect('/spots');
    } else {
        const activeUsername = (req.user && req.user.username) ? req.user.username : 'testuser';
        
        const spotData = {
            name: req.body.name,
            city: req.body.city,
            seats: req.body.seats,
            wifi: req.body.wifi,
            noise: req.body.noise,
            submittedBy: req.body.submittedBy || activeUsername
        };
        
        PendingSpot.create(spotData);
        res.send('Spot request submitted successfully! It is waiting for admin approval. <a href="/studyspot">Back to Home</a>');
    }
});

app.post('/api/approve-spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        const spotToApprove = PendingSpot.findById(req.params.id);
        if (spotToApprove) {
            Spot.create(spotToApprove);
            PendingSpot.remove(req.params.id);
        }
        res.redirect('/admin/pending');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.post('/api/decline-spot/:id', (req, res) => {
    if (req.user && req.user.role === 'admin') {
        const spotToDecline = PendingSpot.findById(req.params.id);
        if (spotToDecline) {
            PendingSpot.remove(req.params.id);
        }
        res.redirect('/admin/pending');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.get('/profile', (req, res) => {
    if (!req.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/api/user-profile', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(req.user);
});

app.post('/api/spots/:id/reviews', (req, res) => {
    if (!req.user) {
        return res.status(401).send('Unauthorized. <a href="/">Login first</a>');
    }
    const spotId = req.params.id;
    const { rating, comment } = req.body;
    
    Review.create({
        spotId,
        username: req.user.username,
        rating: Number(rating),
        comment
    });
    
    res.redirect('/spots');
});

app.get('/api/spots/:id/reviews', (req, res) => {
    const reviews = Review.getBySpotId(req.params.id);
    res.json(reviews);
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});