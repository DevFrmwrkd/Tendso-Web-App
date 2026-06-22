-- Fix existing Google OAuth users with wrong status

-- Update all Google OAuth users (password_hash = 'oauth_google') to active status
UPDATE creators 
SET status = 'active', updated_at = NOW()
WHERE password_hash = 'oauth_google' 
  AND status != 'active';

-- Check the results
SELECT id, name, email, status, password_hash 
FROM creators 
WHERE password_hash = 'oauth_google';
