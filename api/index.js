/* Vercel entry point.

   Vercel doesn't run "node server.js" — it imports a handler and calls it for
   each request. server.js exports the Express app for exactly this, and only
   calls app.listen() when you run it directly on your own machine. */

module.exports = require('../server.js');
