const path = require('path');
const fs = require('fs');

const SPOTS_FILE = path.join(__dirname, '../spots.json');

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