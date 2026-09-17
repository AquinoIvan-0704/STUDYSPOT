const { getRealtimeDatabase } = require('../lib/firebase-admin');
const make = name => getRealtimeDatabase().ref(name);
const base = (name) => ({ async getAll(){const s=await make(name).once('value');return Object.values(s.val()||{});}, async remove(id){const s=await make(name).child(String(id)).once('value');if(!s.exists())return false;await make(name).child(String(id)).remove();return true;} });
module.exports = base;
