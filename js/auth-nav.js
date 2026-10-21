// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.querySelector('header');
  if (!headerEl) return;

  // 1. 获取当前路径用于高亮导航
  const path = window.location.pathname;

  // 2. 用 JS 暴力渲染整个 Header 结构
  headerEl.innerHTML = `
    <style>
      /* 注入最高优先级的 CSS，彻底固定排版 */
      header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        width: 100% !important;
        height: 70px !important;
        padding: 0 24px !important;
        box-sizing: border-box !important;
        position: fixed !important;
        top: 0 !important; left: 0 !important; right: 0 !important;
        background: rgba(13,17,23,0.8) !important;
        backdrop-filter: blur(12px) !important;
        z-index: 1000 !important;
        border-bottom: 1px solid rgba(255,255,255,0.05) !important;
      }
      header .logo {
        display: flex !important; align-items: center !important; gap: 8px;
        color: #fff !important; font-weight: 800 !important; font-size: 20px !important;
        text-decoration: none !important; flex-shrink: 0 !important;
      }
      header .logo img { height: 28px; }
      header .nav-links {
        display: flex !important; align-items: center !important; gap: 20px !important;
        flex-shrink: 1 !important; overflow-x: auto !important;
        margin: 0 20px !important; scrollbar-width: none !important;
      }
      header .nav-links::-webkit-scrollbar { display: none; }
      header .nav-links a {
        color: #8b949e !important; text-decoration: none !important;
        font-size: 14px !important; white-space: nowrap !important; transition: 0.2s !important;
      }
      header .nav-links a:hover, header .nav-links a.active { color: #fff !important; }
      header .header-right {
        display: flex !important; align-items: center !important; gap: 15px !important;
        flex-shrink: 0 !important;
      }
      .lang-switch { position: relative; display: flex; align-items: center; }
      .lang-toggle-btn { background: none; border: none; color: #cbd5e1; font-size: 24px; cursor: pointer; padding: 0; }
      .lang-dropdown {
        position: absolute; top: 100%; right: 0; background: rgba(22,27,34,0.95);
        backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; padding: 8px 0; min-width: 120px; list-style: none;
        opacity: 0; visibility: hidden; transform: translateY(10px);
        transition: all 0.2s; z-index: 1001; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      .lang-dropdown li {
        padding: 8px 16px; font-size: 14px; color: #c9d1d9;
        cursor: pointer; transition: 0.2s;
      }
      .lang-dropdown li:hover { background: rgba(88,166,255,0.15); color: #58a6ff; }
      .lang-switch:hover .lang-dropdown { opacity: 1; visibility: visible; transform: translateY(0); }
      
      /* 手机端隐藏中间导航，保留右侧 */
      @media (max-width: 900px) {
        header .nav-links { display: none !important; }
      }
    </style>
    
    <a href="/index.html" class="logo"><img src="/DewSecure.png" alt="DewSecure"> DewSecure</a>
    <nav class="nav-links">
      <a href="/index.html" class="${path === '/' || path.includes('index') ? 'active' : ''}">首页</a>
      <a href="/pricing.html" class="${path.includes('pricing') ? 'active' : ''}">定价</a>
      <a href="/pentest/" target="_blank">安全审计</a>
      <a href="/update/" class="${path.includes('update') ? 'active' : ''}">更新日志</a>
      <a href="/guide/" class="${path.includes('guide') ? 'active' : ''}">使用指南</a>
      <a href="/about/" class="${path.includes('about') ? 'active' : ''}">关于我们</a>
      <a href="/dashboard.html" class="${path.includes('dashboard') ? 'active' : ''}" id="nav-dashboard" style="display:none;">控制台</a>
    </nav>
    <div class="header-right">
      <div id="global-auth-area" style="display: flex; align-items: center; gap: 12px;"></div>
      <div class="lang-switch">
        <button class="lang-toggle-btn">🌐</button>
        <ul class="lang-dropdown">
          <li data-lang="zh" class="lang-option">中文 (简体)</li>
          <li data-lang="en" class="lang-option">English</li>
          <li data-lang="ms" class="lang-option">Bahasa Melayu</li>
        </ul>
      </div>
    </div>
  `;

  // 3. 重新绑定语言下拉动画（因为结构被重写了）
  const langSwitch = document.querySelector('.lang-switch');
  if (langSwitch) {
    langSwitch.addEventListener('mouseenter', () => {
      const dd = document.querySelector('.lang-dropdown');
      if(dd) { dd.style.opacity = '1'; dd.style.visibility = 'visible'; dd.style.transform = 'translateY(0)'; }
    });
    langSwitch.addEventListener('mouseleave', () => {
      const dd = document.querySelector('.lang-dropdown');
      if(dd) { dd.style.opacity = '0'; dd.style.visibility = 'hidden'; dd.style.transform = 'translateY(10px)'; }
    });
  }

  // 4. 渲染登录状态
  const authArea = document.getElementById('global-auth-area');
  const navDashboard = document.getElementById('nav-dashboard');

  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;
      
      // 登录后显示“控制台”链接
      if(navDashboard) navDashboard.style.display = 'block';

      authArea.innerHTML = `
        <span title="${rawEmail}" style="color: #8b949e; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${displayEmail}</span>
        <button id="global-logout-btn" style="background: rgba(248, 81, 73, 0.1); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.3); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; white-space: nowrap; transition: 0.2s;">退出</button>
      `;
      
      document.getElementById('global-logout-btn').onclick = async () => {
        await supabaseGlobal.auth.signOut();
        window.location.href = '/'; 
      };
    } else {
      // 未登录隐藏控制台
      if(navDashboard) navDashboard.style.display = 'none';

      authArea.innerHTML = `
        <a href="/login.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>
      `;
    }
  });
});
