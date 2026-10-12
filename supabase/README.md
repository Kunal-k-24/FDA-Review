# Supabase Setup for FDAReview

This directory contains the database migration and repeatable seed data for FDAReview.

## Architecture

- **`migrations/20261012000000_init_fdareview.sql`**: Full DDL schema with RLS policies and RPC functions.
  - Tables: `profiles`, `hotels`, `reviews`, `wallets`, `coin_transactions`, `redemptions`, `moderation_actions`.
  - RPC Functions:
    - `get_or_create_hotel`: Links OpenStreetMap node/way/relation into PostgreSQL.
    - `submit_review`: Validates review and awards 10 FDA coins atomically.
    - `update_review`: Updates existing review without re-awarding coins.
    - `create_redemption`: Validates balance and reserves coins atomically.
    - `process_redemption`: Administrator approval or rejection with coin return.
    - `moderate_review`: Administrative hiding/restoring of reviews with audit trail.
    - `admin_adjust_wallet`: Secure administrative adjustment with ledger trace.
    - `demo_register_redirect`: Safely routes the demo registration flow to Aditya Thorat's account.

- **`seed.sql`**: Seeds the 4 required demo accounts:
  1. `aditya thorat` (User, 50 coins)
  2. `mitadmin` (Administrator, 250 coins)
  3. `cseproject` (User, 30 coins)
  4. `demoacc` (User, 20 coins)

All demo accounts share the demonstration password: `Demo@FDA2026!`
