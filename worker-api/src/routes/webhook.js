import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const webhookRoute = new Hono();

// 🌟 核心修复：封装 must 函数，强制检查数据库返回的 error
const must = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

function getPeriodEnd(sub) {
  const timestamp = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}

function getSubIdFromInvoice(invoice) {
  return invoice.subscription || (invoice.parent && invoice.parent.subscription_details && invoice.parent.subscription_details.subscription);
}

function getTierFromPriceId(priceId) {
  if (priceId === 'price_1UUF9SAB28DjNkOqrt3BX9Dr') return 'family';
  if (priceId === 'price_1UUF86AB28DjNkOqNGl2YoBN') return 'pro';
  throw new Error(`Unknown or forbidden price ID: ${priceId}`);
}

webhookRoute.post('/webhook', async (c) => {
  const stripe = getStripe(c.env);
  const supabaseAdmin = getSupabaseAdmin(c.env);

  const sig = c.req.header('stripe-signature');
  const rawBody = await c.req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.text(`Webhook Error: ${err.message}`, 400);
  }

  console.log(`\n================ 收到 Webhook: ${event.type} ================`);

  const { error: dupErr } = await supabaseAdmin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type });
  
  if (dupErr) {
    if (dupErr.code === '23505') {
      return c.text('Already processed', 200);
    }
    throw dupErr;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const subId = session.subscription;
        const customerId = session.customer;

        if (!userId || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0].price.id;
        const newTier = getTierFromPriceId(priceId);
        
        await must(supabaseAdmin.from('profiles').update({ tier: newTier, stripe_customer_id: customerId, family_owner_id: null }).eq('id', userId));
        await must(supabaseAdmin.from('subscriptions').upsert({
          user_id: userId, stripe_subscription_id: subId, stripe_customer_id: customerId,
          price_id: priceId, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: getPeriodEnd(sub),
        }, { onConflict: 'stripe_subscription_id' }));
        
        console.log(`✅ [checkout] 用户 ${userId} 成功升级为 ${newTier}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        let subId = getSubIdFromInvoice(invoice);
        let userId = null;
        let sub = null;

        if (subId) {
          sub = await stripe.subscriptions.retrieve(subId);
          userId = sub.metadata?.user_id || (invoice.parent?.subscription_details?.metadata?.user_id);
        }

        if (!userId && invoice.customer) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', invoice.customer).maybeSingle();
          if (profile) userId = profile.id;
        }

        if (!userId) break;

        if (sub) {
          const priceId = sub.items.data[0].price.id;
          const newTier = getTierFromPriceId(priceId);
          await must(supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId));
          await must(supabaseAdmin.from('subscriptions').update({ 
            status: sub.status, price_id: priceId, current_period_end: getPeriodEnd(sub) 
          }).eq('stripe_subscription_id', subId));
        }

        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'manual' || invoice.billing_reason === 'subscription_create') {
          const { data: userProfile } = await supabaseAdmin.from('profiles').select('subscription_ends_at, trial_ends_at').eq('id', userId).single();
          
          let base = new Date();
          if (userProfile?.subscription_ends_at && new Date(userProfile.subscription_ends_at) > base) base = new Date(userProfile.subscription_ends_at);
          else if (userProfile?.trial_ends_at && new Date(userProfile.trial_ends_at) > base) base = new Date(userProfile.trial_ends_at);
          
          const newEnd = new Date(base.getTime() + 365 * 86400000).toISOString();
          await must(supabaseAdmin.from('profiles').update({ subscription_ends_at: newEnd }).eq('id', userId));
        }

        // 🌟 修复 M-6：只在首次订阅（subscription_create）时才发推荐奖励
        if (invoice.billing_reason === 'subscription_create') {
          const { data: inviteeProfile } = await supabaseAdmin.from('profiles').select('referred_by').eq('id', userId).single();
          if (inviteeProfile?.referred_by) {
            const { error: insertErr } = await supabaseAdmin.from('referral_rewards').insert({
              inviter_id: inviteeProfile.referred_by, invitee_id: userId, reward_days: 120,
              status: 'pending', unlock_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            }).select().maybeSingle();

            if (!insertErr) {
               const { data: inviter } = await supabaseAdmin.from('profiles').select('invite_success_count').eq('id', inviteeProfile.referred_by).single();
               if (inviter) {
                   // 🌟 修复 M-6：原子递增，防止并发覆盖
                   await must(supabaseAdmin.rpc('increment_invite_count', { user_id: inviteeProfile.referred_by }));
               }
            }
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        // 🌟 修复 M-4：只处理全额退款（refunded 为 true）
        if (charge.refunded !== true) {
            console.log(`[refund] 检测到部分退款，忽略降级操作: ${charge.id}`);
            break;
        }

        let userId = null;
        if (charge.customer) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', charge.customer).maybeSingle();
          if (profile) userId = profile.id;
        }
        // 🌟 修复 M-4：删除了不安全的 billing_details.email 匹配

        if (userId) {
          console.log(`[refund] 发现全额退款用户: ${userId}，立即降级并收回权益`);
          
          // 🌟 修复 M-4：在全额退款时，必须去 Stripe 取消对应的订阅，防止下期继续扣费
          if (charge.invoice) {
              try {
                  const invoice = await stripe.invoices.retrieve(charge.invoice);
                  if (invoice.subscription) {
                      await stripe.subscriptions.cancel(invoice.subscription);
                      console.log(`[refund] 已取消用户 ${userId} 的 Stripe 订阅 ${invoice.subscription}`);
                  }
              } catch (err) {
                  console.error('❌ [refund] 取消订阅失败:', err.message);
              }
          }

          await must(supabaseAdmin.from('profiles').update({ tier: 'free', subscription_ends_at: null, family_owner_id: null }).eq('id', userId));

          const voidedRecords = await must(supabaseAdmin.from('referral_rewards').update({ status: 'voided' }).eq('invitee_id', userId).eq('status', 'pending').select());

          if (voidedRecords && voidedRecords.length > 0) {
              for (const record of voidedRecords) {
                  const inviterId = record.inviter_id;
                  // 🌟 修复 M-6：原子递减
                  await must(supabaseAdmin.rpc('decrement_invite_count', { user_id: inviterId }));
              }
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        
        const isCanceling = sub.cancel_at_period_end || (sub.cancel_at !== null && sub.status === 'active') || (sub.canceled_at !== null && sub.status === 'active');

        if (event.type === 'customer.subscription.deleted') {
            if (userId) {
                await must(supabaseAdmin.from('profiles').update({ tier: 'free', subscription_ends_at: null }).eq('id', userId));
                await must(supabaseAdmin.from('profiles').update({ family_owner_id: null, tier: 'free' }).eq('family_owner_id', userId));
            }
            await must(supabaseAdmin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id));
        } else {
            const priceId = sub.items.data[0].price.id;
            let newTier = getTierFromPriceId(priceId);
            
            // 🌟 修复 M-5：只有 active 或 trialing 才保留权益
            const activeStatuses = ['active', 'trialing'];
            if (!activeStatuses.includes(sub.status)) {
                newTier = 'free'; // 欠费、逾期等状态，直接降级
                console.log(`[subscription.updated] 订阅状态为 ${sub.status}，执行降级`);
            }

            if (userId) await must(supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId));

            await must(supabaseAdmin.from('subscriptions').update({
              status: sub.status, 
              price_id: priceId,
              cancel_at_period_end: isCanceling,
              current_period_end: getPeriodEnd(sub),
            }).eq('stripe_subscription_id', sub.id));
            
            console.log(`[subscription.updated] 同步取消状态: ${isCanceling}`);
        }
        break;
      }
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    await supabaseAdmin.from('stripe_webhook_events').delete().eq('event_id', event.id);
    return c.text('Handler error', 500);
  }

  return c.text('OK', 200);
clear});

export default webhookRoute;
