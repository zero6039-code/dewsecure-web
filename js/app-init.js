import { trackReferral } from './referral-tracker.js';
import { pushAuthStateToExtension, clearAuthInExtension } from './dashboard-sync.js'; // 🌟 引入统一方法
import './utils.js';
import './auth-nav.js'; 
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

// ==========================================
// 原有的路由拦截与初始化逻辑
// ==========================================
async function interceptToken() {
    if (window.location.pathname.includes('accept-invite')) {
        return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    
    let extToken = urlParams.get('token') || sessionStorage.getItem('ds_handoff_token');
    let extRefresh = urlParams.get('refresh') || sessionStorage.getItem('ds_handoff_refresh') || extToken;

    if (sessionStorage.getItem('ds_handoff_token')) {
        sessionStorage.removeItem('ds_handoff_token');
        sessionStorage.removeItem('ds_handoff_refresh');
    }
    
    if (extToken && window.supabaseClient) {
        try {
            const { data: { session: currentSession } } = await window.supabaseClient.auth.getSession();
            if (currentSession && currentSession.access_token !== extToken) {
                console.warn("⚠️ [安全拦截] 检测到已登录状态下尝试通过 URL 注入新 Token，已拦截防覆盖攻击。");
                return false;
            }

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
            if (window.fallbackTranslations && window.translatePage) {
                window.translatePage();
                window.dispatchEvent(new Event('languageChanged'));
            }
        });
    }

    // 🌟 核心优化：使用 onAuthStateChange 替代 1.5 秒轮询
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            // 处理登录和 Token 刷新
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (session) {
                    window.DEBUG_LOG("🚀 [事件同步] 检测到网页端登录/刷新，推送到插件:", session.user?.email);
                    pushAuthStateToExtension(session);
                }
            } 
            // 处理登出
            else if (event === 'SIGNED_OUT') {
                window.DEBUG_LOG("🚪 [事件同步] 检测到网页端登出，通知插件");
                clearAuthInExtension();
            }
        });
    }
});

window.addEventListener('load', trackReferral);
document.addEventListener('swup:page:view', trackReferral);
