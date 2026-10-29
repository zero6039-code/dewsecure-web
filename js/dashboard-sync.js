// 🌟 动态适配 Chrome 与 Edge 扩展 ID
const isEdge = navigator.userAgent.includes('Edg/');
const EXTENSION_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';

export function pushAuthStateToExtension(session, data) {
    if (!window.chrome?.runtime?.sendMessage) return;
    
    // 🌟 核心修复：坚决不传业务数据（tier, expiresAt等），插件端会自己去云端拉取，
    // 避免网页端和插件端数据不一致导致的 UI 疯狂横跳。
    const payload = {
        token: session?.access_token,
        refreshToken: session?.refresh_token,
        email: data.email
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
                console.log('✅ Dashboard 已推送基础登录态到插件');
            }
        });
    } catch (err) {
        console.warn('⚠️ [Dashboard] 插件通信异常拦截:', err.message);
    }
}
