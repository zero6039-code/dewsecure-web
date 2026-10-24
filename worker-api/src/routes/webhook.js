import { Hono } from 'hono';
import { getStripe } from '../lib/stripe.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const webhookRoute = new Hono();

function getPeriodEnd(sub) {
  const timestamp = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
}

function getSubIdFromInvoice(invoice) {
  return invoice.subscription || (invoice.parent && invoice.parent.subscription_details && invoice.parent.subscription_details.subscription);
}

function getTierFromPriceId(priceId) {
  if (priceId === 'price_1UTuyUPLgzklfWuMrMw8kW0b') return 'family';
  if (priceId === 'price_1UTuxqPLgzklfWuMDuFjH5ec') return 'pro';
  return 'pro';
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
  if (dupErr?.code === '23505') return c.text('Already processed', 200);

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
        
        await supabaseAdmin.from('profiles').update({ tier: newTier, stripe_customer_id: customerId, family_owner_id: null }).eq('id', userId);
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId, stripe_subscription_id: subId, stripe_customer_id: customerId,
          price_id: priceId, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: getPeriodEnd(sub),
        }, { onConflict: 'stripe_subscription_id' });
        
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
          await supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId);
          await supabaseAdmin.from('subscriptions').update({ 
            status: sub.status, price_id: priceId, current_period_end: getPeriodEnd(sub) 
          }).eq('stripe_subscription_id', subId);
        }

        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'manual' || invoice.billing_reason === 'subscription_create') {
          const { data: userProfile } = await supabaseAdmin.from('profiles').select('subscription_ends_at, trial_ends_at').eq('id', userId).single();
          
          let base = new Date();
          if (userProfile?.subscription_ends_at && new Date(userProfile.subscription_ends_at) > base) base = new Date(userProfile.subscription_ends_at);
          else if (userProfile?.trial_ends_at && new Date(userProfile.trial_ends_at) > base) base = new Date(userProfile.trial_ends_at);
          
          const newEnd = new Date(base.getTime() + 365 * 86400000).toISOString();
          await supabaseAdmin.from('profiles').update({ subscription_ends_at: newEnd }).eq('id', userId);
        }

        // 🌟 核心修复：抛弃 RPC，改用最稳妥的查+改
        const { data: inviteeProfile } = await supabaseAdmin.from('profiles').select('referred_by').eq('id', userId).single();
        if (inviteeProfile?.referred_by) {
          const inviterId = inviteeProfile.referred_by;
          
          const { data: existingReward } = await supabaseAdmin.from('referral_rewards')
            .select('id, status')
            .eq('inviter_id', inviterId)
            .eq('invitee_id', userId)
            .maybeSingle();

          let needIncrement = false;

          if (existingReward) {
             if (existingReward.status === 'voided') {
                 await supabaseAdmin.from('referral_rewards').update({
                     status: 'pending',
                     unlock_at: new Date(Date.now() + 14 * 86400000).toISOString(),
                     created_at: new Date().toISOString()
                 }).eq('id', existingReward.id);
                 needIncrement = true;
                 console.log(`[invoice] 发现已退款的二次购买，重新激活返利记录`);
             }
          } else {
             const { error: insertErr } = await supabaseAdmin.from('referral_rewards').insert({
               inviter_id: inviterId, invitee_id: userId, reward_days: 120,
               status: 'pending', unlock_at: new Date(Date.now() + 14 * 86400000).toISOString(),
             });
             if (!insertErr) {
                 needIncrement = true;
                 console.log(`[invoice] 新增返利记录`);
             }
          }

          if (needIncrement) {
             // 查出邀请人当前人数
             const { data: inviter } = await supabaseAdmin.from('profiles').select('invite_success_count').eq('id', inviterId).single();
             const currentCount = inviter?.invite_success_count || 0;
             
             const { error: updateErr } = await supabaseAdmin.from('profiles').update({ 
                 invite_success_count: currentCount + 1 
             }).eq('id', inviterId);

             if (updateErr) {
                 console.error(`❌ [invoice] 更新邀请人人数失败:`, updateErr.message);
             } else {
                 console.log(`✅ [invoice] 邀请人 ${inviterId} 成功邀请人数 +1 (当前: ${currentCount + 1})`);
             }
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        let userId = null;

        if (charge.customer) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', charge.customer).maybeSingle();
          if (profile) userId = profile.id;
        }

        if (userId) {
          console.log(`[refund] 发现退款用户: ${userId}，立即降级并收回权益`);
          await supabaseAdmin.from('profiles').update({ 
              tier: 'free', subscription_ends_at: null, family_owner_id: null 
          }).eq('id', userId);

          const { data: voidedRecords } = await supabaseAdmin.from('referral_rewards')
            .update({ status: 'voided' })
            .eq('invitee_id', userId)
            .eq('status', 'pending')
            .select();

          if (voidedRecords && voidedRecords.length > 0) {
              for (const record of voidedRecords) {
                  const inviterId = record.inviter_id;
                  const { data: inviter } = await supabaseAdmin.from('profiles').select('invite_success_count').eq('id', inviterId).single();
                  if (inviter && inviter.invite_success_count > 0) {
                      await supabaseAdmin.from('profiles').update({ 
                          invite_success_count: inviter.invite_success_count - 1 
                      }).eq('id', inviterId);
                      console.log(`✅ [refund] 邀请人 ${inviterId} 人数 -1 并作废返利`);
                  }
              }
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        
        if (event.type === 'customer.subscription.deleted') {
            if (userId) {
                await supabaseAdmin.from('profiles').update({ tier: 'free', subscription_ends_at: null }).eq('id', userId);
                await supabaseAdmin.from('profiles').update({ family_owner_id: null, tier: 'free' }).eq('family_owner_id', userId);
            }
            await supabaseAdmin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
        } else {
            const priceId = sub.items.data[0].price.id;
            const newTier = getTierFromPriceId(priceId);
            if (userId) await supabaseAdmin.from('profiles').update({ tier: newTier }).eq('id', userId);

            await supabaseAdmin.from('subscriptions').update({
              status: sub.status, price_id: priceId,
              cancel_at_period_end: sub.cancel_at_period_end, current_period_end: getPeriodEnd(sub),
            }).eq('stripe_subscription_id', sub.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return c.text('Handler error', 500);
  }

  return c.text('OK', 200);
});

export default webhookRoute;
