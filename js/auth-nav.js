// js/auth-nav.js
(function() {
    'use strict';

    // 防止重复加载
    if (window._authNavLoaded) return;
    window._authNavLoaded = true;

    const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
    const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
    
    // 全局挂载单例，供其他页面使用
    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    const supabaseClient = window.supabaseClient;

    document.addEventListener("DOMContentLoaded", () => {
        const header = document.querySelector('header');
        if (!header) return;

        let langSwitch = header.querySelector('.lang-switch');
        if (!langSwitch) return;

        // 1. 隐藏静态 HTML 里的“登录”按钮
        header.querySelectorAll('nav a').forEach(a => {
            if (a.href.includes('/login') || a.getAttribute('data-i18n') === 'nav_login') {
                a.style.display = 'none';
            }
        });

        // 2. 建立右侧统一容器，完美契合 Grid 的 1fr auto 1fr
        let headerRight = header.querySelector('.header-right');
        if (!headerRight) {
            headerRight = document.createElement('div');
            headerRight.className = 'header-right';
            langSwitch.parentNode.insertBefore(headerRight, langSwitch);
            headerRight.appendChild(langSwitch);
        }

        // 3. 在右侧容器里，地球图标前插入认证区域
        let authArea = document.getElementById('global-auth-area');
        if (!authArea) {
            authArea = document.createElement('div');
            authArea.id = 'global-auth-area';
            authArea.style.cssText = 'display: flex; align-items: center; gap: 12px;';
            headerRight.insertBefore(authArea, langSwitch);
        }

        // 4. 渲染登录状态
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session) {
                const rawEmail = session.user.email;
                const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;
                
                // 动态显示“控制台”导航
                const dashLink = header.querySelector('nav a[href="/dashboard.html"]');
                if (dashLink) dashLink.style.display = 'block';

                authArea.innerHTML = `
                    <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayEmail}</span>
                    <a href="/dashboard.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">控制台</a>
                    <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap;">退出</button>
                `;
                
                document.getElementById('global-logout-btn').onclick = async () => {
                    await supabaseClient.auth.signOut();
                    window.location.href = '/'; 
                };
            } else {
                const dashLink = header.querySelector('nav a[href="/dashboard.html"]');
                if (dashLink) dashLink.style.display = 'none';
                authArea.innerHTML = `<a href="/login.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>`;
            }
        });
    });
})();
