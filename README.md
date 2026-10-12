# FDAReview — Hotel & Restaurant Review Platform

> **Discover. Review. Earn.**  
> A full-stack location-based hotel and restaurant discovery and community review platform built with Vanilla HTML5, CSS3, ES modules, Leaflet, OpenStreetMap, and Supabase.

---

## 1. Project Overview

**FDAReview** is an interactive, responsive web application where users can:
- Discover nearby hotels, cafes, and restaurants on a Leaflet map powered by OpenStreetMap Overpass & Nominatim APIs.
- Read authentic community reviews and ratings.
- Post ratings and reviews for visited establishments, instantly earning **10 FDA Coins** atomically recorded in a PostgreSQL transaction ledger.
- View a persistent wallet balance and transaction ledger.
- Simulate redeeming FDA Coins for an illustrative rupee value (**1,000 FDA Coins = ₹10**).
- Access a secure administrator control center (`mitadmin`) to moderate reviews, inspect user wallets, and approve or reject simulated redemptions (which returns reserved coins to user wallets upon rejection).

---

## 2. Technology Stack

- **Frontend:** Vanilla HTML5, CSS3, Modern ES Modules (No heavy frameworks).
- **Design System:** Custom Dark Forest-Green (`#0D1511`, `#142019`, `#18271E`) with Fresh Lime accents (`#B8F36B`, `#91CF4C`) and Inter typography.
- **Maps & Geolocation:** Leaflet.js with CartoDB/OpenStreetMap Voyager tiles, Overpass API (place query), and Nominatim (geocoding).
- **Backend & Database:** Supabase (PostgreSQL 17, Supabase Auth, Row Level Security, RPC Functions).
- **Database Tools:** Supabase MCP server for inspection, migration execution, and test verification.

---

## 3. Project Structure

```
fdareview/
  index.html            # Page A: Landing and Explore map
  login.html            # Page B: Supabase Auth login
  register.html         # Page C: Demo registration leading to Aditya Thorat
  hotel.html            # Page D & E: Details, reviews list, and review form (+10 coins)
  wallet.html           # Page F & G: Wallet dashboard & simulated redemption
  profile.html          # Page H: User profile & submitted reviews history
  admin.html            # Page I: mitadmin control center (moderation & redemptions)
  assets/
    css/
      variables.css     # CSS Custom Properties (Colors, Radii, Shadows, Typography)
      global.css        # Global resets and base layout
      components.css    # Buttons, Cards, Badges, Modals, Toasts, Form inputs
      pages.css         # Page-specific grids and layouts
      responsive.css    # Responsive breakpoints for tablets and mobile devices
    js/
      config.js         # Centralized configuration & API endpoints
      supabase-client.js# Supabase client instantiation via ESM CDN
      auth.js           # Session handling, roles, and login/logout logic
      navigation.js     # Global navbar & footer renderer
      map.js            # Leaflet map manager & custom markers
      places.js         # Overpass API & Nominatim service
      reviews.js        # Review submission and moderation reports
      wallet.js         # Wallet balance & atomic redemption reservations
      admin.js          # Admin queries for stats, redemptions, and moderation
      ui.js             # Toasts, ratings, formatting, and HTML escaping
      validation.js     # Form and input validation
  supabase/
    migrations/
      20261012000000_init_fdareview.sql # Complete DDL schema & trusted RPCs
    seed.sql            # Repeatable demo account provisioning script
    README.md           # Database setup documentation
  tests/
    test_runner.js      # Automated backend test suite (14/14 tests pass)
  .env.example          # Environment variables template
  .gitignore            # Git exclusion rules
  package.json          # Node project config for test runner
  README.md             # Master documentation
```

---

## 4. Predefined Demo Accounts

The platform is provisioned with exactly four demo accounts, all configured with the demonstration password: `Demo@FDA2026!`

| Username | Role | Initial Coins | Notes |
| :--- | :--- | :--- | :--- |
| **`aditya thorat`** | User | 50 Coins | Default user account; also routed to by Demo Registration. |
| **`mitadmin`** | Admin | 250 Coins | Dedicated administrator with exclusive access to `admin.html`. |
| **`cseproject`** | User | 30 Coins | Demo student project identity. |
| **`demoacc`** | User | 20 Coins | General evaluation user account. |

---

## 5. Database Schema & Trusted RPCs

All tables are protected by PostgreSQL **Row Level Security (RLS)**:
- **`profiles`**: Public read; user update only for permitted display name; role cannot be altered by users.
- **`hotels`**: Mapped from OpenStreetMap (`osm_type` and `osm_id` unique constraint).
- **`reviews`**: One review per user per hotel; atomic reward of 10 coins.
- **`wallets`**: Non-negative balance constraint; updated only through trusted database functions.
- **`coin_transactions`**: Ledger entries for `review_reward`, `redemption_reservation`, `redemption_return`, `admin_adjustment`.
- **`redemptions`**: Simulated redemption requests (`pending`, `approved`, `rejected`).
- **`moderation_actions`**: Audit log of review flags and administrative decisions.

### Core PostgreSQL Functions
1. `get_or_create_hotel`: Associates discovered OSM places with database UUIDs.
2. `submit_review`: Validates rating (1–5) and review length (10–1000 chars), inserts review, awards 10 coins, and logs ledger transaction atomically.
3. `update_review`: Allows editing review text/rating without awarding duplicate coins.
4. `create_redemption`: Checks balance, reserves coins, creates redemption request, and creates transaction record atomically.
5. `process_redemption`: Administrator approval or rejection (which returns reserved coins to the user's wallet).
6. `moderate_review`: Administrative hiding/restoring of reviews with audit logging.
7. `admin_adjust_wallet`: Secure administrator coin adjustments requiring a recorded justification.

---

## 6. How to Run Locally

You can serve the application with any static web server (such as Python's HTTP server or Node `serve`):

```bash
# Using Node http-server (or npx serve)
npx -y serve -p 3000

# OR using Python
python -m http.server 3000
```

Open `http://localhost:3000` in your web browser.

---

## 7. Running the Automated Test Suite

Run the integration test runner to verify database connectivity, authentication, and transactional RPC execution:

```bash
node tests/test_runner.js
```

### Test Results Summary
- **14 / 14 tests PASSED**:
  - Verification of 4 provisioned demo profiles and roles.
  - Supabase Auth sign-in using demo credentials.
  - Establishment upsertion via `get_or_create_hotel`.
  - Atomic review creation and 10-coin reward crediting.
  - Rejection of duplicate review submissions for the same establishment.
  - Atomic coin reservation during simulated redemption requests.
  - Administrator rejection of redemption requests with coin refund.

---

## 8. OpenStreetMap Attribution & Usage Policy

- Map tiles: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (Free standard OSM tile server, no API key required).
- Data API: [Overpass API](https://overpass-api.de/) and [Nominatim](https://nominatim.openstreetmap.org/).
- Overpass queries are throttled with a 25-second timeout and cached client-side to respect rate limits.

---

## 9. Demonstration Notice

FDAReview is an educational demonstration project. FDA Coins represent a simulated in-app reward and possess no real monetary value or actual cash surrender value. No real payment gateways or financial credentials are used.
