const store = require('../lib/store');

const COLLECTION = 'reviews';

/**
 * One review per person per spot. Posting again updates the review you already
 * left instead of stacking duplicates, so nobody can inflate a rating by
 * submitting the same form repeatedly.
 */
const Review = {
    getAll: () => store.readAll(COLLECTION),
    saveAll: (reviews) => store.writeAll(COLLECTION, reviews),

    getBySpotId: async function (spotId) {
        const all = await this.getAll();
        return all
            .filter(r => String(r.spotId) === String(spotId))
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    },

    getByUser: async function (username) {
        if (!username) return [];
        const all = await this.getAll();
        return all.filter(r => String(r.username).toLowerCase() === String(username).toLowerCase());
    },

    findById: async function (id) {
        const all = await this.getAll();
        return all.find(r => String(r.id) === String(id));
    },

    findByUserAndSpot: async function (username, spotId) {
        if (!username) return null;
        const all = await this.getAll();
        return all.find(r =>
            String(r.spotId) === String(spotId) &&
            String(r.username).toLowerCase() === String(username).toLowerCase()) || null;
    },

    summaryFor: async function (spotId) {
        const list = await this.getBySpotId(spotId);
        if (!list.length) return { average: 0, count: 0 };
        const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        return { average: Math.round((total / list.length) * 10) / 10, count: list.length };
    },

    /** Creates, or updates the review this user already left for this spot. */
    save: async function (reviewData) {
        const reviews = await this.getAll();
        const rating = Math.min(5, Math.max(1, Number(reviewData.rating) || 0));
        const comment = String(reviewData.comment || '').trim().slice(0, 500);
        const username = String(reviewData.username || '').trim();

        const existing = reviews.find(r =>
            String(r.spotId) === String(reviewData.spotId) &&
            String(r.username).toLowerCase() === username.toLowerCase());

        if (existing) {
            existing.rating = rating;
            existing.comment = comment;
            existing.updatedAt = new Date().toISOString();
            await this.saveAll(reviews);
            return { review: existing, updated: true };
        }

        const newReview = {
            id: String(Date.now()) + Math.floor(Math.random() * 1000),
            spotId: String(reviewData.spotId),
            username,
            rating,
            comment,
            createdAt: new Date().toISOString()
        };
        reviews.push(newReview);
        await this.saveAll(reviews);
        return { review: newReview, updated: false };
    },

    remove: async function (id) {
        const reviews = await this.getAll();
        const next = reviews.filter(r => String(r.id) !== String(id));
        const removed = next.length !== reviews.length;
        if (removed) await this.saveAll(next);
        return removed;
    },

    removeBySpotId: async function (spotId) {
        const reviews = await this.getAll();
        const next = reviews.filter(r => String(r.spotId) !== String(spotId));
        if (next.length !== reviews.length) await this.saveAll(next);
    },

    removeByUser: async function (username) {
        const reviews = await this.getAll();
        const next = reviews.filter(r =>
            String(r.username).toLowerCase() !== String(username).toLowerCase());
        if (next.length !== reviews.length) await this.saveAll(next);
    }
};

module.exports = Review;
