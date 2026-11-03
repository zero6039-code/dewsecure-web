import { esc } from './utils.js';
// js/auth-nav.js
(function() {
    'use strict';

    if (window._authNavLoaded) return;
    window._authNavLoaded = true;

    const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
    const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
    
    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    const supabaseClient = window.supabaseClient;


    function syncStateToExtension(session) {
        if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
        
        const isEdge = navigator.userAgent.includes('Edg/');
        const EXT_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';
        
        try {
            if (session) {
                chrome.runtime.sendMessage(EXT_ID, {
                    type: 'SYNC_AUTH',
                    payload: {
                        token: session.access_token,
                        refreshToken: session.refresh_token,
                        email: session.user.email,
                        tier: session.user.user_metadata?.tier || 'premium'
                    }
                }, (response) => { 
                    if (response && response.ok) console.log("✅ [网页端] 插件登录状态同步成功");
                });
            } else {
                console.log("ℹ️ [网页端] 当前为未登录状态，插件端保持原有状态不变。");
            }
        } catch (e) {
        }
    }

    function renderAuthState(session) {
        const header = document.querySelector('header');
        if (!header) return;

        let langSwitch = header.querySelector('.lang-switch');
        if (!langSwitch) return;

        header.querySelectorAll('nav a').forEach(a => {
            if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
                a.style.display = 'none';
            }
        });

        let headerRight = header.querySelector('.header-right');
        if (!headerRight) {
            headerRight = document.createElement('div');
            headerRight.className = 'header-right';
            langSwitch.parentNode.insertBefore(headerRight, langSwitch);
            headerRight.appendChild(langSwitch);
        }

        let authArea = document.getElementById('global-auth-area');
        if (!authArea) {
            authArea = document.createElement('div');
            authArea.id = 'global-auth-area';
            authArea.style.cssText = 'display: flex; align-items: center; gap: 12px;';
            headerRight.insertBefore(authArea, langSwitch);
        }

        if (session) {
            const rawEmail = session.user.email;
            const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;
            
            // 🌟 核心修复：转义邮箱
            const safeRawEmail = esc(rawEmail);
            const safeDisplayEmail = esc(displayEmail);

            const dashLink = header.querySelector('nav a[href="/dashboard.html"]');
            if (dashLink) dashLink.style.display = 'block';

            authArea.innerHTML = `
                <span title="${safeRawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${safeDisplayEmail}</span>
                <a href="/dashboard.html" data-i18n="nav_dashboard" style="color: #58a6ff; font-size: 14px; font-weight: 600; white-space: nowrap;">控制台</a>
                <button id="global-logout-btn" data-i18n="nav_logout" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap;">退出</button>
            `;
            
            document.getElementById('global-logout-btn').onclick = async () => {
                await supabaseClient.auth.signOut();
                window.location.href = '/'; 
            };
        } else {
            const dashLink = header.querySelector('nav a[href="/dashboard.html"]');
            if (dashLink) dashLink.style.display = 'none';
            
            authArea.innerHTML = `<a href="/login.html" data-i18n="nav_login" style="color: #58a6ff; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>`;
        }
        
        if (window.translatePage) window.translatePage();
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        renderAuthState(session);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            syncStateToExtension(session);
        } else if (event === 'SIGNED_OUT') {
            syncStateToExtension(null);
        }
    });
    
    window.addEventListener('languageChanged', () => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            renderAuthState(session);
        });
    });
})();
