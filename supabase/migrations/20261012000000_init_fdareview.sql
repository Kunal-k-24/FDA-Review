-- ==============================================================================
-- FDAReview Database Schema Migration
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. HOTELS / ESTABLISHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    osm_type TEXT,
    osm_id TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'restaurant',
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_osm_place UNIQUE (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS idx_hotels_osm ON public.hotels(osm_type, osm_id);
CREATE INDEX IF NOT EXISTS idx_hotels_location ON public.hotels(latitude, longitude);

-- 3. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL CHECK (char_length(trim(review_text)) >= 10 AND char_length(review_text) <= 1000),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_hotel_review UNIQUE (user_id, hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_hotel ON public.reviews(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);

-- 4. WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance_coins BIGINT NOT NULL DEFAULT 0 CHECK (balance_coins >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. REDEMPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requested_coins BIGINT NOT NULL CHECK (requested_coins > 0),
    illustrative_amount_inr NUMERIC(10, 2) NOT NULL CHECK (illustrative_amount_inr > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    admin_note TEXT,
    processed_by UUID REFERENCES public.profiles(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user ON public.redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.redemptions(status);

-- 6. COIN TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_coins BIGINT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('review_reward', 'redemption_reservation', 'redemption_return', 'admin_adjustment', 'seed_initial')),
    description TEXT NOT NULL,
    review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
    redemption_id UUID REFERENCES public.redemptions(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.coin_transactions(user_id);

-- 7. MODERATION REPORTS / ACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('flagged', 'hidden', 'restored', 'dismissed')),
    reason TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_moderation_review ON public.moderation_actions(review_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own display_name only" ON public.profiles;
CREATE POLICY "Users can update own display_name only"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- HOTELS POLICIES
DROP POLICY IF EXISTS "Hotels are viewable by everyone" ON public.hotels;
CREATE POLICY "Hotels are viewable by everyone"
    ON public.hotels FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert hotels" ON public.hotels;
CREATE POLICY "Authenticated users can insert hotels"
    ON public.hotels FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- REVIEWS POLICIES
DROP POLICY IF EXISTS "Reviews are viewable by everyone unless hidden" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone unless hidden"
    ON public.reviews FOR SELECT
    USING (is_hidden = false OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- WALLETS POLICIES
DROP POLICY IF EXISTS "Users can view own wallet or admin" ON public.wallets;
CREATE POLICY "Users can view own wallet or admin"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- COIN TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Users can view own transactions or admin" ON public.coin_transactions;
CREATE POLICY "Users can view own transactions or admin"
    ON public.coin_transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- REDEMPTIONS POLICIES
DROP POLICY IF EXISTS "Users can view own redemptions or admin" ON public.redemptions;
CREATE POLICY "Users can view own redemptions or admin"
    ON public.redemptions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- MODERATION ACTIONS POLICIES
DROP POLICY IF EXISTS "Moderation viewable by admin" ON public.moderation_actions;
CREATE POLICY "Moderation viewable by admin"
    ON public.moderation_actions FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can flag reviews or admin can moderate" ON public.moderation_actions;
CREATE POLICY "Users can flag reviews or admin can moderate"
    ON public.moderation_actions FOR INSERT
    WITH CHECK (auth.uid() = performed_by);

-- ==============================================================================
-- TRUSTED DATABASE FUNCTIONS (RPCs)
-- ==============================================================================

-- 1. UPSERT HOTEL BY OSM ID
CREATE OR REPLACE FUNCTION public.get_or_create_hotel(
    p_osm_type TEXT,
    p_osm_id TEXT,
    p_name TEXT,
    p_category TEXT,
    p_address TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS UUID AS $$
DECLARE
    v_hotel_id UUID;
BEGIN
    SELECT id INTO v_hotel_id
    FROM public.hotels
    WHERE osm_type = p_osm_type AND osm_id = p_osm_id;

    IF v_hotel_id IS NULL THEN
        INSERT INTO public.hotels (osm_type, osm_id, name, category, address, latitude, longitude)
        VALUES (p_osm_type, p_osm_id, p_name, COALESCE(p_category, 'place'), p_address, p_latitude, p_longitude)
        ON CONFLICT (osm_type, osm_id) DO UPDATE
            SET name = EXCLUDED.name,
                address = COALESCE(EXCLUDED.address, public.hotels.address)
        RETURNING id INTO v_hotel_id;
    END IF;

    RETURN v_hotel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. CREATE REVIEW AND AWARD 10 COINS ATOMICALLY
CREATE OR REPLACE FUNCTION public.submit_review(
    p_hotel_id UUID,
    p_rating INTEGER,
    p_review_text TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_existing_review_id UUID;
    v_review_id UUID;
    v_trimmed_text TEXT := trim(p_review_text);
    v_reward_amount BIGINT := 10;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    IF char_length(v_trimmed_text) < 10 OR char_length(v_trimmed_text) > 1000 THEN
        RAISE EXCEPTION 'Review text must be between 10 and 1000 characters';
    END IF;

    -- Check if user already reviewed this hotel
    SELECT id INTO v_existing_review_id
    FROM public.reviews
    WHERE user_id = v_user_id AND hotel_id = p_hotel_id;

    IF v_existing_review_id IS NOT NULL THEN
        RAISE EXCEPTION 'Review already exists for this establishment. Please edit your existing review instead.';
    END IF;

    -- Insert Review
    INSERT INTO public.reviews (user_id, hotel_id, rating, review_text)
    VALUES (v_user_id, p_hotel_id, p_rating, v_trimmed_text)
    RETURNING id INTO v_review_id;

    -- Update or Insert Wallet Balance
    INSERT INTO public.wallets (user_id, balance_coins, updated_at)
    VALUES (v_user_id, v_reward_amount, timezone('utc'::text, now()))
    ON CONFLICT (user_id) DO UPDATE
    SET balance_coins = public.wallets.balance_coins + v_reward_amount,
        updated_at = timezone('utc'::text, now());

    -- Create Ledger Transaction
    INSERT INTO public.coin_transactions (
        user_id,
        amount_coins,
        transaction_type,
        description,
        review_id,
        idempotency_key
    )
    VALUES (
        v_user_id,
        v_reward_amount,
        'review_reward',
        'Earned 10 FDA Coins for reviewing an establishment',
        v_review_id,
        'review_reward_' || v_review_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'review_id', v_review_id,
        'coins_awarded', v_reward_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. EDIT REVIEW (NO EXTRA REWARD)
CREATE OR REPLACE FUNCTION public.update_review(
    p_review_id UUID,
    p_rating INTEGER,
    p_review_text TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_trimmed_text TEXT := trim(p_review_text);
    v_owner_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    IF char_length(v_trimmed_text) < 10 OR char_length(v_trimmed_text) > 1000 THEN
        RAISE EXCEPTION 'Review text must be between 10 and 1000 characters';
    END IF;

    SELECT user_id INTO v_owner_id
    FROM public.reviews
    WHERE id = p_review_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF v_owner_id != v_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to edit this review';
    END IF;

    UPDATE public.reviews
    SET rating = p_rating,
        review_text = v_trimmed_text,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_review_id;

    RETURN jsonb_build_object('success', true, 'review_id', p_review_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. CREATE REDEMPTION (RESERVES COINS ATOMICALLY)
CREATE OR REPLACE FUNCTION public.create_redemption(
    p_requested_coins BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_balance BIGINT;
    v_inr_amount NUMERIC(10, 2);
    v_redemption_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_requested_coins <= 0 THEN
        RAISE EXCEPTION 'Redemption amount must be greater than zero';
    END IF;

    -- Lock wallet row for update
    SELECT balance_coins INTO v_balance
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_requested_coins THEN
        RAISE EXCEPTION 'Insufficient FDA Coins balance';
    END IF;

    -- Rate: 1000 coins = 10 INR => 100 coins = 1 INR => inr = coins / 100.0
    v_inr_amount := ROUND((p_requested_coins::numeric / 100.0), 2);

    -- Insert Redemption
    INSERT INTO public.redemptions (user_id, requested_coins, illustrative_amount_inr, status)
    VALUES (v_user_id, p_requested_coins, v_inr_amount, 'pending')
    RETURNING id INTO v_redemption_id;

    -- Deduct/Reserve from wallet
    UPDATE public.wallets
    SET balance_coins = balance_coins - p_requested_coins,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = v_user_id;

    -- Add ledger entry
    INSERT INTO public.coin_transactions (
        user_id,
        amount_coins,
        transaction_type,
        description,
        redemption_id,
        idempotency_key
    )
    VALUES (
        v_user_id,
        -p_requested_coins,
        'redemption_reservation',
        'Reserved ' || p_requested_coins::text || ' FDA Coins for simulated redemption (₹' || v_inr_amount::text || ')',
        v_redemption_id,
        'redemption_reserve_' || v_redemption_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'redemption_id', v_redemption_id,
        'reserved_coins', p_requested_coins,
        'illustrative_inr', v_inr_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. PROCESS REDEMPTION (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.process_redemption(
    p_redemption_id UUID,
    p_decision TEXT, -- 'approved' or 'rejected'
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_redemption RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can process redemption requests';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected';
    END IF;

    SELECT * INTO v_redemption
    FROM public.redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;

    IF v_redemption.id IS NULL THEN
        RAISE EXCEPTION 'Redemption request not found';
    END IF;

    IF v_redemption.status != 'pending' THEN
        RAISE EXCEPTION 'Request has already been processed with status %', v_redemption.status;
    END IF;

    IF p_decision = 'approved' THEN
        UPDATE public.redemptions
        SET status = 'approved',
            admin_note = p_admin_note,
            processed_by = v_admin_id,
            processed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_redemption_id;

        RETURN jsonb_build_object('success', true, 'status', 'approved');
    ELSE
        -- Rejected: Return reserved coins to wallet
        UPDATE public.wallets
        SET balance_coins = balance_coins + v_redemption.requested_coins,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = v_redemption.user_id;

        -- Record return in transactions
        INSERT INTO public.coin_transactions (
            user_id,
            amount_coins,
            transaction_type,
            description,
            redemption_id,
            idempotency_key,
            created_by
        )
        VALUES (
            v_redemption.user_id,
            v_redemption.requested_coins,
            'redemption_return',
            'Returned ' || v_redemption.requested_coins::text || ' FDA Coins (Redemption rejected by admin)',
            p_redemption_id,
            'redemption_return_' || p_redemption_id::text,
            v_admin_id
        );

        UPDATE public.redemptions
        SET status = 'rejected',
            admin_note = p_admin_note,
            processed_by = v_admin_id,
            processed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_redemption_id;

        RETURN jsonb_build_object('success', true, 'status', 'rejected', 'returned_coins', v_redemption.requested_coins);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. MODERATE REVIEW (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.moderate_review(
    p_review_id UUID,
    p_action TEXT, -- 'hidden', 'restored'
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_is_hidden BOOLEAN;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can moderate reviews';
    END IF;

    IF p_action = 'hidden' THEN
        v_is_hidden := true;
    ELSIF p_action = 'restored' THEN
        v_is_hidden := false;
    ELSE
        RAISE EXCEPTION 'Action must be hidden or restored';
    END IF;

    UPDATE public.reviews
    SET is_hidden = v_is_hidden,
        moderation_reason = p_reason,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_review_id;

    INSERT INTO public.moderation_actions (review_id, action, reason, performed_by)
    VALUES (p_review_id, p_action, p_reason, v_admin_id);

    RETURN jsonb_build_object('success', true, 'is_hidden', v_is_hidden);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. ADMIN ADJUST WALLET
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
    p_target_user_id UUID,
    p_amount_coins BIGINT,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_new_balance BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can adjust balances';
    END IF;

    IF trim(p_reason) = '' OR p_reason IS NULL THEN
        RAISE EXCEPTION 'Adjustment reason is required';
    END IF;

    INSERT INTO public.wallets (user_id, balance_coins, updated_at)
    VALUES (p_target_user_id, GREATEST(0, p_amount_coins), timezone('utc'::text, now()))
    ON CONFLICT (user_id) DO UPDATE
    SET balance_coins = GREATEST(0, public.wallets.balance_coins + p_amount_coins),
        updated_at = timezone('utc'::text, now())
    RETURNING balance_coins INTO v_new_balance;

    INSERT INTO public.coin_transactions (
        user_id,
        amount_coins,
        transaction_type,
        description,
        created_by
    )
    VALUES (
        p_target_user_id,
        p_amount_coins,
        'admin_adjustment',
        'Admin adjustment: ' || p_reason,
        v_admin_id
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
