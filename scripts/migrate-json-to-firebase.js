const fs = require('fs');
const path = require('path');
const { getRealtimeDatabase } = require('../lib/firebase-admin');

const DATA_DIR = path.join(__dirname, '..', 'data');
const files = {
    users: 'users.json',
    spots: 'spots.json',
    pendingSpots: 'pending_spots.json',
    reviews: 'reviews.json',
    messages: 'messages.json'
};

function readJson(file) {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) return [];
    return JSON.parse(fs.readFileSync(fullPath, 'utf8') || '[]');
}

function keyFor(collection, item, index) {
    if (collection === 'users') return encodeURIComponent(String(item.username || index));
    if (collection === 'spots' || collection === 'pendingSpots') return String(item.id || index);
    if (collection === 'reviews' || collection === 'messages') return String(item.id || index);
    return String(index);
}

async function main() {
    const database = getRealtimeDatabase();
    const updates = {};

    for (const [collection, file] of Object.entries(files)) {
        for (const [index, item] of readJson(file).entries()) {
            updates[`${collection}/${keyFor(collection, item, index)}`] = item;
        }
    }

    if (!Object.keys(updates).length) {
        throw new Error('No JSON records found in data/. Nothing was migrated.');
    }

    await database.ref().update(updates);
    console.log(`Migrated ${Object.keys(updates).length} records to Realtime Database.`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
