const path = require('path');
const fs = require('fs');

const REVIEWS_FILE = path.join(__dirname, '../data/reviews.json');

/**
 * Reviews are saved to data/reviews.json.
 * (They used to live in a plain array in memory, so every server restart
 *  wiped them — writing to disk is what makes them stick.)
 */
const Review = {
    getAll: function () {
        if (!fs.existsSync(REVIEWS_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(REVIEWS_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function (reviews) {
        fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
    },

    getBySpotId: function (spotId) {
        return this.getAll()
            .filter(r => String(r.spotId) === String(spotId))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },

    getByUser: function (username) {
        if (!username) return [];
        return this.getAll().filter(r =>
            String(r.username).toLowerCase() === String(username).toLowerCase());
    },

    findById: function (id) {
        return this.getAll().find(r => String(r.id) === String(id));
    },

    /** Average rating + count for one spot, used by the cards and detail panel. */
    summaryFor: function (spotId) {
        const list = this.getBySpotId(spotId);
        if (!list.length) return { average: 0, count: 0 };
        const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        return { average: Math.round((total / list.length) * 10) / 10, count: list.length };
    },

    create: function (reviewData) {
        const reviews = this.getAll();
        const rating = Math.min(5, Math.max(1, Number(reviewData.rating) || 0));

        const newReview = {
            id: String(Date.now()) + Math.floor(Math.random() * 1000),
            spotId: String(reviewData.spotId),
            username: String(reviewData.username || '').trim(),
            rating: rating,
            comment: String(reviewData.comment || '').trim().slice(0, 500),
            createdAt: new Date().toISOString()
        };

        reviews.push(newReview);
        this.saveAll(reviews);
        return newReview;
    },

    remove: function (id) {
        const reviews = this.getAll();
        const next = reviews.filter(r => String(r.id) !== String(id));
        const removed = next.length !== reviews.length;
        if (removed) this.saveAll(next);
        return removed;
    },

    /** Called when a spot is deleted so its reviews don't linger. */
    removeBySpotId: function (spotId) {
        const reviews = this.getAll();
        const next = reviews.filter(r => String(r.spotId) !== String(spotId));
        if (next.length !== reviews.length) this.saveAll(next);
    }
};

module.exports = Review;
