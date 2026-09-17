const path = require('path');
const fs = require('fs');

const SPOTS_FILE = path.join(__dirname, '../data/spots.json');

/** Wi-Fi / noise values are normalised so the UI always gets known strings. */
function normaliseWifi(value) {
    return String(value || '').toLowerCase().includes('available') ? 'Available' : 'No Wi-Fi';
}

function normaliseNoise(value) {
    const v = String(value || '').toLowerCase();
    if (v.includes('quiet')) return 'Quiet';
    if (v.includes('loud'))  return 'Loud';
    return 'Moderate';
}

const Spot = {
    getAll: function () {
        if (!fs.existsSync(SPOTS_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(SPOTS_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function (spots) {
        fs.writeFileSync(SPOTS_FILE, JSON.stringify(spots, null, 2));
    },

    findById: function (id) {
        return this.getAll().find(spot => String(spot.id) === String(id));
    },

    /** Highest id + 1 — safe even after spots in the middle have been deleted. */
    nextId: function (spots) {
        return spots.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
    },

    create: function (spotData) {
        const spots = this.getAll();
        const newSpot = {
            id: this.nextId(spots),
            name: String(spotData.name || '').trim(),
            city: String(spotData.city || '').trim(),
            seats: Math.max(0, Number(spotData.seats) || 0),
            wifi: normaliseWifi(spotData.wifi),
            noise: normaliseNoise(spotData.noise),
            hours: spotData.hours ? String(spotData.hours).trim() : '',
            description: spotData.description ? String(spotData.description).trim() : '',
            addedBy: spotData.addedBy || spotData.submittedBy || '',
            createdAt: new Date().toISOString()
        };
        spots.push(newSpot);
        this.saveAll(spots);
        return newSpot;
    },

    update: function (id, updatedData) {
        const spots = this.getAll();
        let updated = null;

        const next = spots.map(spot => {
            if (String(spot.id) !== String(id)) return spot;
            updated = {
                ...spot,
                name: String(updatedData.name ?? spot.name).trim(),
                city: String(updatedData.city ?? spot.city).trim(),
                seats: Math.max(0, Number(updatedData.seats) || 0),
                wifi: normaliseWifi(updatedData.wifi),
                noise: normaliseNoise(updatedData.noise),
                hours: updatedData.hours !== undefined ? String(updatedData.hours).trim() : (spot.hours || ''),
                description: updatedData.description !== undefined
                    ? String(updatedData.description).trim()
                    : (spot.description || ''),
                updatedAt: new Date().toISOString()
            };
            return updated;
        });

        this.saveAll(next);
        return updated;
    },

    remove: function (id) {
        const spots = this.getAll();
        const next = spots.filter(spot => String(spot.id) !== String(id));
        const removed = next.length !== spots.length;
        if (removed) this.saveAll(next);
        return removed;
    },

    search: function (query) {
        const q = String(query || '').trim().toLowerCase();
        const spots = this.getAll();
        if (!q) return spots;
        return spots.filter(spot =>
            String(spot.name).toLowerCase().includes(q) ||
            String(spot.city).toLowerCase().includes(q)
        );
    }
};

module.exports = Spot;
