-- ==============================================================================
-- FDAReview Seed Data
-- ==============================================================================

DO $$
DECLARE
    v_pwd TEXT := 'Demo@FDA2026!';
    v_encrypted_pwd TEXT := crypt(v_pwd, gen_salt('bf'));
    v_u1 UUID := 'a1111111-1111-4111-8111-111111111111';
    v_u2 UUID := 'a2222222-2222-4222-8222-222222222222';
    v_u3 UUID := 'a3333333-3333-4333-8333-333333333333';
    v_u4 UUID := 'a4444444-4444-4444-8444-444444444444';
BEGIN
    -- 1. aditya thorat
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token
    )
    VALUES (
        v_u1, '00000000-0000-0000-0000-000000000000', 'aditya@fdareview.demo',
        v_encrypted_pwd, now(),
        '{"provider":"email","providers":["email"]}',
        '{"username":"aditya thorat","display_name":"Aditya Thorat"}',
        now(), now(), 'authenticated', 'authenticated', '', ''
    ) ON CONFLICT (id) DO UPDATE SET encrypted_password = v_encrypted_pwd;

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        v_u1, v_u1::text, v_u1, jsonb_build_object('sub', v_u1::text, 'email', 'aditya@fdareview.demo'), 'email', now(), now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. mitadmin (ADMIN)
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token
    )
    VALUES (
        v_u2, '00000000-0000-0000-0000-000000000000', 'mitadmin@fdareview.demo',
        v_encrypted_pwd, now(),
        '{"provider":"email","providers":["email"]}',
        '{"username":"mitadmin","display_name":"MIT Admin"}',
        now(), now(), 'authenticated', 'authenticated', '', ''
    ) ON CONFLICT (id) DO UPDATE SET encrypted_password = v_encrypted_pwd;

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        v_u2, v_u2::text, v_u2, jsonb_build_object('sub', v_u2::text, 'email', 'mitadmin@fdareview.demo'), 'email', now(), now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. cseproject
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token
    )
    VALUES (
        v_u3, '00000000-0000-0000-0000-000000000000', 'cseproject@fdareview.demo',
        v_encrypted_pwd, now(),
        '{"provider":"email","providers":["email"]}',
        '{"username":"cseproject","display_name":"CSE Project"}',
        now(), now(), 'authenticated', 'authenticated', '', ''
    ) ON CONFLICT (id) DO UPDATE SET encrypted_password = v_encrypted_pwd;

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        v_u3, v_u3::text, v_u3, jsonb_build_object('sub', v_u3::text, 'email', 'cseproject@fdareview.demo'), 'email', now(), now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    -- 4. demoacc
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        role, aud, confirmation_token, recovery_token
    )
    VALUES (
        v_u4, '00000000-0000-0000-0000-000000000000', 'demoacc@fdareview.demo',
        v_encrypted_pwd, now(),
        '{"provider":"email","providers":["email"]}',
        '{"username":"demoacc","display_name":"Demo Account"}',
        now(), now(), 'authenticated', 'authenticated', '', ''
    ) ON CONFLICT (id) DO UPDATE SET encrypted_password = v_encrypted_pwd;

    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    VALUES (
        v_u4, v_u4::text, v_u4, jsonb_build_object('sub', v_u4::text, 'email', 'demoacc@fdareview.demo'), 'email', now(), now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    -- Provision Profiles
    INSERT INTO public.profiles (id, username, display_name, role)
    VALUES 
        (v_u1, 'aditya thorat', 'Aditya Thorat', 'user'),
        (v_u2, 'mitadmin', 'MIT Admin', 'admin'),
        (v_u3, 'cseproject', 'CSE Project', 'user'),
        (v_u4, 'demoacc', 'Demo Account', 'user')
    ON CONFLICT (id) DO UPDATE 
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role;

    -- Provision Initial Wallets with starter balances
    INSERT INTO public.wallets (user_id, balance_coins)
    VALUES
        (v_u1, 50),
        (v_u2, 250),
        (v_u3, 30),
        (v_u4, 20)
    ON CONFLICT (user_id) DO NOTHING;

    -- Provision Initial Transaction Ledger
    INSERT INTO public.coin_transactions (user_id, amount_coins, transaction_type, description, idempotency_key)
    VALUES
        (v_u1, 50, 'seed_initial', 'Welcome bonus and demo starter coins', 'seed_wallet_' || v_u1::text),
        (v_u2, 250, 'seed_initial', 'Admin demo reserve balance', 'seed_wallet_' || v_u2::text),
        (v_u3, 30, 'seed_initial', 'Welcome bonus and demo starter coins', 'seed_wallet_' || v_u3::text),
        (v_u4, 20, 'seed_initial', 'Welcome bonus and demo starter coins', 'seed_wallet_' || v_u4::text)
    ON CONFLICT (idempotency_key) DO NOTHING;

END $$;
