const path = require('path');
const fs = require('fs');

const SPOTS_FILE = path.join(__dirname, '../data/spots.json');

const Spot = {
    getAll: function() {
        if (!fs.existsSync(SPOTS_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(SPOTS_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function(spots) {
        fs.writeFileSync(SPOTS_FILE, JSON.stringify(spots, null, 2));
    },

    findById: function(id) {
        const spots = this.getAll();
        return spots.find(spot => spot.id == id);
    },

    update: function(id, updatedData) {
        let spots = this.getAll();
        spots = spots.map(spot => {
            if (spot.id == id) {
                return {
                    ...spot,
                    name: updatedData.name,
                    city: updatedData.city,
                    seats: Number(updatedData.seats),
                    wifi: updatedData.wifi,
                    noise: updatedData.noise
                };
            }
            return spot;
        });
        this.saveAll(spots);
    },

    remove: function(id) {
        let spots = this.getAll();
        spots = spots.filter(spot => spot.id != id);
        this.saveAll(spots);
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
            id: spots.length > 0 ? spots[spots.length - 1].id + 1 : 1,
            name: spotData.name,
            city: spotData.city,
            seats: Number(spotData.seats),
            wifi: wifiChoice,
            noise: noiseChoice
        };

        spots.push(newSpot);
        this.saveAll(spots);
        return newSpot;
    }
};

module.exports = Spot;
