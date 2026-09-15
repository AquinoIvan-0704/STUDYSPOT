const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const Spot = require('./models/Spot');
const User = require('./models/User');
const PendingSpot = require('./models/PendingSpot');

const app = express();
const PORT = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let currentUser = null;

app.get('/', (req, res) => {
    currentUser = null;
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = User.findOne({ username });
        if (!user) {
            return res.send('Invalid credentials. <a href="/">Try again</a>');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.send('Invalid credentials. <a href="/">Try again</a>');
        }

        currentUser = user;
        res.redirect('/studyspot');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error during login.');
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = User.findOne({ username });
        if (existingUser) {
            return res.status(400).send('User already exists! <a href="/signup">Try again</a>');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        User.create({ username, password: hashedPassword, role: 'user' });
        
        res.redirect('/');
    } catch (err) {
        console.error(err);
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
    if (currentUser && currentUser.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'add-spot.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'request-spot.html'));
    }
});

app.get('/admin/pending', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
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
    res.json(currentUser);
});

app.get('/api/spots', (req, res) => {
    const studySpots = Spot.getAll();
    res.json(studySpots);
});

app.get('/api/pending-spots', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
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
    if (currentUser && currentUser.role === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'edit-spot.html'));
    } else {
        res.status(403).send('Access denied.');
    }
});

app.get('/api/spot/:id', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
        const spot = Spot.findById(req.params.id);
        res.json(spot || {});
    } else {
        res.status(403).json({});
    }
});

app.post('/api/edit-spot/:id', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
        Spot.update(req.params.id, req.body);
        res.redirect('/spots');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.post('/api/delete-spot/:id', (req, res) => {
    console.log("Decline route hit for ID:", req.params.id);
    if (currentUser && currentUser.role === 'admin') {
        Spot.remove(req.params.id);
        res.redirect('/spots');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.post('/api/spots', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
        Spot.create(req.body);
        res.redirect('/spots');
    } else {
        PendingSpot.create(req.body);
        res.send('Spot request submitted successfully! It is waiting for admin approval. <a href="/studyspot">Back to Home</a>');
    }
});

app.post('/api/approve-spot/:id', (req, res) => {
    if (currentUser && currentUser.role === 'admin') {
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
    if (currentUser && currentUser.role === 'admin') {
        PendingSpot.remove(req.params.id);
        res.redirect('/admin/pending');
    } else {
        res.status(403).send('Access denied.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});