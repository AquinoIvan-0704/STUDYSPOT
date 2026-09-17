const path = require('path');
const fs = require('fs');

const PENDING_FILE = path.join(__dirname, '../data/pending_spots.json');

/** Spot requests submitted by regular users, waiting for admin approval. */
const PendingSpot = {
    getAll: function () {
        if (!fs.existsSync(PENDING_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(PENDING_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function (spots) {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(spots, null, 2));
    },

    findById: function (id) {
        return this.getAll().find(spot => String(spot.id) === String(id));
    },

    create: function (spotData) {
        const spots = this.getAll();
        const newSpot = {
            id: Date.now(),
            name: String(spotData.name || '').trim(),
            city: String(spotData.city || '').trim(),
            seats: Math.max(0, Number(spotData.seats) || 0),
            wifi: spotData.wifi || 'No Wi-Fi',
            noise: spotData.noise || 'Moderate',
            hours: spotData.hours ? String(spotData.hours).trim() : '',
            description: spotData.description ? String(spotData.description).trim() : '',
            image: String(spotData.image || '').trim().slice(0, 500),
            submittedBy: spotData.submittedBy || '',      // kept so the admin sees who asked
            requestedAt: new Date().toISOString()
        };
        spots.push(newSpot);
        this.saveAll(spots);
        return newSpot;
    },

    remove: function (id) {
        const spots = this.getAll();
        const next = spots.filter(spot => String(spot.id) !== String(id));
        const removed = next.length !== spots.length;
        if (removed) this.saveAll(next);
        return removed;
    },

    countBy: function (username) {
        if (!username) return 0;
        return this.getAll().filter(s =>
            String(s.submittedBy).toLowerCase() === String(username).toLowerCase()).length;
    }
};

module.exports = PendingSpot;
