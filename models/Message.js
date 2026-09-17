const path = require('path');
const fs = require('fs');

const MESSAGES_FILE = path.join(__dirname, '../data/messages.json');

/** Messages sent from the Contact page. Admins read them on /admin/pending. */
const Message = {
    getAll: function () {
        if (!fs.existsSync(MESSAGES_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function (messages) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    },

    create: function (data) {
        const messages = this.getAll();
        const message = {
            id: String(Date.now()),
            name: String(data.name || '').trim().slice(0, 80),
            email: String(data.email || '').trim().slice(0, 120),
            subject: String(data.subject || '').trim().slice(0, 120),
            body: String(data.body || '').trim().slice(0, 2000),
            fromUser: data.fromUser || '',
            createdAt: new Date().toISOString()
        };
        messages.unshift(message);            // newest first
        this.saveAll(messages);
        return message;
    },

    remove: function (id) {
        const messages = this.getAll();
        const next = messages.filter(m => String(m.id) !== String(id));
        const removed = next.length !== messages.length;
        if (removed) this.saveAll(next);
        return removed;
    }
};

module.exports = Message;
