-- Run this SQL in your Supabase dashboard SQL Editor
-- (Project Settings → SQL Editor → New Query)
--
-- This function returns the list of identity providers
-- (e.g., "email", "google", "github") for a given email.
-- Used by the auth page to show provider-specific conflict messages.

CREATE OR REPLACE FUNCTION get_identity_providers(input_email text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  providers text[];
BEGIN
  SELECT COALESCE(
    array_agg(DISTINCT i.provider ORDER BY i.provider),
    '{}'::text[]
  )
  INTO providers
  FROM auth.identities i
  WHERE i.email = input_email;

  RETURN providers;
END;
$$;
