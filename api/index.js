// =========================================================================
//  Vercel serverless entry point.
//  Vercel's Node.js functions receive native (req, res) objects, and an
//  Express app IS a valid (req, res) => void handler (it's literally what
//  you'd pass to http.createServer) — so no adapter library is needed, we
//  just call the app directly. vercel.json rewrites every /api/* request to
//  this file. The app (and its MySQL pool / db.init() call) is built once
//  per cold start and reused for subsequent warm invocations.
//  Note: no dotenv here — Vercel injects the Environment Variables you set
//  in its dashboard directly into process.env in production. For local
//  testing with `vercel dev`, the CLI auto-loads a root-level .env the same
//  way (see docs/DEPLOY.md). dotenv is only used by backend/src/server.js
//  for the plain `npm start` local-dev path.
// =========================================================================
const { createApp } = require('../backend/src/app');

let appPromise = null;

function getApp() {
  if (!appPromise) appPromise = createApp();
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  app(req, res);
};
