-- Add RPC function to increment API call count
CREATE OR REPLACE FUNCTION increment_api_calls(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update usage metrics for today
  INSERT INTO usage_metrics (user_id, date, api_calls)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    api_calls = usage_metrics.api_calls + 1,
    updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_api_calls(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION increment_api_calls IS 'Increments API call count for a user on the current date';
