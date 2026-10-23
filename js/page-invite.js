// ==========================================
// 📁 page-invite.js
// 职责：读取 URL 中的 token，处理家庭组邀请逻辑
// ==========================================
export async function initInvitePage() {
    const inviteDesc = document.getElementById('inviteDesc');
    const btnAccept = document.getElementById('btnAcceptInvite');
    const btnReject = document.getElementById('btnRejectInvite');
    
    if (!inviteDesc) return; // 如果不在邀请页面，直接退出

    const client = window.supabaseClient;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        inviteDesc.innerHTML = '<span style="color:#f85149;">无效的邀请链接。</span>';
        if (btnAccept) btnAccept.style.display = 'none';
        return;
    }

    // 检查是否已登录
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        // 未登录，把 token 存入本地，跳转登录页
        sessionStorage.setItem('pending_family_token', token);
        window.location.href = '/login/';
        return;
    }

    // 已登录，验证 token 的有效性
    inviteDesc.textContent = '正在验证邀请...';
    const { data: invite, error } = await client.from('family_invitations').select('*').eq('token', token).eq('status', 'pending').maybeSingle();

    if (error || !invite) {
        inviteDesc.innerHTML = '<span style="color:#f85149;">该邀请链接已过期或已被使用。</span>';
        if (btnAccept) btnAccept.style.display = 'none';
        return;
    }

    // 校验邮箱是否匹配（防止 A 的邀请码被 B 抢用）
    if (invite.invitee_email !== session.user.email) {
        inviteDesc.innerHTML = `<span style="color:#f85149;">该邀请仅限 ${invite.invitee_email} 领取，您当前登录的是 ${session.user.email}。</span>`;
        if (btnAccept) btnAccept.style.display = 'none';
        return;
    }

    // 验证通过，显示确认信息
    inviteDesc.textContent = `您被邀请加入家庭组，共享高级版权益。是否接受？`;
    if (btnAccept) {
        btnAccept.style.display = 'inline-block';
        btnAccept.onclick = async () => {
            btnAccept.disabled = true;
            btnAccept.textContent = '正在加入...';

            // 1. 更新 profiles 表，绑定主账号并升级为 family
            const { error: updateError } = await client.from('profiles').update({
                family_owner_id: invite.owner_id,
                tier: 'family'
            }).eq('id', session.user.id);

            if (updateError) {
                window.showToast('加入失败: ' + updateError.message, 'error');
                btnAccept.disabled = false;
                btnAccept.textContent = 'Accept & Join';
                return;
            }

            // 2. 更新邀请表状态为 accepted
            await client.from('family_invitations').update({ status: 'accepted' }).eq('id', invite.id);

            // 3. 成功，跳转 Dashboard
            window.showToast('成功加入家庭组！');
            window.location.href = '/dashboard.html';
        };
    }

    if (btnReject) {
        btnReject.onclick = () => window.location.href = '/dashboard.html';
    }
}
