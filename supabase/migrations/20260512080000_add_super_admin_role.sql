-- Add the new super_admin tier to the user_role enum. Postgres 12+
-- allows using a newly-added enum value in the same transaction, which
-- Supabase satisfies.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
