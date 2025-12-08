-- Add Blockkoin fields to philanthropists table
-- Run this in your Supabase SQL Editor

ALTER TABLE philanthropists 
ADD COLUMN IF NOT EXISTS blockkoin_account_id TEXT,
ADD COLUMN IF NOT EXISTS blockkoin_kyc_status TEXT DEFAULT 'none';

-- Add comment for documentation
COMMENT ON COLUMN philanthropists.blockkoin_account_id IS 'Auto-created Blockkoin account ID for crypto wallet';
COMMENT ON COLUMN philanthropists.blockkoin_kyc_status IS 'KYC status for transactions over $50 (none, pending, verified, rejected)';
