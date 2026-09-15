
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

    create: function(spotData) {
        const spots = this.getAll();
        
        let wifiChoice = 'No Wi-Fi';
        if (spotData.wifi && spotData.wifi.toLowerCase() === 'available') {
            wifiChoice = 'Available';
        }

        let noiseChoice = 'Moderate';
        if (spotData.noise) {
            const lowerNoise = spotData.noise.toLowerCase();
            if (lowerNoise.includes('quiet')) {
                noiseChoice = 'Quiet';
            } else if (lowerNoise.includes('loud')) {
                noiseChoice = 'Loud';
            } else if (lowerNoise.includes('moderate')) {
                noiseChoice = 'Moderate';
            }
        }

        const newSpot = {
            id: Date.now(),
            name: spotData.name,
            city: spotData.city,
            seats: Number(spotData.seats),
            wifi: wifiChoice,
            noise: noiseChoice,
            submittedBy: spotData.submittedBy || 'User'
        };
        
        spots.push(newSpot);
        this.saveAll(spots);
        return newSpot;
    },

    remove: function(id) {
        let spots = this.getAll();
        spots = spots.filter(spot => spot.id !== Number(id));
        this.saveAll(spots);
    },

    findById: function(id) {
        const spots = this.getAll();
        return spots.find(spot => spot.id === Number(id));
    }
};

module.exports = PendingSpot;