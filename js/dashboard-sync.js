// 🌟 动态适配 Chrome 与 Edge 扩展 ID
const isEdge = navigator.userAgent.includes('Edg/');
const EXTENSION_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';

export function pushAuthStateToExtension(session, data) {
    if (!window.chrome?.runtime?.sendMessage) return;
    
    const payload = {
        token: session?.access_token,
        refreshToken: session?.refresh_token,
        email: data.email,
        tier: data.tier,
        expiresAt: data.trial_ends_at,
        ownerEmail: data.owner_email || null
    };

    // 🌟 核心修复：用 try-catch 捕获同步异常，防止整个页面崩溃
    try {
        window.chrome.runtime.sendMessage(EXTENSION_ID, {
            type: 'SYNC_AUTH',
            payload: payload
        }, (res) => {
            if (window.chrome.runtime.lastError) {
                console.warn('⚠️ 推送插件失败:', window.chrome.runtime.lastError.message);
            } else {
                console.log('✅ Dashboard 已推送最新状态到插件:', payload.tier);
            }
        });
    } catch (err) {
        console.warn('⚠️ [Dashboard] 插件通信异常拦截:', err.message);
    }
}
