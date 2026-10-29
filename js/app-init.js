import { trackReferral } from './referral-tracker.js';
import './utils.js';
import './auth-nav.js'; 
import { initAuthPage } from './page-auth.js';
import { initDashboardLogic } from './page-dashboard.js';
import { initComponentsPage, initAcceptInvitePage } from './page-components.js';

// 🌟 动态适配 Chrome 与 Edge 扩展 ID
const isEdge = navigator.userAgent.includes('Edg/');
const EXTENSION_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';
let lastPushedToken = null;

// ==========================================
// 🌟 终极同步引擎：双向一致性保证
// ==========================================
setInterval(async () => {
    if (!window.supabaseClient) return;
    
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session) {
            // 如果发现网页端有登录态，且 Token 与上次推送不同，立刻强制覆盖插件
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
                            // 忽略未安装插件的报错
                        } else if (res && res.ok) {
                            lastPushedToken = session.access_token;
                        }
                    });
                }
            }
        } else {
            // 如果网页端退出了，也要通知插件退出（可选，但为了安全建议这样做）
            if (lastPushedToken !== null) {
                if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage(EXTENSION_ID, { type: 'LOGOUT' }, () => {});
                }
                lastPushedToken = null;
            }
        }
    } catch (e) {}
}, 1500); // 从 2 秒缩短到 1.5 秒，提高响应速度

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
            // 🌟 强力保险：延迟 100ms 重新加载当前语言包，确保 Swup 替换的 DOM 被完美翻译
            setTimeout(() => {
                const currentLang = localStorage.getItem('preferred_lang') || 'en';
                if (window.loadLanguage) {
                    window.loadLanguage(currentLang);
                } else if (window.translatePage) {
                    window.translatePage();
                }
            }, 100);
        });
    }
});

window.addEventListener('load', trackReferral);
document.addEventListener('swup:page:view', trackReferral);
