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
    
    const t = window.fallbackTranslations || {};
    desc.textContent = t['dash_family_desc'] || '邀请家人加入您的家庭组，共享高级版权益（最多9人）。';

    try {
        const { data: invites, error } = await client.from('family_invitations').select('*').eq('owner_id', profile.id);
        if (error) throw error;
        listDiv.innerHTML = '';
        const activeInvites = invites ? invites.filter(inv => inv.status !== 'revoked') : [];

        if (activeInvites.length === 0) {
            listDiv.innerHTML = `<div style="color:#8b949e;font-size:14px;text-align:center;padding:10px;">${t['dash_family_no_members'] || '暂无家庭成员'}</div>`;
        } else {
            activeInvites.forEach(inv => {
                const row = document.createElement('div');
                row.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:12px 15px; border-radius:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 10px;';
                
                const inviteLink = `${window.location.origin}/accept-invite.html?invite=${inv.token}`;
                const isPending = inv.status === 'pending'; 
                const email = inv.invitee_email || 'Unknown';
                
                row.innerHTML = `
                    <div style="color:${isPending ? '#fff' : '#3fb950'}; font-size:14px; font-weight:600; word-break: break-all; flex: 1; min-width: 120px;">
                        ${email}
                        ${!isPending ? `<span style="font-size:12px; margin-left:8px; background:rgba(63,185,80,0.1); padding:2px 6px; border-radius:4px;">${t['dash_device_active'] || 'Joined'}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink: 0;">
                        ${isPending 
                            ? `<button class="btn" style="background:rgba(88,166,255,0.1); color:#58a6ff; border:1px solid rgba(88,166,255,0.3); padding:6px 12px; font-size:12px; white-space: nowrap;" onclick="navigator.clipboard.writeText('${inviteLink}'); window.showToast('${t['dash_copied'] || 'Copied!'}');">${t['dash_invite_copy'] || '复制链接'}</button>` 
                            : ''}
                        <button class="btn btn-danger" style="padding:6px 12px; font-size:12px; white-space: nowrap;" onclick="window.removeFamily('${inv.id}', '${email}')">${t['dash_family_member_remove'] || '移除'}</button>
                    </div>
                `;
                listDiv.appendChild(row);
            });
        }
    } catch (err) {
        console.error("获取家庭组列表失败:", err);
        listDiv.innerHTML = `<div style="color:#f85149;font-size:14px;text-align:center;">Error: ${err.message}</div>`;
    }

    const handleSendInvite = async () => {
        const email = inputEmail.value.trim().toLowerCase();
        if(!email || !email.includes('@')) return window.showToast(t['toast_invalid_email'] || 'Invalid Email', 'error');
        
        btnInvite.disabled = true; 
        const originalText = btnInvite.textContent;
        btnInvite.textContent = t['dash_gen_ing'] || 'Generating...';
        
        try {
            const { data, error } = await client.from('family_invitations').insert({
                owner_id: profile.id,
                owner_email: profile.email,
                invitee_email: email, 
                token: Math.random().toString(36).substring(2, 15),
                status: 'pending'
            }).select().single();

            if (error) throw error;
            
            const link = `${window.location.origin}/accept-invite.html?invite=${data.token}`;
            await navigator.clipboard.writeText(link);
            window.showToast(t['toast_invite_gen'] || 'Link Copied!');

            // 🌟 插入邀请通知
            await client.from('notifications').insert({
                user_id: profile.id,
                type: 'family',
                title_key: 'notif_family_invited',
                message_key: 'notif_family_invited',
                params: { email: email }
            });
            
            // 🌟 强制刷新右侧通知栏
            if (typeof window.initNotifications === 'function') window.initNotifications();

            inputEmail.value = '';
            initFamilyUI(client, profile); 
        } catch (err) {
            window.showToast((t['toast_invite_fail'] || 'Failed: ') + err.message, 'error');
        } finally {
            btnInvite.disabled = false; 
            btnInvite.textContent = originalText;
        }
    };

    btnInvite.onclick = handleSendInvite;
    inputEmail.onkeypress = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSendInvite(); }
    };

    // 🌟 核心修复：添加窗口聚焦监听，子号加入后切回网页自动刷新
    if (!window._familyFocusListenerAdded) {
        window.addEventListener('focus', async () => {
            const { data: { session } } = await client.auth.getSession();
            if (session && document.getElementById('familyCard') && !document.getElementById('familyCard').classList.contains('hidden')) {
                const { data: freshProfile } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
                if (freshProfile) initFamilyUI(client, freshProfile);
            }
        });
        window._familyFocusListenerAdded = true;
    }

    // 🌟 核心修复：添加 Supabase 实时订阅（一旦数据库变动，立刻重绘 UI）
    if (!window._familyChannelSubscribed) {
        client.channel('family_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'family_invitations', filter: `owner_id=eq.${profile.id}` }, () => {
                // 邀请表变动，重新拉取列表
                client.from('profiles').select('*').eq('id', profile.id).maybeSingle().then(({data}) => {
                    if (data) initFamilyUI(client, data);
                });
            })
            .subscribe();
        window._familyChannelSubscribed = true;
    }
}

window.removeFamily = async function(inviteId, email) {
    const t = window.fallbackTranslations || {};
    
    // 🌟 修复硬编码的 'Confirm?'
    const confirmMsg = t['dash_family_remove_confirm'] || 'Are you sure you want to remove this member?';
    
    window.showGlassConfirm(t['dash_family_member_remove'] || '移除成员', confirmMsg, async () => {
        const client = window.supabaseClient;
        const { error } = await client.rpc('remove_family_member', { p_invitee_email: email });
        
        if (!error) {
            // 🌟 修复硬编码的 'Removed'
            window.showToast(t['dash_leave_success'] || 'Member removed successfully');
            
            const { data: { session } } = await client.auth.getSession();
            const { data: profile } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            
            // 🌟 插入移除通知
            if (profile) {
                await client.from('notifications').insert({
                    user_id: profile.id,
                    type: 'family',
                    title_key: 'notif_family_removed',
                    message_key: 'notif_family_removed',
                    params: { email: email }
                });
                
                // 🌟 强制刷新右侧通知栏
                if (typeof window.initNotifications === 'function') window.initNotifications();
            }
            
            initFamilyUI(client, profile);
        } else {
            window.showToast('Error: ' + error.message, 'error');
        }
    });
};
