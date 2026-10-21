// js/auth-nav.js
const SUPABASE_URL = 'https://uvbaioqqjqseapcancvi.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const supabaseGlobal = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // 防止重复创建
  if (document.getElementById('global-nav-bar')) return;

  // 1. 凭空创建一个全新的导航栏容器
  const navBar = document.createElement('div');
  navBar.id = 'global-nav-bar';

  // 2. 赋予最高优先级的行内样式，完全免疫外部 style.css
  Object.assign(navBar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '70px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    boxSizing: 'border-box',
    background: 'rgba(13,17,23,0.8)',
    backdropFilter: 'blur(12px)',
    zIndex: '99999',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  });

  const path = window.location.pathname;

  // 3. 注入内容与内部样式（强制给 body 加 padding-top，防遮挡）
  navBar.innerHTML = `
    <style>
      body { padding-top: 70px !important; }
      #global-nav-bar a { text-decoration: none !important; transition: 0.2s !important; }
      #global-nav-bar .logo { 
        display: flex !important; align-items: center !important; gap: 8px;
        color: #fff !important; font-weight: 800 !important; font-size: 20px !important; flex-shrink: 0 !important;
      }
      #global-nav-bar .logo img { height: 28px !important; }
      #global-nav-bar .nav-links {
        display: flex !important; align-items: center !important; gap: 20px !important;
        flex-shrink: 1 !important; overflow-x: auto !important; margin: 0 20px !important; scrollbar-width: none !important;
      }
      #global-nav-bar .nav-links::-webkit-scrollbar { display: none !important; }
      #global-nav-bar .nav-links a { color: #8b949e !important; font-size: 14px !important; white-space: nowrap !important; }
      #global-nav-bar .nav-links a:hover, #global-nav-bar .nav-links a.active { color: #fff !important; }
      #global-nav-bar .header-right { display: flex !important; align-items: center !important; gap: 15px !important; flex-shrink: 0 !important; }
      #global-nav-bar .lang-dropdown {
        position: absolute; top: 100%; right: 0; background: rgba(22,27,34,0.95); backdrop-filter: blur(10px); 
        border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 0; min-width: 120px; list-style: none;
        opacity: 0; visibility: hidden; transform: translateY(10px); transition: all 0.2s; z-index: 1001; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin: 0;
      }
      #global-nav-bar .lang-dropdown li { padding: 8px 16px; font-size: 14px; color: #c9d1d9; cursor: pointer; transition: 0.2s; }
      #global-nav-bar .lang-dropdown li:hover { background: rgba(88,166,255,0.15); color: #58a6ff; }
      #global-nav-bar .lang-switch { position: relative; display: flex; align-items: center; }
      #global-nav-bar .lang-switch:hover .lang-dropdown { opacity: 1 !important; visibility: visible !important; transform: translateY(0) !important; }
      
      @media (max-width: 900px) { #global-nav-bar .nav-links { display: none !important; } }
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
        <button class="lang-toggle-btn" style="background:none;border:none;color:#cbd5e1;font-size:24px;cursor:pointer;padding:0;">🌐</button>
        <ul class="lang-dropdown">
          <li data-lang="zh" class="lang-option">中文 (简体)</li>
          <li data-lang="en" class="lang-option">English</li>
          <li data-lang="ms" class="lang-option">Bahasa Melayu</li>
        </ul>
      </div>
    </div>
  `;

  // 4. 强行插入到 body 的最前面
  document.body.insertBefore(navBar, document.body.firstChild);

  // 5. 渲染登录状态
  const authArea = document.getElementById('global-auth-area');
  const navDashboard = document.getElementById('nav-dashboard');

  supabaseGlobal.auth.onAuthStateChange((event, session) => {
    if (session) {
      const rawEmail = session.user.email;
      const displayEmail = rawEmail.length > 15 ? rawEmail.substring(0, 12) + '...' : rawEmail;
      
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
      if(navDashboard) navDashboard.style.display = 'none';
      authArea.innerHTML = `<a href="/login.html" style="color: #58a6ff; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap;">登录</a>`;
    }
  });
});
