// 🌟 统一在这里定义 EXTENSION_ID，避免各文件重复
const isEdge = navigator.userAgent.includes('Edg/');
// ⚠️ 注意：您的 Edge ID 是 31 位，正常应为 32 位，请去开发者后台核对一下，如有完整版请替换这里的
export const EXTENSION_ID = isEdge ? 'cpkmeoejhbmcmnaodpnkfdjgggpmgcf' : 'fgnijfomipmimnfocgofmmniglibgnak';

export function pushAuthStateToExtension(session) {
    if (!window.chrome?.runtime?.sendMessage || !session) return;
    
    const payload = {
        token: session.access_token,
        refreshToken: session.refresh_token,
        email: session.user?.email
    };

    try {
        window.chrome.runtime.sendMessage(EXTENSION_ID, {
            type: 'SYNC_AUTH',
            payload: payload
        }, (res) => {
            if (window.chrome.runtime.lastError) {
                console.warn('⚠️ 推送插件失败:', window.chrome.runtime.lastError.message);
            } else {
                window.DEBUG_LOG('✅ 已推送登录态到插件');
            }
        });
    } catch (err) {
        console.warn('⚠️ 插件通信异常拦截:', err.message);
    }
}

// 🌟 新增：统一定义登出通知函数
export function clearAuthInExtension() {
    if (!window.chrome?.runtime?.sendMessage) return;
    try {
        window.chrome.runtime.sendMessage(EXTENSION_ID, { type: 'LOGOUT' }, () => {
            if (window.chrome.runtime.lastError) {
                // 忽略未安装插件的报错
            }
        });
    } catch (err) {}
}
