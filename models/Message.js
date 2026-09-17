const store = require('../lib/store');

const COLLECTION = 'messages';

/** Messages sent from the Contact page. Admins read them on /admin/pending. */
const Message = {
    getAll: async function () {
        const all = await store.readAll(COLLECTION);
        return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },

    saveAll: (messages) => store.writeAll(COLLECTION, messages),

    create: async function (data) {
        const messages = await store.readAll(COLLECTION);
        const message = {
            id: String(Date.now()),
            name: String(data.name || '').trim().slice(0, 80),
            email: String(data.email || '').trim().slice(0, 120),
            subject: String(data.subject || '').trim().slice(0, 120),
            body: String(data.body || '').trim().slice(0, 2000),
            fromUser: data.fromUser || '',
            createdAt: new Date().toISOString()
        };
        messages.push(message);
        await this.saveAll(messages);
        return message;
    },

    remove: async function (id) {
        const messages = await store.readAll(COLLECTION);
        const next = messages.filter(m => String(m.id) !== String(id));
        const removed = next.length !== messages.length;
        if (removed) await this.saveAll(next);
        return removed;
    }
};

module.exports = Message;
