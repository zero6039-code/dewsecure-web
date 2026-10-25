// ==========================================
// 📁 stripe-checkout.js (带详细诊断日志版)
// ==========================================

// 注意：请确保这里的 Stripe 密钥与你当前测试的环境一致
const stripe = Stripe('pk_test_51UTurXPLgzklfWuMM5YjFvu6AUFSVWx0ZE4bYSNwpPD04RBhRCAijbEw2BfIUiE6jMmP2HAcDvp0uxZCHs02REoQ003Bpbm59P');
let checkoutInstance = null;

const supabaseUrl = 'https://uvbaioqqjqseapcancvi.supabase.co';
const supabaseAnonKey = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';

// 本地测试环境自动指向 8787
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://127.0.0.1:8787' 
    : 'https://api.dewsecure.com';

function getSupabase() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && window.supabase.createClient) {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        return window.supabaseClient;
    }
    console.warn("⚠️ [Checkout] Supabase SDK 尚未加载！");
    return null;
}

function showPayError(msg) {
    console.error("❌ [Checkout] 错误:", msg);
    if (window.showToast) window.showToast(msg, 'error');
    else alert(msg);
}

async function startCheckout(priceId, planType) {
    console.log(`🚀 [Checkout] 触发支付流程，套餐: ${planType}, PriceID: ${priceId}`);
    
    const db = getSupabase();
    if (!db) {
        showPayError('系统加载异常，请刷新页面重试。');
        return;
    }

    try {
        console.log("⏳ [Checkout] 正在检查用户登录状态...");
        const { data: { session }, error } = await db.auth.getSession();
        
        if (error || !session) {
            console.log("❌ [Checkout] 用户未登录，跳转到登录页...");
            const redirectUrl = `${window.location.pathname}?autoPay=${planType}`;
            window.location.href = '/login/?redirect=' + encodeURIComponent(redirectUrl);
            return;
        }

        console.log("✅ [Checkout] 已登录，Token 存在。正在向 Worker 请求 Checkout 会话...");
        
        const res = await fetch(API_BASE + '/api/checkout', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + session.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ price_id: priceId })
        });
        
        const data = await res.json();
        console.log("📦 [Checkout] Worker 响应:", data);

        if (!res.ok) {
            if (data.error === 'ALREADY_SUBSCRIBED' || data.error === 'UPGRADE_REQUIRED') {
                const t = window.fallbackTranslations || {};
                const tipMsg = data.error === 'ALREADY_SUBSCRIBED' 
                    ? (t['already_subscribed'] || '您已拥有此套餐的有效订阅，请前往控制台管理。')
                    : (t['upgrade_required'] || '您已拥有其他套餐，请前往控制台升级。');
                window.showToast(tipMsg, 'error');
                setTimeout(() => { window.location.href = '/dashboard.html'; }, 2000);
                return;
            }
            throw new Error(data.message || 'API Error');
        }

        console.log("✅ [Checkout] 成功获取 clientSecret，正在挂载支付表单...");
        document.getElementById('checkout-container').style.display = 'block';
        if (checkoutInstance) checkoutInstance.destroy();
        checkoutInstance = await stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
        checkoutInstance.mount('#checkout-container');
        
    } catch (err) {
        console.error('❌ [Checkout] 发生异常:', err);
        showPayError('支付服务暂时不可用，请稍后再试。');
    }
}

// 🌟 核心监听器
document.addEventListener('click', (e) => {
    const proBtn = e.target.closest('.btn-pro');
    const famBtn = e.target.closest('.btn-fam');

    if (proBtn) {
        console.log("🖱️ [DOM] 监听到点击了『高级版』按钮");
        e.preventDefault();
        // ⚠️ 请确保这里是你的测试版 Price ID
        startCheckout('price_1UTuxqPLgzklfWuMDuFjH5ec', 'pro');
    } else if (famBtn) {
        console.log("🖱️ [DOM] 监听到点击了『家庭版』按钮");
        e.preventDefault();
        startCheckout('price_1UTuyUPLgzklfWuMrMw8kW0b', 'fam');
    }
});

// 自动支付弹窗逻辑 (从登录页跳回时)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const autoPay = urlParams.get('autoPay');
    if (autoPay === 'pro') {
        console.log("🔄 [AutoPay] 检测到登录跳回，自动触发 Pro 支付");
        startCheckout('price_1UTuxqPLgzklfWuMDuFjH5ec', 'pro');
    } else if (autoPay === 'fam') {
        console.log("🔄 [AutoPay] 检测到登录跳回，自动触发 Family 支付");
        startCheckout('price_1UTuyUPLgzklfWuMrMw8kW0b', 'fam');
    }
});
