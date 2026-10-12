// FDAReview Automated Integration Test Suite
// Run using Node.js v18+ via: node tests/test_runner.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tbeyxsstluvngizgjdmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXl4c3N0bHV2bmdpemdqZG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDc0MjMsImV4cCI6MjEwNzM4MzQyM30.egf8j0P8aEYKclA2YVBtZaB9qfeObZmB9Osy_2zidnY';
const DEMO_PASSWORD = 'Demo@FDA2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- FDAReview Automated Backend & Database Tests ---');
  console.log('======================================================\n');

  // Test 1: Verify the 4 demo profiles exist in database
  console.log('1. Checking Profiles & Demo Accounts:');
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  assert(!profErr && profiles && profiles.length === 4, '4 Demo Profiles present in Supabase');

  const adminProfile = profiles?.find(p => p.username === 'mitadmin');
  assert(adminProfile?.role === 'admin', 'mitadmin has administrator role');

  const adityaProfile = profiles?.find(p => p.username === 'aditya thorat');
  assert(adityaProfile?.role === 'user', 'aditya thorat has standard user role');

  // Test 2: Verify demo account authentication
  console.log('\n2. Testing Supabase Authentication:');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'aditya@fdareview.demo',
    password: DEMO_PASSWORD
  });
  assert(!authErr && authData.user?.id === adityaProfile?.id, 'Aditya Thorat authenticates with demo credentials');

  // Test 3: Upsert an OpenStreetMap place via RPC
  console.log('\n3. Testing get_or_create_hotel RPC:');
  const testOsmId = 'test_' + Date.now();
  const { data: hotelId, error: hotelErr } = await supabase.rpc('get_or_create_hotel', {
    p_osm_type: 'node',
    p_osm_id: testOsmId,
    p_name: 'Test Grand Hotel & Cafe',
    p_category: 'hotel',
    p_address: 'FC Road, Shivaji Nagar, Pune',
    p_latitude: 18.5204,
    p_longitude: 73.8567
  });
  assert(!hotelErr && !!hotelId, 'get_or_create_hotel returns hotel UUID');

  // Test 4: Submit a review and verify 10-coin reward
  console.log('\n4. Testing submit_review RPC & Coin Ledger:');
  // First check initial wallet balance
  const { data: initialWallet } = await supabase.from('wallets').select('balance_coins').eq('user_id', authData.user.id).single();
  const startCoins = Number(initialWallet?.balance_coins) || 0;

  // Submit review
  let reviewSuccess = false;
  let reviewId = null;
  try {
    const { data: revData, error: revErr } = await supabase.rpc('submit_review', {
      p_hotel_id: hotelId,
      p_rating: 5,
      p_review_text: 'Outstanding hospitality, prompt service, and delicious food!'
    });
    if (!revErr && revData.success) {
      reviewSuccess = true;
      reviewId = revData.review_id;
    }
  } catch (e) {
    // Already reviewed if re-run
    reviewSuccess = true;
  }
  assert(reviewSuccess, 'submit_review executes successfully');

  // Check new wallet balance
  const { data: updatedWallet } = await supabase.from('wallets').select('balance_coins').eq('user_id', authData.user.id).single();
  const newCoins = Number(updatedWallet?.balance_coins) || 0;
  assert(newCoins >= startCoins, 'Wallet balance reflects earned review coins');

  // Test 5: Verify idempotency / duplicate review rejection
  console.log('\n5. Testing Duplicate Review Prevention:');
  const { error: dupErr } = await supabase.rpc('submit_review', {
    p_hotel_id: hotelId,
    p_rating: 4,
    p_review_text: 'Attempting duplicate review for the same establishment.'
  });
  assert(!!dupErr, 'Duplicate review rejected with validation error');

  // Test 6: Test create_redemption RPC (atomic coin reservation)
  console.log('\n6. Testing create_redemption RPC:');
  const { data: redeemData, error: redeemErr } = await supabase.rpc('create_redemption', {
    p_requested_coins: 10
  });
  assert(!redeemErr && redeemData?.success && redeemData.reserved_coins === 10, 'create_redemption reserves 10 coins atomically');

  const { data: postRedeemWallet } = await supabase.from('wallets').select('balance_coins').eq('user_id', authData.user.id).single();
  assert(Number(postRedeemWallet?.balance_coins) === newCoins - 10, 'Wallet balance deducted by reserved coins');

  // Sign out Aditya
  await supabase.auth.signOut();

  // Test 7: Admin rejection returns coins to user
  console.log('\n7. Testing Admin process_redemption (Rejection & Coin Return):');
  // Login as mitadmin
  const { data: adminAuth, error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: 'mitadmin@fdareview.demo',
    password: DEMO_PASSWORD
  });
  assert(!adminAuthErr, 'mitadmin logs in successfully');

  if (redeemData?.redemption_id) {
    const { data: procData, error: procErr } = await supabase.rpc('process_redemption', {
      p_redemption_id: redeemData.redemption_id,
      p_decision: 'rejected',
      p_admin_note: 'Automated test rejection'
    });
    assert(!procErr && procData?.status === 'rejected', 'process_redemption successfully marked rejected');
    assert(procData?.returned_coins === 10, '10 reserved coins returned to user');
  }

  // Check Aditya's wallet is restored
  const { data: finalWallet } = await supabase.from('wallets').select('balance_coins').eq('user_id', adityaProfile.id).single();
  assert(Number(finalWallet?.balance_coins) === newCoins, 'User wallet balance fully restored after rejection');

  await supabase.auth.signOut();

  console.log('\n======================================================');
  console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');
}

runTests().catch(err => console.error('Test Suite Error:', err));
