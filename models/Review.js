const { getRealtimeDatabase } = require('../lib/firebase-admin');
const ref = () => getRealtimeDatabase().ref('reviews');

const Review = {
    async getAll() {
        const snapshot = await ref().once('value');
        return Object.values(snapshot.val() || {});
    },
    async getBySpotId(id) {
        return (await this.getAll()).filter(review => String(review.spotId) === String(id));
    },
    async getByUser(username) {
        return (await this.getAll()).filter(review =>
            String(review.username).toLowerCase() === String(username).toLowerCase());
    },
    async findById(id) {
        const snapshot = await ref().child(String(id)).once('value');
        return snapshot.val() || null;
    },
    async findByUserAndSpot(username, spotId) {
        return (await this.getAll()).find(review =>
            String(review.username).toLowerCase() === String(username).toLowerCase() &&
            String(review.spotId) === String(spotId)) || null;
    },
    async summaryFor(spotId) {
        const reviews = await this.getBySpotId(spotId);
        const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
        return {
            average: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : 0,
            count: reviews.length
        };
    },
    async save(data) {
        const rating = Math.min(5, Math.max(1, Number(data.rating) || 0));
        const comment = String(data.comment || '').trim().slice(0, 500);
        const existing = await this.findByUserAndSpot(data.username, data.spotId);
        if (existing) {
            const updated = { ...existing, rating, comment, updatedAt: new Date().toISOString() };
            await ref().child(String(existing.id)).set(updated);
            return { review: updated, updated: true };
        }

        const review = {
            id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
            spotId: String(data.spotId),
            username: String(data.username || '').trim(),
            rating,
            comment,
            createdAt: new Date().toISOString()
        };
        await ref().child(review.id).set(review);
        return { review, updated: false };
    },
    async remove(id) {
        const review = await this.findById(id);
        if (!review) return false;
        await ref().child(String(id)).remove();
        return true;
    },
    async removeBySpotId(id) {
        for (const review of await this.getBySpotId(id)) await this.remove(review.id);
    },
    async removeByUser(username) {
        for (const review of await this.getByUser(username)) await this.remove(review.id);
    }
};

module.exports = Review;
