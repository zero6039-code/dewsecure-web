// ==========================================
// 📁 app-init.js
// 职责：极简入口，处理 Token 拦截、路由分发、Swup 初始化
// ==========================================

import './utils.js';
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

// 🌟 全局 Token 拦截器
async function interceptToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const extToken = urlParams.get('token');
    const extRefresh = urlParams.get('refresh') || extToken; // 兼容老用户
    
    if (extToken && window.supabaseClient) {
        try {
            console.log("📥 检测到插件 Token，尝试建立合法 Session...");
            const { error } = await window.supabaseClient.auth.setSession({
                access_token: extToken,
                refresh_token: extRefresh 
            });
            
            // 抹除 URL 参数
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            
            if (!error) {
                console.log("✅ Session 建立成功，强制刷新页面...");
                window.location.reload();
                return true; 
            } else {
                console.error("❌ Session 建立失败:", error);
                // 如果失败（比如老用户的假 refresh_token），强制跳回登录页
                if (!window.location.pathname.includes('login')) {
                    window.location.href = '/login/';
                    return true;
                }
            }
        } catch (e) {
            console.warn('Token 拦截异常:', e);
        }
    }
    return false;
}

async function routeAndInit() {
    const path = window.location.pathname;
    if (path.includes('/login')) {
        initAuthPage();
    } else if (path.includes('/dashboard')) {
        initDashboardLogic();
    } else if (path.includes('accept-invite')) {
        initAcceptInvitePage();
    }
    initComponentsPage();
}

document.addEventListener('DOMContentLoaded', async () => {
    const redirected = await interceptToken();
    if (redirected) return;

    routeAndInit();

    if (window.Swup) {
        window.swup = new Swup({ containers: ['#swup'] });
        window.swup.hooks.on('page:view', () => {
            routeAndInit();
            if (window.translatePage) window.translatePage();
        });
    }
});
