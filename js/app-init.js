import { trackReferral } from './referral-tracker.js';
import './utils.js';
import './auth-nav.js'; 
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

// 🌟 修复 L-5：Edge 后台分配的真实 32 位 ID
const isEdge = navigator.userAgent.includes('Edg/');
const EXTENSION_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjggggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';
let lastPushedToken = null;

// ==========================================
// 🌟 终极同步引擎：双向一致性保证
// ==========================================
setInterval(async () => {
    if (!window.supabaseClient) return;
    
    try {
        // 🌟 核心修复：强制刷新 Token，防止同步给扩展的 Token 已过期导致 401 错误
        const { data: { session }, error: refreshErr } = await window.supabaseClient.auth.refreshSession();
        
        if (session && !refreshErr) {
            if (session.access_token !== lastPushedToken) {
                console.log("🚀 [强制同步] 检测到网页端已登录，正在覆盖插件状态:", session.user.email);
                
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
                            // 不再静默吞掉错误，输出警告
                            console.warn("插件同步通信失败 (请检查 manifest 是否配置 externally_connectable 或插件是否安装):", chrome.runtime.lastError.message);
                        } else if (res && res.ok) {
                            lastPushedToken = session.access_token;
                        }
                    });
                }
            }
        } else {
            if (lastPushedToken !== null) {
                if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage(EXTENSION_ID, { type: 'LOGOUT' }, () => {});
                }
                lastPushedToken = null;
            }
        }
    } catch (e) {}
}, 1500);

// ==========================================
// 原有的路由拦截与初始化逻辑
// ==========================================
async function interceptToken() {
    if (window.location.pathname.includes('accept-invite')) {
        return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    
    // 🔒 H4 修复：优先从 URL 读取，其次从 dashboard.html 注入的 sessionStorage 读取
    let extToken = urlParams.get('token') || sessionStorage.getItem('ds_handoff_token');
    let extRefresh = urlParams.get('refresh') || sessionStorage.getItem('ds_handoff_refresh') || extToken;

    // ⚠️ 极其重要：读取后立即销毁 sessionStorage，防止页面 reload 导致无限死循环
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
});

window.addEventListener('load', trackReferral);
document.addEventListener('swup:page:view', trackReferral);
