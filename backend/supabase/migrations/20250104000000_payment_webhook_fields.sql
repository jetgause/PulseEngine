-- Add missing fields to payments table for webhook integration
-- This migration adds fields needed by the payment webhook

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_subscription_id 
  ON public.payments(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer_id 
  ON public.payments(stripe_customer_id);

-- Update existing NULL paid_at with created_at
UPDATE public.payments 
SET paid_at = created_at 
WHERE paid_at IS NULL AND status = 'completed';
