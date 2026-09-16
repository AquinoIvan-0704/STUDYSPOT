let reviews = [];

module.exports = {
    create: (reviewData) => {
        const newReview = { id: Date.now().toString(), ...reviewData };
        reviews.push(newReview);
        return newReview;
    },
    getBySpotId: (spotId) => {
        return reviews.filter(r => r.spotId === spotId);
    }
};