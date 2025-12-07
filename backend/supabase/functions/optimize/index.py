"""
Supabase Edge Function: Strategy Optimizer API
Endpoint for optimizing trading strategies
"""

import json
from datetime import datetime
from supabase import create_client, Client
import os


def handler(req):
    """Handle strategy optimization requests"""
    
    # Initialize Supabase client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    try:
        body = json.loads(req.body)
        strategy_name = body.get('strategy_name')
        optimization_method = body.get('method', 'grid_search')
        param_grid = body.get('param_grid', {})
        start_date = body.get('start_date')
        end_date = body.get('end_date')
        
        # Create optimization job
        job_data = {
            "strategy_name": strategy_name,
            "method": optimization_method,
            "param_grid": param_grid,
            "start_date": start_date,
            "end_date": end_date,
            "status": "running",
            "created_at": datetime.now().isoformat()
        }
        
        job = supabase.table('optimization_jobs').insert(job_data).execute()
        
        # Return job information (actual optimization would run asynchronously)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "job_id": job.data[0]['id'],
                "status": "running",
                "message": "Optimization job started"
            })
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
