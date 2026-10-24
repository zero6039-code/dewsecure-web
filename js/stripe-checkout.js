const stripe = Stripe('pk_test_51UTurXPLgzklfWuMM5YjFvu6AUFSVWx0ZE4bYSNwpPD04RBhRCAijbEw2BfIUiE6jMmP2HAcDvp0uxZCHs02REoQ003Bpbm59P');
let checkoutInstance = null;

const supabaseUrl = 'https://uvbaioqqjqseapcancvi.supabase.co';
const supabaseAnonKey = 'sb_publishable_xiiA-yt_jRKkzRdkYkoWJA_CVZjNjq8';
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:8787' : '';

function getSupabase() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && window.supabase.createClient) {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        return window.supabaseClient;
    }
    return null;
}

async function startCheckout(priceId, planType) {
    const db = getSupabase();
    if (!db) { window.showToast('系统加载异常，请刷新重试', 'error'); return; }

    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) {
            const redirectUrl = `${window.location.pathname}?autoPay=${planType}`;
            window.location.href = '/login/?redirect=' + encodeURIComponent(redirectUrl);
            return;
        }

        // 🌟 新增：检查是否在家庭组中
        const { data: profile } = await db.from('profiles').select('family_owner_id').eq('id', session.user.id).single();
        
        const executeCheckout = async () => {
            const res = await fetch(API_BASE + '/api/checkout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ price_id: priceId })
            });
            
            const data = await res.json();
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

            document.getElementById('checkout-container').style.display = 'block';
            if (checkoutInstance) checkoutInstance.destroy();
            checkoutInstance = await stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
            checkoutInstance.mount('#checkout-container');
        };

        if (profile && profile.family_owner_id) {
            const t = window.fallbackTranslations || {};
            window.showGlassConfirm(
                t['checkout_unbind_title'] || '确认退出家庭组？',
                t['checkout_unbind_desc'] || '购买独立订阅后，您将自动退出家庭组。',
                executeCheckout
            );
        } else {
            await executeCheckout();
        }
    } catch (err) {
        console.error('❌ Checkout 发生异常:', err);
        window.showToast('支付服务暂时不可用', 'error');
    }
}

document.addEventListener('click', (e) => {
    const proBtn = e.target.closest('.btn-pro');
    const famBtn = e.target.closest('.btn-fam');
    if (proBtn) { e.preventDefault(); startCheckout('price_1UTuxqPLgzklfWuMDuFjH5ec', 'pro'); }
    else if (famBtn) { e.preventDefault(); startCheckout('price_1UTuyUPLgzklfWuMrMw8kW0b', 'fam'); }
});

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const autoPay = urlParams.get('autoPay');
    if (autoPay === 'pro') startCheckout('price_1UTuxqPLgzklfWuMDuFjH5ec', 'pro');
    else if (autoPay === 'fam') startCheckout('price_1UTuyUPLgzklfWuMrMw8kW0b', 'fam');
});
