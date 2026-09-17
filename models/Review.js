const path = require('path');
const fs = require('fs');

const REVIEWS_FILE = path.join(__dirname, '../data/reviews.json');

/**
 * Reviews are saved to data/reviews.json.
 *
 * Rule: one review per person per spot. Posting again updates the review you
 * already left instead of stacking duplicates, so nobody can inflate a spot's
 * rating by submitting the same form over and over.
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
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    },

    getByUser: function (username) {
        if (!username) return [];
        return this.getAll().filter(r =>
            String(r.username).toLowerCase() === String(username).toLowerCase());
    },

    findById: function (id) {
        return this.getAll().find(r => String(r.id) === String(id));
    },

    /** The review this person already left for this spot, if any. */
    findByUserAndSpot: function (username, spotId) {
        if (!username) return null;
        return this.getAll().find(r =>
            String(r.spotId) === String(spotId) &&
            String(r.username).toLowerCase() === String(username).toLowerCase()) || null;
    },

    summaryFor: function (spotId) {
        const list = this.getBySpotId(spotId);
        if (!list.length) return { average: 0, count: 0 };
        const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        return { average: Math.round((total / list.length) * 10) / 10, count: list.length };
    },

    /**
     * Creates the review, or updates the one this user already left.
     * Returns { review, updated } so the caller can word the message correctly.
     */
    save: function (reviewData) {
        const reviews = this.getAll();
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
            this.saveAll(reviews);
            return { review: existing, updated: true };
        }

        const newReview = {
            id: String(Date.now()) + Math.floor(Math.random() * 1000),
            spotId: String(reviewData.spotId),
            username: username,
            rating: rating,
            comment: comment,
            createdAt: new Date().toISOString()
        };
        reviews.push(newReview);
        this.saveAll(reviews);
        return { review: newReview, updated: false };
    },

    remove: function (id) {
        const reviews = this.getAll();
        const next = reviews.filter(r => String(r.id) !== String(id));
        const removed = next.length !== reviews.length;
        if (removed) this.saveAll(next);
        return removed;
    },

    removeBySpotId: function (spotId) {
        const reviews = this.getAll();
        const next = reviews.filter(r => String(r.spotId) !== String(spotId));
        if (next.length !== reviews.length) this.saveAll(next);
    },

    /** Used when an account is deleted. */
    removeByUser: function (username) {
        const reviews = this.getAll();
        const next = reviews.filter(r =>
            String(r.username).toLowerCase() !== String(username).toLowerCase());
        if (next.length !== reviews.length) this.saveAll(next);
    }
};

module.exports = Review;
