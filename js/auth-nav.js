// js/auth-nav.js
(function() {
    'use strict';

    if (window._authNavLoaded) return;
    window._authNavLoaded = true;

    // ⚠️ 请确保这里是你真实的 Supabase 项目信息
    const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
    const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
    
    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    const supabaseClient = window.supabaseClient;

    // 向浏览器插件推送状态
    function syncStateToExtension(session) {
        if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
        
        // 🌟 动态适配 Chrome 与 Edge 扩展 ID
        const isEdge = navigator.userAgent.includes('Edg/');
        const EXT_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';
        
        try {
            if (session) {
                // 用户已登录，把真实的 JWT 推给插件
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
                // 🌟 核心修复：网页端登出时，不再向插件发送 LOGOUT 指令
                // 网页端的生命周期与插件端的生命周期相互独立！
                console.log("ℹ️ [网页端] 已登出，插件端维持原状态不变。");
            }
        } catch (e) {
            // 插件未安装时，这里会抛异常，静默处理即可
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
            
            const dashLink = header.querySelector('nav a[href="/dashboard.html"]');
            if (dashLink) dashLink.style.display = 'block';

            authArea.innerHTML = `
                <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayEmail}</span>
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

    // 监听登录状态变化
    supabaseClient.auth.onAuthStateChange((event, session) => {
        renderAuthState(session);
        // 🌟 触发向插件推送（只推登录，不推登出）
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            syncStateToExtension(session);
        } else if (event === 'SIGNED_OUT') {
            syncStateToExtension(null); // 内部逻辑已改为：不会发指令给插件
        }
    });
    
    window.addEventListener('languageChanged', () => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            renderAuthState(session);
        });
    });
})();
