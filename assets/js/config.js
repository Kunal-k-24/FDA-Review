/**
 * FDAReview Global Configuration
 * Centralized settings for Supabase client, OSM endpoints, and Coin conversion rates.
 */

export const CONFIG = {
  APP_NAME: 'FDAReview',
  TAGLINE: 'Discover. Review. Earn.',
  
  // Supabase Configuration
  SUPABASE_URL: 'https://tbeyxsstluvngizgjdmx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXl4c3N0bHV2bmdpemdqZG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDc0MjMsImV4cCI6MjEwNzM4MzQyM30.egf8j0P8aEYKclA2YVBtZaB9qfeObZmB9Osy_2zidnY',
  
  // Coin Tokenomics & Redemption Rates
  COINS_PER_REVIEW: 10,
  COINS_TO_INR_RATIO: 100, // 100 FDA Coins = ₹1 (1000 Coins = ₹10)

  // Geographic Services (Free OpenStreetMap Services with mirrors)
  OVERPASS_API_MIRRORS: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ],
  NOMINATIM_API_URL: 'https://nominatim.openstreetmap.org/search',
  DEFAULT_MAP_CENTER: [18.5204, 73.8567], // Pune default
  DEFAULT_ZOOM: 14,

  // Provisioned System Accounts Reference
  PROVISIONED_ACCOUNTS: [
    { username: 'aditya thorat', email: 'aditya@fdareview.demo', role: 'user', label: 'Aditya Thorat' },
    { username: 'mitadmin', email: 'mitadmin@fdareview.demo', role: 'admin', label: 'MIT Admin' },
    { username: 'cseproject', email: 'cseproject@fdareview.demo', role: 'user', label: 'CSE Project' },
    { username: 'demoacc', email: 'demoacc@fdareview.demo', role: 'user', label: 'General Account' }
  ]
};
