// ==========================================
// 📁 worker.js
// 职责：极简静态资源分发器，解决 Cloudflare 找不到入口的问题
// ==========================================
export default {
  async fetch(request, env, ctx) {
    // 直接交由 Cloudflare 静态资源绑定处理
    return env.ASSETS.fetch(request);
  }
};
