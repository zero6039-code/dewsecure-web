export async function initFamilyUI(client, profile) {
    const familyCard = document.getElementById('familyCard');
    const listDiv = document.getElementById('familyMembersList');
    const btnInvite = document.getElementById('btnInviteFamily');
    const inputEmail = document.getElementById('familyEmailInput');
    const desc = document.getElementById('familyDesc');
    if (!familyCard) return;

    if (profile.tier !== 'family' || profile.family_owner_id) {
        familyCard.classList.add('hidden');
        return;
    }

    familyCard.classList.remove('hidden');
    familyCard.style.marginTop = '24px';
    desc.textContent = '邀请家人加入您的家庭组，共享高级版权益（最多9人）。';

    try {
        const { data: invites, error } = await client.from('family_invitations').select('*').eq('owner_id', profile.id);
        if (error) throw error;
        listDiv.innerHTML = '';
        const activeInvites = invites ? invites.filter(inv => inv.status !== 'revoked') : [];

        if (activeInvites.length === 0) {
            listDiv.innerHTML = '<div style="color:#8b949e;font-size:14px;text-align:center;padding:10px;">暂无家庭成员</div>';
        } else {
            activeInvites.forEach(inv => {
                const row = document.createElement('div');
                row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:12px 15px; border-radius:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);';
                
                const inviteLink = `${window.location.origin}/accept-invite.html?invite=${inv.token}`;
                // 注意：如果子账号成功接收，状态应该变成 'accepted'
                const isPending = inv.status === 'pending'; 
                const email = inv.invitee_email || '未填写邮箱';
                
                row.innerHTML = `
                    <div style="color:${isPending ? '#fff' : '#3fb950'}; font-size:14px; font-weight:600;">
                        ${email}
                        ${!isPending ? '<span style="font-size:12px; margin-left:8px; background:rgba(63,185,80,0.1); padding:2px 6px; border-radius:4px;">已加入</span>' : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${isPending 
                            ? `<button class="btn" style="background:rgba(88,166,255,0.1); color:#58a6ff; border:1px solid rgba(88,166,255,0.3); padding:6px 12px; font-size:12px;" onclick="navigator.clipboard.writeText('${inviteLink}'); window.showToast('邀请链接已复制');">复制邀请链接</button>` 
                            : ''}
                        <button class="btn btn-danger" style="padding:6px 12px; font-size:12px;" onclick="window.removeFamily('${inv.id}', '${email}')">移除</button>
                    </div>
                `;
                listDiv.appendChild(row);
            });
        }
    } catch (err) {
        console.error("获取家庭组列表失败:", err);
        listDiv.innerHTML = '<div style="color:#f85149;font-size:14px;text-align:center;">获取失败: ' + err.message + '</div>';
    }

    // 🚀 提取出发送邀请的逻辑，方便点击和回车共用
    const handleSendInvite = async () => {
        const email = inputEmail.value.trim().toLowerCase();
        if(!email || !email.includes('@')) return window.showToast('请输入有效的邮箱地址', 'error');
        
        btnInvite.disabled = true; 
        const originalText = btnInvite.textContent;
        btnInvite.textContent = '生成中...';
        
        try {
            const { data, error } = await client.from('family_invitations').insert({
                owner_id: profile.id,
                invitee_email: email, 
                token: Math.random().toString(36).substring(2, 15),
                status: 'pending'
            }).select().single();

            if (error) throw error;
            
            const link = `${window.location.origin}/accept-invite.html?invite=${data.token}`;
            await navigator.clipboard.writeText(link);
            window.showToast('邀请链接已复制！');
            inputEmail.value = '';
            initFamilyUI(client, profile); 
        } catch (err) {
            window.showToast('生成失败: ' + err.message, 'error');
        } finally {
            btnInvite.disabled = false; 
            btnInvite.textContent = originalText;
        }
    };

    btnInvite.onclick = handleSendInvite;
    
    // 🚀 新增：回车键触发发送
    inputEmail.onkeypress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendInvite();
        }
    };
}

window.removeFamily = async function(inviteId, email) {
    window.showGlassConfirm('移除成员', '确认移除该成员？移除后其将失去家庭组共享权益。', async () => {
        const client = window.supabaseClient;
        // 调用刚才创建的 RPC 函数
        const { error } = await client.rpc('remove_family_member', { p_invitee_email: email });
        
        if (!error) {
            window.showToast('成员已彻底移除');
            const { data: { session } } = await client.auth.getSession();
            const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            initFamilyUI(client, profile);
        } else {
            window.showToast('移除失败: ' + error.message, 'error');
        }
    });
};
