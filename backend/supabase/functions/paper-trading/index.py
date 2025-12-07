"""
Supabase Edge Function: Paper Trading API
Endpoint for paper trading operations
"""

import json
from datetime import datetime
from supabase import create_client, Client
import os


def handler(req):
    """Handle paper trading requests"""
    
    # Initialize Supabase client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    try:
        body = json.loads(req.body)
        action = body.get('action')
        
        if action == 'submit_order':
            # Submit a new paper trading order
            order_data = {
                "user_id": body.get('user_id'),
                "symbol": body.get('symbol'),
                "side": body.get('side'),
                "order_type": body.get('order_type'),
                "quantity": body.get('quantity'),
                "price": body.get('price'),
                "status": "pending",
                "created_at": datetime.now().isoformat()
            }
            
            result = supabase.table('paper_orders').insert(order_data).execute()
            
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"order": result.data[0]})
            }
        
        elif action == 'get_portfolio':
            # Get portfolio summary
            user_id = body.get('user_id')
            
            # Get positions
            positions = supabase.table('paper_positions').select('*').eq(
                'user_id', user_id
            ).execute()
            
            # Get account info
            account = supabase.table('paper_accounts').select('*').eq(
                'user_id', user_id
            ).single().execute()
            
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "account": account.data,
                    "positions": positions.data
                })
            }
        
        elif action == 'get_trade_history':
            # Get trade history
            user_id = body.get('user_id')
            
            trades = supabase.table('paper_trades').select('*').eq(
                'user_id', user_id
            ).order('created_at', desc=True).limit(100).execute()
            
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"trades": trades.data})
            }
        
        else:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Invalid action"})
            }
            
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
