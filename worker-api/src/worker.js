import { Hono } from 'hono';
import { cors } from 'hono/cors';
import modelRoute from './routes/model.js';
import checkoutRoute from './routes/checkout.js';
import webhookRoute from './routes/webhook.js';
import cancelRoute from './routes/cancel.js';
import resumeRoute from './routes/resume.js';
import portalRoute from './routes/portal.js';
import trialRoute from './routes/trial.js';
import intelRoute from './routes/intel.js'; // 🛡️ 威胁情报下发

const app = new Hono();

// 🌟 Service Worker 特权请求不需要严格的 Origin 限制
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type', 'stripe-signature', 'If-None-Match'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['ETag'],
}));

app.route('/api', modelRoute);
app.route('/api', checkoutRoute);
app.route('/api', webhookRoute);
app.route('/api', cancelRoute);
app.route('/api', resumeRoute);
app.route('/api', portalRoute);
app.route('/api', trialRoute); // 🌟 新增
app.route('/api', intelRoute); // 🛡️ 威胁情报下发

export default app;
