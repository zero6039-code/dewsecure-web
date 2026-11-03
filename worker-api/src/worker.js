import { Hono } from 'hono';
import { cors } from 'hono/cors';
import modelRoute from './routes/model.js';
import checkoutRoute from './routes/checkout.js';
import webhookRoute from './routes/webhook.js';
import cancelRoute from './routes/cancel.js';
import resumeRoute from './routes/resume.js';
import portalRoute from './routes/portal.js';
import trialRoute from './routes/trial.js';
import intelRoute from './routes/intel.js';

const app = new Hono();

// 🌟 修复 S-08：严格的白名单 CORS 配置
const ALLOWED_ORIGINS = new Set([
  'https://dewsecure.com',
  'https://www.dewsecure.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500' // 本地开发测试用
]);

const strictCors = cors({
  origin: (origin) => {
    // 服务端对服务端请求（如 Stripe Webhook）没有 origin，直接放行
    if (!origin) return '*';
    // 允许官方域名
    if (ALLOWED_ORIGINS.has(origin)) return origin;
    // 允许浏览器扩展调用（不写死ID，避免扩展升级或重新发布后ID变更导致失效）
    if (origin.startsWith('chrome-extension://') || origin.startsWith('extension://') || origin.startsWith('moz-extension://')) {
      return origin;
    }
    // 其他未知来源一律拒绝
    return undefined; 
  },
  allowHeaders: ['Authorization', 'Content-Type', 'stripe-signature', 'If-None-Match', 'X-Model-Version', 'X-Model-Sha256', 'X-Model-Signature', 'X-Model-Channel'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['ETag'],
});

// intel 是公开威胁情报，允许所有来源读取
const publicCors = cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
});

// 🌟 修复 S-08：路由级挂载。注意这里的路径前缀匹配
// 假设 intel 路由是 /api/intel 或 /api/intel/...
app.use('/api/intel/*', publicCors);
app.use('/api/intel', publicCors);

// 其他所有敏感接口使用严格白名单
app.use('/api/*', strictCors);

app.route('/api', modelRoute);
app.route('/api', checkoutRoute);
app.route('/api', webhookRoute);
app.route('/api', cancelRoute);
app.route('/api', resumeRoute);
app.route('/api', portalRoute);
app.route('/api', trialRoute);
app.route('/api', intelRoute);

export default app;
