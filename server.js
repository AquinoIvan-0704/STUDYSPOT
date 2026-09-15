const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const studySpots = [
    { id: 1, name: 'Community Library', city: 'San Pablo City', seats: 20, wifi: 'Available', noise: 'Quiet' },
    { id: 2, name: 'Student Study Hub', city: 'City Center', seats: 8, wifi: 'Available', noise: 'Moderate' },
    { id: 3, name: 'Reading Center', city: 'Barangay Hail', seats: 15, wifi: 'No Wi-Fi', noise: 'Quiet' }
];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password') {
        res.redirect('/studyspot');
    } else {
        res.send('Invalid credentials. <a href="/">Try again</a>');
    }
});

app.get('/studyspot', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'studyspot.html'));
});

app.get('/spots', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'spots.html'));
});

app.get('/add-spot', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'add-spot.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/api/spots', (req, res) => {
    res.json(studySpots);
});

app.get('/api/search', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    const filtered = studySpots.filter(spot => 
        spot.name.toLowerCase().includes(query) || 
        spot.city.toLowerCase().includes(query)
    );
    res.json(filtered);
});

app.post('/api/spots', (req, res) => {
    const newSpot = {
        id: studySpots.length + 1,
        name: req.body.name,
        city: req.body.city,
        seats: req.body.seats,
        wifi: req.body.wifi,
        noise: req.body.noise
    };
    studySpots.push(newSpot);
    res.redirect('/spots');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});