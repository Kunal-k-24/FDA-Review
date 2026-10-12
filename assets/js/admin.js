/**
 * FDAReview Admin Dashboard Service
 * Provides administrator queries for system metrics, user lists, review moderation, and redemption resolution.
 */

import { supabase } from './supabase-client.js';

export async function fetchAdminOverviewStats() {
  const [usersCount, hotelsCount, reviewsCount, redemptionsPending, coinsAwarded] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('hotels').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
    supabase.from('redemptions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('coin_transactions').select('amount_coins').gt('amount_coins', 0)
  ]);

  let totalCoinsIssued = 0;
  if (coinsAwarded.data) {
    totalCoinsIssued = coinsAwarded.data.reduce((acc, row) => acc + (Number(row.amount_coins) || 0), 0);
  }

  return {
    totalUsers: usersCount.count || 0,
    totalHotels: hotelsCount.count || 0,
    totalReviews: reviewsCount.count || 0,
    pendingRedemptions: redemptionsPending.count || 0,
    totalCoinsIssued
  };
}

export async function fetchAdminUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      role,
      created_at,
      wallets:id (
        balance_coins
      )
    `)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchAdminRedemptions() {
  const { data, error } = await supabase
    .from('redemptions')
    .select(`
      id,
      user_id,
      requested_coins,
      illustrative_amount_inr,
      status,
      admin_note,
      created_at,
      processed_at,
      profiles:user_id (
        username,
        display_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function processRedemptionRequest(redemptionId, decision, adminNote = '') {
  // Invokes trusted RPC process_redemption
  const { data, error } = await supabase.rpc('process_redemption', {
    p_redemption_id: redemptionId,
    p_decision: decision, // 'approved' or 'rejected'
    p_admin_note: adminNote
  });

  if (error) throw error;
  return data;
}

export async function fetchAdminReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      rating,
      review_text,
      is_hidden,
      moderation_reason,
      created_at,
      hotels:hotel_id (
        id,
        name,
        category
      ),
      profiles:user_id (
        username,
        display_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function moderateReviewStatus(reviewId, action, reason) {
  // Invokes trusted RPC moderate_review ('hidden' or 'restored')
  const { data, error } = await supabase.rpc('moderate_review', {
    p_review_id: reviewId,
    p_action: action,
    p_reason: reason
  });

  if (error) throw error;
  return data;
}

export async function adjustUserWalletBalance(targetUserId, amountCoins, reason) {
  // Invokes trusted RPC admin_adjust_wallet
  const { data, error } = await supabase.rpc('admin_adjust_wallet', {
    p_target_user_id: targetUserId,
    p_amount_coins: parseInt(amountCoins, 10),
    p_reason: reason
  });

  if (error) throw error;
  return data;
}
