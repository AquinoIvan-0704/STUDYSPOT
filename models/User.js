const store = require('../lib/store');

const COLLECTION = 'users';

/**
 * Profile records for signed-in people.
 *
 * Passwords are NOT stored here any more — Firebase Auth owns credentials and
 * Google sign-in. This collection only holds the app-level profile: which
 * Firebase uid it belongs to, the display username, and the role.
 */
const User = {
    getAll: () => store.readAll(COLLECTION),
    saveAll: (users) => store.writeAll(COLLECTION, users),

    /** Accepts { id } (the Firebase uid), { username }, { email } or { login }. */
    findOne: async function (query) {
        const users = await this.getAll();
        const same = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();

        if (query.id)       return users.find(u => String(u.id) === String(query.id));
        if (query.login)    return users.find(u => same(u.username, query.login) || same(u.email, query.login));
        if (query.username) return users.find(u => same(u.username, query.username));
        if (query.email)    return users.find(u => same(u.email, query.email));
        return null;
    },

    create: async function (userData) {
        const users = await this.getAll();
        const newUser = {
            id: String(userData.id),                       // Firebase uid
            username: String(userData.username || '').trim(),
            email: String(userData.email || '').trim(),
            role: userData.role === 'admin' ? 'admin' : 'user',
            photo: userData.photo || '',
            provider: userData.provider || 'password',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        await this.saveAll(users);
        return newUser;
    },

    update: async function (id, changes) {
        const users = await this.getAll();
        let updated = null;
        const next = users.map(u => {
            if (String(u.id) !== String(id)) return u;
            updated = { ...u, ...changes, id: u.id };
            return updated;
        });
        if (updated) await this.saveAll(next);
        return updated;
    },

    setRole: function (id, role) {
        return this.update(id, { role: role === 'admin' ? 'admin' : 'user' });
    },

    remove: async function (id) {
        const users = await this.getAll();
        const next = users.filter(u => String(u.id) !== String(id));
        const removed = next.length !== users.length;
        if (removed) await this.saveAll(next);
        return removed;
    },

    countAdmins: async function () {
        const users = await this.getAll();
        return users.filter(u => u.role === 'admin').length;
    },

    /**
     * Turns a display name or email into a username nobody else is using.
     * "juan@mail.com" -> "juan", and "juan2" if "juan" is taken.
     */
    uniqueUsername: async function (preferred) {
        const users = await this.getAll();
        const taken = new Set(users.map(u => String(u.username).toLowerCase()));

        let base = String(preferred || '').trim().split('@')[0]
            .replace(/[^a-zA-Z0-9 _.-]/g, '').trim() || 'member';
        base = base.slice(0, 24);

        if (!taken.has(base.toLowerCase())) return base;
        let n = 2;
        while (taken.has(`${base}${n}`.toLowerCase())) n++;
        return `${base}${n}`;
    }
};

module.exports = User;
