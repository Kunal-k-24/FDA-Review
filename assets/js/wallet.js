/**
 * FDAReview Wallet & Redemption Service
 * Manages balance queries, ledger transactions, and atomic simulated redemptions.
 */

import { supabase } from './supabase-client.js';
import { validateRedemption } from './validation.js';

export async function fetchUserWalletData(userId) {
  const [walletRes, txRes, redemptionsRes] = await Promise.all([
    supabase.from('wallets').select('*').eq('user_id', userId).single(),
    supabase.from('coin_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('redemptions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);

  if (walletRes.error && walletRes.error.code !== 'PGRST116') {
    throw walletRes.error;
  }

  return {
    wallet: walletRes.data || { balance_coins: 0 },
    transactions: txRes.data || [],
    redemptions: redemptionsRes.data || []
  };
}

export async function requestRedemption(requestedCoins, currentBalance) {
  const validation = validateRedemption(requestedCoins, currentBalance);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  // Calls the atomic database function: create_redemption
  // Verifies balance, reserves requested coins, creates pending redemption, and logs transaction atomically.
  const { data, error } = await supabase.rpc('create_redemption', {
    p_requested_coins: validation.requestedCoins
  });

  if (error) {
    throw error;
  }

  return data;
}
