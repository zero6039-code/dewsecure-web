import './utils.js';
import './auth-nav.js'; 
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

const EXTENSION_ID = 'fgnijfomipmimnfocgofmmniglibgnak';
let lastPushedToken = null;

// ==========================================
// 🌟 暴力同步引擎：每 2 秒检查一次 Session，确保插件必定同步
// ==========================================
setInterval(async () => {
    if (!window.supabaseClient) return;
    
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session && session.access_token !== lastPushedToken) {
            console.log("🚀 [暴力同步] 发现新 Token，准备推送给插件:", session.user.email);
            
            if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage(EXTENSION_ID, {
                    type: 'SYNC_AUTH',
                    payload: {
                        token: session.access_token,
                        refreshToken: session.refresh_token,
                        email: session.user.email
                    }
                }, (res) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ [同步失败]:', chrome.runtime.lastError.message);
                    } else if (res && res.ok) {
                        console.log("✅ [同步成功] 插件已接收 Token！");
                        lastPushedToken = session.access_token;
                    }
                });
            }
        }
    } catch (e) {
        // 忽略网络或 CSP 报错
    }
}, 2000);

// ==========================================
// 原有的路由拦截与初始化逻辑
// ==========================================
async function interceptToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const extToken = urlParams.get('token');
    const extRefresh = urlParams.get('refresh') || extToken;
    
    if (extToken && window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.auth.setSession({
                access_token: extToken,
                refresh_token: extRefresh 
            });
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            if (!error) { window.location.reload(); return true; }
        } catch (e) {}
    }
    return false;
}

async function routeAndInit() {
    const path = window.location.pathname;
    if (path.includes('/login')) initAuthPage();
    else if (path.includes('/dashboard')) initDashboardLogic();
    else if (path.includes('accept-invite')) initAcceptInvitePage();
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
            // 🌟 强力保险：延迟 50ms 强制重绘翻译，确保 DOM 已渲染完毕
            setTimeout(() => {
                if (window.translatePage) window.translatePage();
            }, 50);
        });
    }
});
