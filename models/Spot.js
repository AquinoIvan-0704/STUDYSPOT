const store = require('../lib/store');

const COLLECTION = 'spots';

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

/** Only allow an http(s) link or a site-relative path as an image. */
function safeImage(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    return /^(https?:\/\/|\/)/i.test(v) ? v.slice(0, 500) : '';
}

const Spot = {
    getAll: () => store.readAll(COLLECTION),
    saveAll: (spots) => store.writeAll(COLLECTION, spots),

    findById: async function (id) {
        const spots = await this.getAll();
        return spots.find(spot => String(spot.id) === String(id));
    },

    /** Highest id + 1 — safe even after spots in the middle have been deleted. */
    nextId: (spots) => spots.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1,

    create: async function (spotData) {
        const spots = await this.getAll();
        const newSpot = {
            id: this.nextId(spots),
            name: String(spotData.name || '').trim(),
            city: String(spotData.city || '').trim(),
            seats: Math.max(0, Number(spotData.seats) || 0),
            wifi: normaliseWifi(spotData.wifi),
            noise: normaliseNoise(spotData.noise),
            hours: spotData.hours ? String(spotData.hours).trim() : '',
            description: spotData.description ? String(spotData.description).trim() : '',
            image: safeImage(spotData.image),
            addedBy: spotData.addedBy || spotData.submittedBy || '',
            createdAt: new Date().toISOString()
        };
        spots.push(newSpot);
        await this.saveAll(spots);
        return newSpot;
    },

    update: async function (id, updatedData) {
        const spots = await this.getAll();
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
                image: updatedData.image !== undefined ? safeImage(updatedData.image) : (spot.image || ''),
                updatedAt: new Date().toISOString()
            };
            return updated;
        });

        if (updated) await this.saveAll(next);
        return updated;
    },

    remove: async function (id) {
        const spots = await this.getAll();
        const next = spots.filter(spot => String(spot.id) !== String(id));
        const removed = next.length !== spots.length;
        if (removed) await this.saveAll(next);
        return removed;
    },

    search: async function (query) {
        const q = String(query || '').trim().toLowerCase();
        const spots = await this.getAll();
        if (!q) return spots;
        return spots.filter(spot =>
            String(spot.name).toLowerCase().includes(q) ||
            String(spot.city).toLowerCase().includes(q));
    }
};

module.exports = Spot;
