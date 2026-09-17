const path = require('path');
const fs = require('fs');

const USERS_FILE = path.join(__dirname, '../data/users.json');

/**
 * Users are stored in data/users.json.
 * Passwords are always stored as bcrypt hashes — never plain text.
 */
const User = {
    getAll: function () {
        if (!fs.existsSync(USERS_FILE)) {
            this.saveAll([]);
            return [];
        }
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function (users) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    },

    /**
     * Accepts { username }, { email } or { login } (matches either field).
     * Matching is case-insensitive so "Ivan" and "ivan" are the same account.
     */
    findOne: function (query) {
        const users = this.getAll();
        const same = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();

        if (query.login) {
            return users.find(u => same(u.username, query.login) || same(u.email, query.login));
        }
        if (query.username) return users.find(u => same(u.username, query.username));
        if (query.email)    return users.find(u => same(u.email, query.email));
        return null;
    },

    create: function (userData) {
        const users = this.getAll();
        const newUser = {
            username: String(userData.username || '').trim(),
            email: String(userData.email || '').trim(),
            password: userData.password,          // already hashed by the caller
            role: userData.role === 'admin' ? 'admin' : 'user',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        this.saveAll(users);
        return newUser;
    },

    update: function (username, changes) {
        const users = this.getAll();
        let updated = null;
        const next = users.map(u => {
            if (String(u.username).toLowerCase() !== String(username).toLowerCase()) return u;
            updated = { ...u, ...changes, username: u.username };   // username is the key, never changed here
            return updated;
        });
        this.saveAll(next);
        return updated;
    },

    /** Promote or demote. Guarded by countAdmins() in the route. */
    setRole: function (username, role) {
        return this.update(username, { role: role === 'admin' ? 'admin' : 'user' });
    },

    remove: function (username) {
        const users = this.getAll();
        const next = users.filter(u =>
            String(u.username).toLowerCase() !== String(username).toLowerCase());
        const removed = next.length !== users.length;
        if (removed) this.saveAll(next);
        return removed;
    },

    countAdmins: function () {
        return this.getAll().filter(u => u.role === 'admin').length;
    },

    /** Never hand the password hash to the browser. */
    safe: function (user) {
        if (!user) return null;
        const { password, ...rest } = user;
        return rest;
    }
};

module.exports = User;
