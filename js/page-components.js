// ==========================================
// 📁 page-components.js
// 职责：主页浏览器 Tab 切换、手风琴、邀请页面逻辑
// ==========================================

window.showInviteModal = function(link) {
    try {
        const t = window.fallbackTranslations || {};
        let modal = document.getElementById('invite-link-modal');
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'invite-link-modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 2147483647;`;
        modal.innerHTML = `
            <div style="background: rgba(22, 27, 34, 0.95); border: 1px solid rgba(88, 166, 255, 0.4); border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; text-align: center;">
                <h2 style="color: #fff; margin-bottom: 15px; font-size: 24px;">${t['modal_invite_title'] || '邀请已生成'}</h2>
                <p style="color: #8b949e; font-size: 15px; margin-bottom: 25px;">${t['modal_invite_desc'] || '请将以下链接发送给您的家人：'}</p>
                <input type="text" id="invite-link-input" readonly value="${link}" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px dashed rgba(88, 166, 255, 0.8); border-radius: 10px; padding: 15px; color: #58a6ff; font-family: monospace; font-size: 14px; text-align: center; margin-bottom: 25px; outline: none;">
                <div style="display: flex; gap: 12px;">
                    <button id="modal-copy-btn" class="btn btn-primary" style="flex: 1; height: 48px;">${t['modal_btn_copy'] || '复制链接'}</button>
                    <button id="modal-close-btn" class="btn" style="flex: 1; height: 48px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #c9d1d9;">${t['modal_btn_close'] || '关闭'}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        document.getElementById('modal-copy-btn').onclick = async function() {
            await navigator.clipboard.writeText(link);
            this.textContent = t['modal_copied'] || '已复制！'; this.style.background = '#3fb950'; this.style.color = '#fff';
        };
        document.getElementById('modal-close-btn').onclick = () => modal.remove();
    } catch (err) { prompt("请手动复制此链接：", link); }
};

export function initComponentsPage() {
    // 1. 浏览器 Tab 切换 (主页)
    if (document.getElementById('ds-title') && !document.getElementById('ds-title').dataset.bound) {
        document.getElementById('ds-title').dataset.bound = "true";
        const browserUrls = { chrome: 'https://chromewebstore.google.com/', edge: 'https://microsoftedge.microsoft.com/', firefox: 'https://addons.mozilla.org/', safari: '#', opera: '#', yandex: '#', android: '#' };
        const browserIcons = { chrome: 'fa-chrome', edge: 'fa-edge', firefox: 'fa-firefox-browser', safari: 'fa-safari', opera: 'fa-opera', yandex: 'fa-yandex', android: 'fa-android' };
        const icons = document.querySelectorAll('.ds-icon');
        const titleEl = document.getElementById('ds-title');
        const descEl = document.getElementById('ds-desc');
        const btnIconEl = document.getElementById('ds-btn-icon');
        const btnTextEl = document.getElementById('ds-btn-text');
        const btnEl = document.getElementById('ds-btn');
        let currentTarget = 'chrome';

        function renderBrowserData(target) {
            currentTarget = target;
            const t = window.fallbackTranslations || {};
            if (!t['dl_' + target + '_title']) return;
            titleEl.textContent = t['dl_' + target + '_title'];
            descEl.textContent = t['dl_' + target + '_desc'];
            descEl.style.opacity = '1'; 
            btnIconEl.innerHTML = '<i class="fa-brands ' + browserIcons[target] + '"></i>';
            btnTextEl.textContent = t['dl_btn_' + target] || ('Download for ' + target);
            btnEl.href = browserUrls[target];
        }

        icons.forEach(icon => {
            icon.addEventListener('click', () => {
                icons.forEach(l => l.classList.remove('active'));
                icon.classList.add('active');
                renderBrowserData(icon.getAttribute('data-target'));
            });
        });
        setTimeout(() => { if (icons.length > 0) icons[0].click(); }, 50);
        window.addEventListener('languageChanged', () => renderBrowserData(currentTarget));
    }

    // 2. 手风琴
    document.querySelectorAll('.accordion-header').forEach(header => {
        if (header.dataset.bound) return;
        header.dataset.bound = "true"; 
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });
}

export function initAcceptInvitePage() {
    if (!window.location.pathname.includes('accept-invite')) return;
    const client = window.supabaseClient;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const inviteDesc = document.getElementById('inviteDesc');
    const btnAcceptInvite = document.getElementById('btnAcceptInvite');
    const btnRejectInvite = document.getElementById('btnRejectInvite');
    const t = window.fallbackTranslations || {};

    if (!token) {
        inviteDesc.textContent = "无效的邀请链接。"; btnAcceptInvite.style.display = 'none'; return;
    }

    client.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
            sessionStorage.setItem('pending_family_token', token);
            window.location.href = '/login/';
            return;
        }
        const { data, error } = await client.rpc('get_family_invite_info', { p_token: token });
        if (error || !data.success) {
            inviteDesc.textContent = t['invite_invalid'] || '邀请已失效或已被处理。';
            btnAcceptInvite.style.display = 'none';
            return;
        }
        let desc = t['invite_accept_desc'] || '{owner} 邀请你加入他的家庭组，共享高级版权益。';
        inviteDesc.textContent = desc.replace('{owner}', data.owner_email);

        btnAcceptInvite.onclick = async () => {
            btnAcceptInvite.disabled = true;
            const { data: acceptData, error: acceptError } = await client.rpc('accept_family_invite', { p_token: token });
            if (acceptError || !acceptData.success) { 
                window.showToast(acceptError?.message || acceptData.message, 'error'); 
                btnAcceptInvite.disabled = false; 
                return; 
            }
            window.showToast(acceptData.message);
            setTimeout(() => window.location.href = '/dashboard.html', 1500);
        };
        btnRejectInvite.onclick = () => window.location.href = '/';
    });
}
