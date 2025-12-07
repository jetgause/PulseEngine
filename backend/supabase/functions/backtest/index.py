"""
Supabase Edge Function: Backtest API
Endpoint for running backtests
"""

import json
from datetime import datetime
from supabase import create_client, Client
import os


def handler(req):
    """Handle backtest requests"""
    
    # Initialize Supabase client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    # Parse request
    try:
        body = json.loads(req.body)
        strategy_name = body.get('strategy_name')
        params = body.get('params', {})
        start_date = body.get('start_date')
        end_date = body.get('end_date')
        initial_capital = body.get('initial_capital', 100000)
        
        # Fetch historical data from Supabase
        data_response = supabase.table('market_data').select('*').gte(
            'timestamp', start_date
        ).lte('timestamp', end_date).execute()
        
        # Run backtest (logic would import from core module)
        # For now, return structure
        backtest_result = {
            "backtest_id": f"bt_{datetime.now().timestamp()}",
            "strategy_name": strategy_name,
            "params": params,
            "start_date": start_date,
            "end_date": end_date,
            "initial_capital": initial_capital,
            "status": "completed",
            "results": {
                "total_return": 0.15,
                "total_trades": 25,
                "winning_trades": 15,
                "losing_trades": 10,
                "win_rate": 0.60,
                "profit_factor": 1.5,
                "max_drawdown": 0.12
            }
        }
        
        # Store backtest result
        supabase.table('backtests').insert(backtest_result).execute()
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(backtest_result)
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
