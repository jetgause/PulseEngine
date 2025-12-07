-- Migration: Add idempotency_key and metadata to orders table for broker-order edge function
-- This ensures duplicate order prevention through idempotency

-- Add idempotency_key column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

-- Add metadata column for storing broker-specific response data
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key 
ON public.orders(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN public.orders.idempotency_key IS 
'Client-provided unique key to prevent duplicate order submissions. Should be a UUID or unique string per order attempt.';

COMMENT ON COLUMN public.orders.metadata IS 
'Broker-specific response data and additional order information (filled_qty, filled_avg_price, broker response, etc.).';
