// page-components.js
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
    document.querySelectorAll('.accordion-header').forEach(header => {
        if (header.dataset.bound) return;
        header.dataset.bound = "true"; 
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });
}

export async function initAcceptInvitePage() {
    const t = window.fallbackTranslations || {};
    const client = window.supabaseClient;
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite') || urlParams.get('token');

    if (!inviteToken) {
        document.getElementById('inviteDesc').textContent = "Invalid Invite Link / 邀请链接无效";
        return;
    }

    const inviteDesc = document.getElementById('inviteDesc');
    const btnAcceptInvite = document.getElementById('btnAcceptInvite');
    const btnRejectInvite = document.getElementById('btnRejectInvite');

    if (btnRejectInvite) btnRejectInvite.onclick = () => window.location.href = '/dashboard.html';
    if (inviteDesc) inviteDesc.textContent = t['invite_loading'] || '加载中...';

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
            sessionStorage.setItem('pending_family_token', inviteToken);
            window.location.href = '/login/';
            return;
        }

        const { data: invite, error } = await client.from('family_invitations').select('*').eq('token', inviteToken).maybeSingle();

        if (error || !invite) {
            if (inviteDesc) inviteDesc.textContent = t['invite_invalid'] || '邀请已失效或不存在';
            return;
        }

        if (invite.invitee_email.toLowerCase() !== session.user.email.toLowerCase()) {
            let mismatchMsg = t['invite_email_mismatch'] || '该邀请仅限 {invitee} 领取，您当前登录的是 {current}。';
            mismatchMsg = mismatchMsg.replace('{invitee}', invite.invitee_email).replace('{current}', session.user.email);
            inviteDesc.innerHTML = `<span style="color:#f85149;">${mismatchMsg}</span>`;
            if (btnAcceptInvite) btnAcceptInvite.style.display = 'none';
            return;
        }

        let ownerEmail = invite.owner_email;
        if (!ownerEmail && invite.owner_id) {
            const { data: rpcEmail } = await client.rpc('get_profile_email', { target_user_id: invite.owner_id });
            if (rpcEmail) ownerEmail = rpcEmail;
        }
        if (!ownerEmail) ownerEmail = 'Owner';

        inviteDesc.textContent = (t['invite_accept_desc'] || '{owner} 邀请您加入家庭组，共享高级版权益。是否接受？').replace('{owner}', ownerEmail);

        if (btnAcceptInvite) {
            btnAcceptInvite.style.display = 'inline-block';
            btnAcceptInvite.onclick = async () => {
                btnAcceptInvite.disabled = true;
                btnAcceptInvite.textContent = t['invite_joining'] || '正在加入...';
                const { error: updateError } = await client.rpc('accept_family_invite', { invite_token: inviteToken });
                if (updateError) {
                    window.showToast(updateError.message, 'error');
                    btnAcceptInvite.disabled = false;
                    btnAcceptInvite.textContent = t['invite_accept_btn'] || 'Accept & Join';
                    return;
                }
                // 🌟 强制写死正确文案，绝不用变量兜底
                window.showToast('Successfully joined the family group!');
                setTimeout(() => window.location.href = '/dashboard.html', 1000);
            };
        }
        if (btnRejectInvite) btnRejectInvite.onclick = () => window.location.href = '/dashboard.html';
    } catch (err) {
        console.error("Accept Invite Error:", err);
        if (inviteDesc) inviteDesc.textContent = "Error: " + err.message;
    }
}
