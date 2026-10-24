// 🌟 全局追踪推广码并绑定
export async function trackReferral() {
    const client = window.supabaseClient;
    if (!client) return;

    // 1. 从 URL 中捕获推广码
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        localStorage.setItem('pending_ref_code', refCode);
    }

    // 2. 检查用户是否已登录，且有待处理的推广码
    const pendingRef = localStorage.getItem('pending_ref_code');
    if (!pendingRef) return;

    const { data: { session } } = await client.auth.getSession();
    if (!session) return; // 未登录则等待，下次登录后执行

    // 3. 已登录：调用 RPC 绑定推广关系
    try {
        const { error } = await client.rpc('apply_referral', { ref_code: pendingRef });
        if (!error) {
            console.log('✅ 推广码绑定成功:', pendingRef);
            localStorage.removeItem('pending_ref_code'); // 成功后清除
        } else {
            console.warn('⚠️ 推广码绑定失败:', error.message);
        }
    } catch (e) {
        console.error(e);
    }
}
