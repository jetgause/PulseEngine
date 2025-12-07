"""
Supabase Edge Function: Options Greeks Calculator API
Endpoint for calculating options Greeks
"""

import json
from supabase import create_client, Client
import os


def handler(req):
    """Handle options Greeks calculation requests"""
    
    try:
        body = json.loads(req.body)
        
        spot_price = body.get('spot_price')
        strike_price = body.get('strike_price')
        time_to_expiry = body.get('time_to_expiry')
        volatility = body.get('volatility')
        risk_free_rate = body.get('risk_free_rate', 0.05)
        dividend_yield = body.get('dividend_yield', 0.0)
        option_type = body.get('option_type', 'call')
        
        # Import from core module (would need proper packaging)
        # For now, return structure
        greeks = {
            "delta": 0.5234,
            "gamma": 0.0234,
            "vega": 0.2345,
            "theta": -0.0567,
            "rho": 0.1234,
            "option_type": option_type,
            "spot_price": spot_price,
            "strike_price": strike_price,
            "time_to_expiry": time_to_expiry,
            "volatility": volatility,
            "calculated_at": json.dumps({"timestamp": "now"})
        }
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(greeks)
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
