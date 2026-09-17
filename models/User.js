const { getRealtimeDatabase } = require('../lib/firebase-admin');
const ref = () => getRealtimeDatabase().ref('users');
const User = {
 async getAll(){const s=await ref().once('value');return Object.values(s.val()||{});},
 async findOne(q){const a=await this.getAll(),same=(x,y)=>x&&y&&String(x).toLowerCase()===String(y).toLowerCase();if(q.login)return a.find(u=>same(u.username,q.login)||same(u.email,q.login));if(q.username)return a.find(u=>same(u.username,q.username));if(q.email)return a.find(u=>same(u.email,q.email));return null;},
 async create(d){const u={username:String(d.username||'').trim(),email:String(d.email||'').trim(),password:d.password,role:d.role==='admin'?'admin':'user',createdAt:new Date().toISOString()};await ref().child(encodeURIComponent(u.username)).set(u);return u;},
 async update(n,c){const o=await this.findOne({username:n});if(!o)return null;const u={...o,...c,username:o.username};await ref().child(encodeURIComponent(o.username)).set(u);return u;},
 async setRole(n,r){return this.update(n,{role:r==='admin'?'admin':'user'});}, async remove(n){const o=await this.findOne({username:n});if(!o)return false;await ref().child(encodeURIComponent(o.username)).remove();return true;}, async countAdmins(){return (await this.getAll()).filter(u=>u.role==='admin').length;}, safe(u){if(!u)return null;const {password,...r}=u;return r;}
};module.exports=User;
