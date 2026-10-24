// ==========================================
// 📁 dashboard-fetcher.js
// 职责：拉取 Dashboard 核心数据
// ==========================================

export async function fetchDashboardData(client, currentUser) {
    const dashboardData = {};
    const dashboardNotifs = [];

    // 1. 获取用户基本信息 (profiles)
    const { data: profile, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        Object.assign(dashboardData, profile);
    }

    // 2. 获取最新的订阅状态 (subscriptions) 🌟 关键修复
    const { data: sub, error: subErr } = await client
        .from('subscriptions')
        .select('cancel_at_period_end, status')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subErr) {
        console.error("❌ 拉取订阅状态失败 (检查 RLS):", subErr);
    }

    if (sub) {
        console.log("✅ 成功获取订阅状态:", sub);
        dashboardData.cancel_at_period_end = sub.cancel_at_period_end;
        dashboardData.subscription_status = sub.status;
    } else {
        console.log("⚠️ 未找到订阅记录，默认设为未取消状态");
        dashboardData.cancel_at_period_end = false;
        dashboardData.subscription_status = 'none';
    }

    // 3. 获取通知列表 (notifications)
    const { data: notifs } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

    if (notifs) {
        dashboardNotifs.push(...notifs);
    }

    return { dashboardData, dashboardNotifs };
}
