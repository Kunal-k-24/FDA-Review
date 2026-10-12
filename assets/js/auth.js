/**
 * FDAReview Authentication Service
 * Manages Supabase Auth, session caching, role identification, and demo account login.
 */

import { supabase } from './supabase-client.js';
import { CONFIG } from './config.js';
import { showToast } from './ui.js';

let currentUser = null;
let currentProfile = null;
let currentWallet = null;

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await fetchUserProfileAndWallet(currentUser.id);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      await fetchUserProfileAndWallet(currentUser.id);
    } else {
      currentUser = null;
      currentProfile = null;
      currentWallet = null;
    }
    // Dispatch custom auth state change event for UI components
    window.dispatchEvent(new CustomEvent('fda:auth-changed', {
      detail: { user: currentUser, profile: currentProfile, wallet: currentWallet }
    }));
  });

  return { user: currentUser, profile: currentProfile, wallet: currentWallet };
}

export async function fetchUserProfileAndWallet(userId) {
  try {
    const [profileRes, walletRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('wallets').select('*').eq('user_id', userId).single()
    ]);

    if (profileRes.data) currentProfile = profileRes.data;
    if (walletRes.data) currentWallet = walletRes.data;
  } catch (err) {
    console.error('Error fetching profile or wallet:', err);
  }
}

export async function loginWithDemoAccount(usernameOrEmail, password) {
  const normalized = usernameOrEmail.trim().toLowerCase();
  
  // Map username to email if a username was passed
  let targetEmail = normalized;
  const accounts = CONFIG.PROVISIONED_ACCOUNTS || [];
  const matched = accounts.find(a => 
    a.username.toLowerCase() === normalized || a.email.toLowerCase() === normalized
  );

  if (matched) {
    targetEmail = matched.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: password
  });

  if (error) {
    throw error;
  }

  currentUser = data.user;
  await fetchUserProfileAndWallet(currentUser.id);
  return { user: currentUser, profile: currentProfile, wallet: currentWallet };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast(error.message, 'error');
  } else {
    currentUser = null;
    currentProfile = null;
    currentWallet = null;
    window.location.href = 'index.html';
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function getCurrentWallet() {
  return currentWallet;
}

export function isAdmin() {
  return currentProfile?.role === 'admin';
}
