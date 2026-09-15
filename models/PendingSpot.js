const path = require('path');
const fs = require('fs');

const PENDING_FILE = path.join(__dirname, '../pending_spots.json');

const PendingSpot = {
    getAll: function() {
        if (!fs.existsSync(PENDING_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(PENDING_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function(spots) {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(spots, null, 2));
    },

    findById: function(id) {
        const spots = this.getAll();
        return spots.find(spot => spot.id == id);
    },

    remove: function(id) {
        let spots = this.getAll();
        spots = spots.filter(spot => spot.id != id);
        this.saveAll(spots);
    },

    create: function(spotData) {
        const spots = this.getAll();
        const newSpot = {
            id: Date.now(),
            name: spotData.name,
            city: spotData.city,
            seats: Number(spotData.seats),
            wifi: spotData.wifi || 'No Wi-Fi',
            noise: spotData.noise || 'Moderate'
        };
        spots.push(newSpot);
        this.saveAll(spots);
        return newSpot;
    }
};

module.exports = PendingSpot;