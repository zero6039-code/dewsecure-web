// ==========================================
// 📁 app-init.js
// 职责：极简入口，处理 Token 拦截、路由分发、Swup 初始化
// ==========================================

import './utils.js';
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

// 🌟 全局 Token 拦截器（必须在路由前）
async function interceptToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const extToken = urlParams.get('token');
    
    if (extToken && window.supabaseClient) {
        try {
            console.log("📥 检测到插件 Token，执行强制静默登录...");
            const { error } = await window.supabaseClient.auth.setSession({
                access_token: extToken,
                refresh_token: extToken 
            });
            
            // 无论如何，清理 URL 里的 token 参数
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            
            if (!error) {
                console.log("✅ 静默登录成功，正在刷新以应用状态...");
                // 清除 URL 参数
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
                
                // 强制刷新页面。刷新后 getSession 直接命中，不跳登录页
                window.location.reload();
                return true;
            } else {
                console.error("❌ 静默登录失败:", error);
            }
        } catch (e) {
            console.warn('Token 拦截异常:', e);
        }
    }
    return false;
}

async function routeAndInit() {
    // 1. 拦截 Token，如果成功跳转则终止本次执行
    const redirected = await interceptToken();
    if (redirected) return;

    // 2. 根据路径分发初始化
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
    if (redirected) return; // 有 Token 且需要跳转，直接停止，不初始化 Swup

    routeAndInit();

    if (window.Swup) {
        window.swup = new Swup({ containers: ['#swup'] });
        window.swup.hooks.on('page:view', () => {
            // 注意：Swup 切换页面后，不再执行 interceptToken，只执行页面业务逻辑
            routeAndInit();
            if (window.translatePage) window.translatePage();
        });
    }
});
