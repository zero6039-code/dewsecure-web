import { Hono } from 'hono';
import { cors } from 'hono/cors';
import modelRoute from './routes/model.js';
import checkoutRoute from './routes/checkout.js';
import webhookRoute from './routes/webhook.js';
import cancelRoute from './routes/cancel.js';
import resumeRoute from './routes/resume.js';
import portalRoute from './routes/portal.js';
import trialRoute from './routes/trial.js'; // 🌟 新增的试用路由

const app = new Hono();

app.use('*', cors({
  origin: ['https://dewsecure.com', 'http://localhost:8888', 'http://127.0.0.1:8888'],
  allowHeaders: ['Authorization', 'Content-Type', 'stripe-signature'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

app.route('/api', modelRoute);
app.route('/api', checkoutRoute);
app.route('/api', webhookRoute);
app.route('/api', cancelRoute);
app.route('/api', resumeRoute);
app.route('/api', portalRoute);
app.route('/api', trialRoute); // 🌟 新增

export default app;
