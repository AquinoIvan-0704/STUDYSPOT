const path = require('path');
const fs = require('fs');

const USERS_FILE = path.join(__dirname, '../data/users.json');

const User = {
    getAll: function() {
        if (!fs.existsSync(USERS_FILE)) {
            return [];
        }
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return data ? JSON.parse(data) : [];
    },

    saveAll: function(users) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    },

    findOne: function(query) {
        const users = this.getAll();
        if (query.username) {
            return users.find(u => u.username === query.username);
        }
        return null;
    },

    create: function(userData) {
        const users = this.getAll();
        const newUser = {
            username: userData.username,
            password: userData.password,
            role: userData.role || 'user'
        };
        users.push(newUser);
        this.saveAll(users);
        return newUser;
    }
};

module.exports = User;
