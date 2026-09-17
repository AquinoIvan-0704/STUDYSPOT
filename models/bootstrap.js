const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

/**
 * Makes sure /data exists and holds every JSON file the models expect.
 *
 * Older copies of this project kept spots.json / users.json / pending_spots.json
 * loose in the project root. If we find them there and /data doesn't have them
 * yet, we copy them across so no spots, accounts or requests are lost when the
 * new code starts reading from /data.
 */
function ensureData() {
    if (!fs.existsSync(DATA)) {
        fs.mkdirSync(DATA, { recursive: true });
        console.log('Created data/ folder.');
    }

    // files that may exist in the old location
    ['spots.json', 'users.json', 'pending_spots.json'].forEach((file) => {
        const target = path.join(DATA, file);
        const legacy = path.join(ROOT, file);

        if (fs.existsSync(target)) return;                 // already migrated

        if (fs.existsSync(legacy)) {
            fs.copyFileSync(legacy, target);
            console.log(`Moved ${file} into data/ (the original is still in the project root as a backup).`);
        } else {
            fs.writeFileSync(target, '[]');
        }
    });

    // files this version added
    ['reviews.json', 'messages.json'].forEach((file) => {
        const target = path.join(DATA, file);
        if (!fs.existsSync(target)) {
            fs.writeFileSync(target, '[]');
            console.log(`Created data/${file}.`);
        }
    });
}

module.exports = { ensureData };
