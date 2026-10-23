// ==========================================
// 📁 page-components.js (精简版，仅替换末尾)
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

// 🚀 终极修复：读取 ?invite=，处理拒绝跳转
export async function initAcceptInvitePage() {
    if (!window.location.pathname.includes('accept-invite')) return;
    
    const client = window.supabaseClient;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite'); // 👈 改读取 invite
    const inviteDesc = document.getElementById('inviteDesc');
    const btnAcceptInvite = document.getElementById('btnAcceptInvite');
    const btnRejectInvite = document.getElementById('btnRejectInvite');
    
    if (!inviteDesc) return;

    // 秒绑拒绝按钮，不管有没有 token 都能点
    if (btnRejectInvite) {
        btnRejectInvite.onclick = () => window.location.href = '/dashboard.html';
    }

    if (!token) {
        inviteDesc.innerHTML = '<span style="color:#f85149;">无效的邀请链接。</span>'; 
        if(btnAcceptInvite) btnAcceptInvite.style.display = 'none'; 
        return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        sessionStorage.setItem('pending_family_token', token);
        window.location.href = '/login/';
        return;
    }

    const { data: invite, error } = await client.from('family_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

    if (error || !invite) {
        inviteDesc.innerHTML = '<span style="color:#f85149;">该邀请链接已过期或已被使用。</span>';
        if(btnAcceptInvite) btnAcceptInvite.style.display = 'none';
        return;
    }

    if (invite.invitee_email !== session.user.email) {
        inviteDesc.innerHTML = `<span style="color:#f85149;">该邀请仅限 ${invite.invitee_email} 领取，您当前登录的是 ${session.user.email}。</span>`;
        if(btnAcceptInvite) btnAcceptInvite.style.display = 'none';
        return;
    }

    inviteDesc.textContent = `您被邀请加入家庭组，共享高级版权益。是否接受？`;
    if (btnAcceptInvite) {
        btnAcceptInvite.style.display = 'inline-block';
        btnAcceptInvite.onclick = async () => {
            btnAcceptInvite.disabled = true;
            btnAcceptInvite.textContent = '正在加入...';

            const { error: updateError } = await client.from('profiles').update({
                family_owner_id: invite.owner_id,
                tier: 'family'
            }).eq('id', session.user.id);

            if (updateError) {
                window.showToast('加入失败: ' + updateError.message, 'error');
                btnAcceptInvite.disabled = false;
                btnAcceptInvite.textContent = 'Accept & Join';
                return;
            }

            await client.from('family_invitations').update({ status: 'accepted' }).eq('id', invite.id);
            window.showToast('成功加入家庭组！');
            window.location.href = '/dashboard.html';
        };
    }
}
