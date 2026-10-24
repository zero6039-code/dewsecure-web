// ==========================================
// 📁 accept-invite.js
// 职责：处理家庭组邀请的验证、展示、接受与拒绝
// ==========================================

export async function initInviteLogic() {
    // 🌟 核心修复1：提前绑定 Decline，不管发生什么都别当死键
    const btnReject = document.getElementById('btnRejectInvite');
    if (btnReject) {
        btnReject.onclick = () => { window.location.href = '/'; };
    }

    // 🌟 核心修复2：加入客户端等待重试机制，防止第一次加载失败
    let client = window.supabaseClient;
    let retries = 0;
    while (!client && retries < 30) { // 最多等 3 秒
        await new Promise(r => setTimeout(r, 100));
        client = window.supabaseClient;
        retries++;
    }

    if (!client) {
        const descEl = document.getElementById('inviteDesc');
        if (descEl) descEl.textContent = 'System error: Supabase client failed to load. Please refresh.';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite') || urlParams.get('token');
    
    const descEl = document.getElementById('inviteDesc');
    const btnAccept = document.getElementById('btnAcceptInvite');
    
    const getT = () => window.fallbackTranslations || {};

    if (!token) {
        if (descEl) descEl.textContent = getT()['invite_invalid'] || 'Invalid Invite Link';
        return;
    }

    if (descEl) descEl.textContent = getT()['invite_loading'] || 'Loading invitation...';

    try {
        // 强制等待 Session 恢复
        let session = null;
        const { data: { session: initialSession } } = await client.auth.getSession();
        session = initialSession;

        if (!session) {
            await new Promise((resolve) => {
                const { data: { subscription } } = client.auth.onAuthStateChange((event, newSession) => {
                    if (newSession) {
                        session = newSession;
                        subscription.unsubscribe();
                        resolve();
                    }
                });
                setTimeout(() => { subscription.unsubscribe(); resolve(); }, 1500);
            });
        }

        // 查询数据库
        const { data: invite, error } = await client
            .from('family_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .maybeSingle();

        if (error || !invite) {
            if (descEl) descEl.textContent = getT()['invite_invalid'] || 'Invalid Invite Link';
            return;
        }

        // 未登录逻辑
        if (!session) {
            sessionStorage.setItem('pending_family_token', token);
            const loginPrompt = getT()['invite_login_prompt'] || 'Please log in to accept this invitation from <b>{email}</b>.';
            if (descEl) descEl.innerHTML = loginPrompt.replace('{email}', invite.owner_email);
            
            if (btnAccept) {
                btnAccept.textContent = getT()['invite_btn_login'] || 'Log In / Register';
                btnAccept.style.display = 'block';
                const redirectUrl = encodeURIComponent('/accept-invite.html?invite=' + token);
                btnAccept.onclick = () => window.location.href = '/login/?redirect=' + redirectUrl;
            }
            return;
        }

        // 已登录逻辑
        const validPrompt = getT()['invite_valid_prompt'] || 'You have been invited by <b>{email}</b> to join their Family Group.';
        if (descEl) descEl.innerHTML = validPrompt.replace('{email}', invite.owner_email);
        
        if (btnAccept) {
            btnAccept.textContent = getT()['invite_accept_btn'] || 'Accept & Join';
            btnAccept.style.display = 'block';

            btnAccept.onclick = async () => {
                btnAccept.disabled = true;
                btnAccept.textContent = getT()['dash_cancel_processing'] || 'Processing...';

                if (session.user.email === invite.owner_email) {
                    alert('You cannot accept your own invitation.');
                    btnAccept.disabled = false;
                    return;
                }

                try {
                    const { error: profileErr } = await client
                        .from('profiles')
                        .update({ family_owner_id: invite.owner_id, tier: 'sub-family' })
                        .eq('id', session.user.id);

                    if (profileErr) throw profileErr;
                    await client.from('family_invitations').update({ status: 'accepted' }).eq('id', invite.id);
                    sessionStorage.removeItem('pending_family_token');

                    window.showToast(getT()['dash_leave_success'] || 'Joined successfully!', 'success');
                    setTimeout(() => window.location.href = '/dashboard.html', 1000);
                } catch (err) {
                    alert('Failed to join: ' + err.message);
                    btnAccept.disabled = false;
                    btnAccept.textContent = getT()['invite_accept_btn'] || 'Accept & Join';
                }
            };
        }
    } catch (err) {
        console.error('Invite verification error:', err);
        if (descEl) descEl.textContent = getT()['invite_invalid'] || 'Invalid Invite Link';
    }
}
