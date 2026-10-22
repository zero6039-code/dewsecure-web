import './utils.js';
// ==========================================
// 📁 app-init.js
// 职责：作为极简入口，负责 Token 拦截与根据当前页面路由分发逻辑。
// ==========================================

import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

async function routeAndInit() {
    // 1. 优先拦截 URL 上的 Token
    const urlParams = new URLSearchParams(window.location.search);
    const extToken = urlParams.get('token');
    
    if (extToken && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.auth.setSession({
                access_token: extToken,
                refresh_token: extToken
            });
            if (!error) {
                // 清除 URL 参数
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
                
                // 如果不在 dashboard，强制跳转
                if (!window.location.pathname.includes('dashboard')) {
                    window.location.replace('/dashboard.html');
                    return; // 阻断后续初始化
                }
            }
        } catch (e) { console.warn('Token 拦截异常:', e); }
    }

    // 2. 根据路径分发初始化逻辑
    const path = window.location.pathname;

    // 登录页
    if (path.includes('/login')) {
        initAuthPage();
    }
    // 控制台
    else if (path.includes('/dashboard')) {
        initDashboardLogic();
    }
    // 邀请页
    else if (path.includes('accept-invite')) {
        initAcceptInvitePage();
    }
    
    // 3. 通用组件（所有页面都可以有）
    initComponentsPage();
}

// ==========================================
// 启动与 Swup 无刷新路由集成
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    routeAndInit();

    if (window.Swup) {
        window.swup = new Swup({ containers: ['#swup'] });
        window.swup.hooks.on('page:view', () => {
            routeAndInit();
            if (window.translatePage) window.translatePage();
        });
    }
});
