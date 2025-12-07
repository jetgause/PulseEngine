-- Add profiles table for user metadata and tier management
-- This supports the auth edge function with user registration

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    tier VARCHAR(50) DEFAULT 'free',
    credits INTEGER DEFAULT 100,
    referral_code VARCHAR(50),
    referred_by UUID REFERENCES public.profiles(id),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Service role can insert profiles (used by auth edge function)
CREATE POLICY "Service role can insert profiles"
    ON public.profiles FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to handle new user profile creation via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup (fallback)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add credits tracking table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for credit, negative for debit
    transaction_type VARCHAR(50) NOT NULL, -- signup_bonus, purchase, usage, refund
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS on credit transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit transactions"
    ON public.credit_transactions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Function to add credits
CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type VARCHAR,
    p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Update profile credits
    UPDATE public.profiles
    SET credits = credits + p_amount
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, p_amount, p_transaction_type, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type VARCHAR,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_credits INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO v_current_credits
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    -- Check if user has enough credits
    IF v_current_credits < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Deduct credits
    UPDATE public.profiles
    SET credits = credits - p_amount
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, -p_amount, p_transaction_type, p_description);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add referral tracking
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
    ON public.referrals FOR SELECT
    TO authenticated
    USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Function to process referral
CREATE OR REPLACE FUNCTION public.process_referral(
    p_referred_id UUID,
    p_referral_code VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_referrer_id UUID;
BEGIN
    -- Find referrer by code
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN;
    END IF;

    -- Create referral record
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (v_referrer_id, p_referred_id)
    ON CONFLICT DO NOTHING;

    -- Give bonus to referrer (e.g., 50 credits)
    PERFORM public.add_credits(
        v_referrer_id,
        50,
        'referral_bonus',
        'Referral bonus for inviting a new user'
    );

    -- Give bonus to referred user (e.g., 25 credits)
    PERFORM public.add_credits(
        p_referred_id,
        25,
        'signup_referral',
        'Welcome bonus for using referral code'
    );

    -- Mark reward as given
    UPDATE public.referrals
    SET reward_given = TRUE
    WHERE referrer_id = v_referrer_id AND referred_id = p_referred_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
