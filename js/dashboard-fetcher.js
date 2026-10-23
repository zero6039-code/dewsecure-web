export async function fetchDashboardData(client, currentUser) {
    let { data: profile } = await client.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    
    let dashboardData = profile || { id: currentUser.id, email: currentUser.email, tier: 'free', trial_ends_at: null, invite_success_count: 0 };
    if (!dashboardData.email) dashboardData.email = currentUser.email;

    // 处理家庭组共享状态 (关键：无论 profile 表里有没有 family_owner_id，只要是子号就查 RPC)
    const isFamilySub = dashboardData.family_owner_id || profile?.family_owner_id;
    if (isFamilySub) {
        try {
            const { data: sharedStatus } = await client.rpc('get_family_shared_status');
            if (sharedStatus && sharedStatus.success) {
                dashboardData.tier = 'family';
                dashboardData.trial_ends_at = sharedStatus.owner_expire;
                dashboardData.owner_email = sharedStatus.owner_email;
            }
        } catch (e) { console.error("获取家庭组状态失败:", e); }
    }

    const { data: notifs } = await client.from('notifications').select('*').order('created_at', { ascending: false });
    const dashboardNotifs = notifs || [];
    const unreadIds = dashboardNotifs.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) await client.from('notifications').update({ is_read: true }).in('id', unreadIds);
    
    return { dashboardData, dashboardNotifs };
}
