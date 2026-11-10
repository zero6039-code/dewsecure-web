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
    else if (path.includes('/dashboard')) {
        initDashboardLogic();
        // 🛡️ 修复：兼容 Swup 跳转，主动触发通知加载
        if (typeof window.initNotifications === 'function') {
            setTimeout(window.initNotifications, 100);
        }
    }
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

// ==========================================
// 🚀 全局 Google 登录逻辑 (兼容 Swup 无刷新跳转)
// ==========================================
const supabaseUrl = 'https://uvbaioqqjqseapcancvi.supabase.co';
// 注意：这里使用与 auth-nav.js 一致的 Publishable Key
const supabaseKey = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';

document.addEventListener('click', async (e) => {
    const googleBtn = e.target.closest('#googleLoginBtn');
    if (!googleBtn) return;

    e.preventDefault();

    // 🛡️ 延迟初始化：如果 window.supabaseClient 没准备好，尝试现场创建
    let client = window.supabaseClient;
    if (!client) {
        if (window.supabase) {
            client = window.supabase.createClient(supabaseUrl, supabaseKey);
            window.supabaseClient = client;
        } else {
            console.error(window.t ? window.t('auth_sdk_loading') : 'Service is loading, please try again later.');
            return;
        }
    }

    // 防止重复点击
    if (googleBtn.disabled) return;
    googleBtn.disabled = true;
    const originalHTML = googleBtn.innerHTML;
    googleBtn.innerHTML = window.t ? window.t('auth_google_redirecting') : 'Redirecting...';

    try {
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'https://dewsecure.com/dashboard/'
            }
        });

        if (error) {
            console.error('Google login error:', error.message);
            alert(window.t ? window.t('auth_google_login_failed') : 'Google login failed, please try again later.');
            googleBtn.disabled = false;
            googleBtn.innerHTML = originalHTML;
        }
    } catch (err) {
        console.error('Google 登录异常:', err);
        googleBtn.disabled = false;
        googleBtn.innerHTML = originalHTML;
    }
});

// 🛡️ 修复：当用户从 Google 授权页点击“返回”时，通过 BFCache 恢复页面会导致按钮卡死
window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = '<i class="fa-brands fa-google"></i>'; // 恢复默认图标
        }
    }
});
