import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const webhookRoute = new Hono();

const must = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// 辅助函数：发送通知
async function sendNotification(supabaseAdmin, userId, type, titleKey, msgKey, params = {}) {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: type,
      title_key: titleKey,
      message_key: msgKey,
      params: params
    });
    if (error) console.error('发送通知失败:', error.message);
  } catch (err) {
    console.error('发送通知抛出异常:', err.message);
  }
}

function getPeriodEnd(sub) {
  const timestamp = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}

function getSubIdFromInvoice(invoice) {
  return invoice.subscription || (invoice.parent && invoice.parent.subscription_details && invoice.parent.subscription_details.subscription);
}

// 🌟 修复 S-03 问题 2：遇到未知价格返回 null，不再 throw
function getTierFromPriceId(priceId) {
  if (priceId === 'price_1UUF9SAB28DjNkOqrt3BX9Dr') return 'family';
  if (priceId === 'price_1UUF86AB28DjNkOqNGl2YoBN') return 'pro';
  return null; 
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
        
        if (!newTier) {
          console.error(`[checkout] 未知价格 ID: ${priceId}，跳过处理`);
          break;
        }

        await must(supabaseAdmin.from('profiles').update({ tier: newTier, stripe_customer_id: customerId, family_owner_id: null }).eq('id', userId));
        await must(supabaseAdmin.from('subscriptions').upsert({
          user_id: userId, stripe_subscription_id: subId, stripe_customer_id: customerId,
          price_id: priceId, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: getPeriodEnd(sub),
        }, { onConflict: 'stripe_subscription_id' }));
        
        const upgradeKey = newTier === 'family' ? 'notif_upgraded_family' : 'notif_upgraded_pro';
        await sendNotification(supabaseAdmin, userId, 'billing', upgradeKey, upgradeKey, { email: session.customer_details?.email || 'User' });
        
        console.log(`✅ [checkout] 用户 ${userId} 成功升级为 ${newTier}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        let subId = getSubIdFromInvoice(invoice); // 🌟 修复：统一使用兼容函数
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
          if (!newTier) {
             console.error(`[invoice] 未知价格 ID: ${priceId}，跳过处理`);
             break;
          }
          await must(supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId));
          await must(supabaseAdmin.from('subscriptions').update({ 
            status: sub.status, price_id: priceId, current_period_end: getPeriodEnd(sub) 
          }).eq('stripe_subscription_id', subId));
        }

        // 🌟 修复 S-03 问题 4：去掉了 'manual'，仅保留创建和周期续费
        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create') {
          const { data: userProfile } = await supabaseAdmin.from('profiles').select('subscription_ends_at, trial_ends_at').eq('id', userId).single();
          
          let base = new Date();
          if (userProfile?.subscription_ends_at && new Date(userProfile.subscription_ends_at) > base) base = new Date(userProfile.subscription_ends_at);
          else if (userProfile?.trial_ends_at && new Date(userProfile.trial_ends_at) > base) base = new Date(userProfile.trial_ends_at);
          
          const newEnd = new Date(base.getTime() + 365 * 86400000).toISOString();
          await must(supabaseAdmin.from('profiles').update({ subscription_ends_at: newEnd }).eq('id', userId));
        }

        if (invoice.billing_reason === 'subscription_create') {
          await sendNotification(supabaseAdmin, userId, 'billing', 'notif_billing_success', 'notif_billing_success');
        } else if (invoice.billing_reason === 'subscription_cycle') {
          await sendNotification(supabaseAdmin, userId, 'billing', 'notif_renewed', 'notif_renewed');
        }

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
                   await must(supabaseAdmin.rpc('increment_invite_count', { user_id: inviteeProfile.referred_by }));
                   await sendNotification(supabaseAdmin, inviteeProfile.referred_by, 'referral', 'notif_invite_pending', 'notif_invite_pending', { email: invoice.customer_email });
               }
            }
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.refunded !== true) {
            console.log(`[refund] 检测到部分退款，忽略降级操作: ${charge.id}`);
            break;
        }

        let userId = null;
        if (charge.customer) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', charge.customer).maybeSingle();
          if (profile) userId = profile.id;
        }

        if (userId) {
          console.log(`[refund] 发现全额退款用户: ${userId}，立即降级并收回权益`);
          
          if (charge.invoice) {
              try {
                  const invoice = await stripe.invoices.retrieve(charge.invoice);
                  const realSubId = getSubIdFromInvoice(invoice); // 🌟 修复 S-03 问题 1：使用兼容函数
                  if (realSubId) {
                      await stripe.subscriptions.cancel(realSubId);
                      console.log(`[refund] 已取消用户 ${userId} 的 Stripe 订阅 ${realSubId}`);
                  }
              } catch (err) {
                  console.error('❌ [refund] 取消订阅失败:', err.message);
              }
          }

          await must(supabaseAdmin.from('profiles').update({ tier: 'free', subscription_ends_at: null, family_owner_id: null }).eq('id', userId));

          await sendNotification(supabaseAdmin, userId, 'billing', 'notif_refund_success', 'notif_refund_success');

          const voidedRecords = await must(supabaseAdmin.from('referral_rewards').update({ status: 'voided' }).eq('invitee_id', userId).eq('status', 'pending').select());

          if (voidedRecords && voidedRecords.length > 0) {
              for (const record of voidedRecords) {
                await must(supabaseAdmin.rpc('decrement_invite_count', { user_id: record.inviter_id }));
                await sendNotification(supabaseAdmin, record.inviter_id, 'referral', 'notif_referral_refunded', 'notif_referral_refunded', { email: charge.billing_details?.email || 'User' });
              }
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        let sub = event.data.object;
        const userId = sub.metadata?.user_id;
        
        // 🌟 修复 S-03 问题 3：事件乱序。非 deleted 事件，强制向 Stripe 获取最新状态
        if (event.type === 'customer.subscription.updated') {
            sub = await stripe.subscriptions.retrieve(sub.id);
        }
        
        const isCanceling = sub.cancel_at_period_end || (sub.cancel_at !== null && sub.status === 'active') || (sub.canceled_at !== null && sub.status === 'active');

        if (event.type === 'customer.subscription.deleted') {
            if (userId) {
                await must(supabaseAdmin.from('profiles').update({ tier: 'free', subscription_ends_at: null }).eq('id', userId));
                await must(supabaseAdmin.from('profiles').update({ family_owner_id: null, tier: 'free' }).eq('family_owner_id', userId));
                
                const { data: dbUser } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
                const realEmail = dbUser?.email || 'User';
                
                await sendNotification(supabaseAdmin, userId, 'billing', 'notif_downgraded_free', 'notif_downgraded_free', { email: realEmail });
            }
            await must(supabaseAdmin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id));
        } else {
            const priceId = sub.items.data[0].price.id;
            let newTier = getTierFromPriceId(priceId);
            if (!newTier) {
                console.error(`[subscription.updated] 未知价格 ID: ${priceId}，跳过更新`);
                break;
            }
            
            const activeStatuses = ['active', 'trialing'];
            if (!activeStatuses.includes(sub.status)) {
                newTier = 'free';
                console.log(`[subscription.updated] 订阅状态为 ${sub.status}，执行降级`);
                
                if (userId) {
                    const { data: dbUser } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
                    await sendNotification(supabaseAdmin, userId, 'billing', 'notif_downgraded_free', 'notif_downgraded_free', { email: dbUser?.email || 'User' });
                }
            }

            if (userId) await must(supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId));

            await must(supabaseAdmin.from('subscriptions').update({
              status: sub.status, 
              price_id: priceId,
              cancel_at_period_end: isCanceling,
              current_period_end: getPeriodEnd(sub),
            }).eq('stripe_subscription_id', sub.id));
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
});

export default webhookRoute;
