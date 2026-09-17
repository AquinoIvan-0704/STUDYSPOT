const store = require('../lib/store');

const COLLECTION = 'pending_spots';

/** Spot requests submitted by regular members, waiting for admin approval. */
const PendingSpot = {
    getAll: () => store.readAll(COLLECTION),
    saveAll: (spots) => store.writeAll(COLLECTION, spots),

    findById: async function (id) {
        const spots = await this.getAll();
        return spots.find(spot => String(spot.id) === String(id));
    },

    create: async function (spotData) {
        const spots = await this.getAll();
        const newSpot = {
            id: String(Date.now()),
            name: String(spotData.name || '').trim(),
            city: String(spotData.city || '').trim(),
            seats: Math.max(0, Number(spotData.seats) || 0),
            wifi: spotData.wifi || 'No Wi-Fi',
            noise: spotData.noise || 'Moderate',
            hours: spotData.hours ? String(spotData.hours).trim() : '',
            description: spotData.description ? String(spotData.description).trim() : '',
            image: String(spotData.image || '').trim().slice(0, 500),
            submittedBy: spotData.submittedBy || '',     // kept so the admin sees who asked
            requestedAt: new Date().toISOString()
        };
        spots.push(newSpot);
        await this.saveAll(spots);
        return newSpot;
    },

    remove: async function (id) {
        const spots = await this.getAll();
        const next = spots.filter(spot => String(spot.id) !== String(id));
        const removed = next.length !== spots.length;
        if (removed) await this.saveAll(next);
        return removed;
    },

    countBy: async function (username) {
        if (!username) return 0;
        const spots = await this.getAll();
        return spots.filter(s =>
            String(s.submittedBy).toLowerCase() === String(username).toLowerCase()).length;
    }
};

module.exports = PendingSpot;
