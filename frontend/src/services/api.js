<<<<<<< HEAD
import axios from 'axios'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:54321'
const API_VERSION = 'v1'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response
      
      if (status === 401) {
        // Unauthorized - clear token and notify app
        localStorage.removeItem('access_token')
        // Dispatch custom event for React Router to handle
        window.dispatchEvent(new CustomEvent('auth:logout', { 
          detail: { reason: 'unauthorized' } 
        }))
      }
      
      return Promise.reject({
        status,
        message: data.message || 'An error occurred',
        errors: data.errors || [],
      })
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({
        message: 'No response from server',
        errors: ['Network error or server is down'],
      })
    } else {
      // Something else happened
      return Promise.reject({
        message: error.message || 'An unexpected error occurred',
        errors: [],
      })
    }
  }
)

export default apiClient
=======
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Backtest API
export const runBacktest = async (strategyName, params, startDate, endDate, initialCapital = 100000) => {
  try {
    const { data, error } = await supabase.functions.invoke('backtest', {
      body: {
        strategy_name: strategyName,
        params,
        start_date: startDate,
        end_date: endDate,
        initial_capital: initialCapital
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error running backtest:', error);
    throw error;
  }
};

export const getBacktests = async () => {
  try {
    const { data, error } = await supabase
      .from('backtests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching backtests:', error);
    throw error;
  }
};

// Paper Trading API
export const submitPaperOrder = async (userId, symbol, side, orderType, quantity, price = null) => {
  try {
    const { data, error } = await supabase.functions.invoke('paper-trading', {
      body: {
        action: 'submit_order',
        user_id: userId,
        symbol,
        side,
        order_type: orderType,
        quantity,
        price
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
};

export const getPaperPortfolio = async (userId) => {
  try {
    const { data, error } = await supabase.functions.invoke('paper-trading', {
      body: {
        action: 'get_portfolio',
        user_id: userId
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw error;
  }
};

export const getPaperTradeHistory = async (userId) => {
  try {
    const { data, error } = await supabase.functions.invoke('paper-trading', {
      body: {
        action: 'get_trade_history',
        user_id: userId
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching trade history:', error);
    throw error;
  }
};

// Options Greeks API
export const calculateGreeks = async (spotPrice, strikePrice, timeToExpiry, volatility, riskFreeRate = 0.05, dividendYield = 0.0, optionType = 'call') => {
  try {
    const { data, error } = await supabase.functions.invoke('greeks', {
      body: {
        spot_price: spotPrice,
        strike_price: strikePrice,
        time_to_expiry: timeToExpiry,
        volatility,
        risk_free_rate: riskFreeRate,
        dividend_yield: dividendYield,
        option_type: optionType
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error calculating Greeks:', error);
    throw error;
  }
};

// Optimizer API
export const startOptimization = async (strategyName, method, paramGrid, startDate, endDate) => {
  try {
    const { data, error } = await supabase.functions.invoke('optimize', {
      body: {
        strategy_name: strategyName,
        method,
        param_grid: paramGrid,
        start_date: startDate,
        end_date: endDate
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error starting optimization:', error);
    throw error;
  }
};

export const getOptimizationJobs = async () => {
  try {
    const { data, error } = await supabase
      .from('optimization_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching optimization jobs:', error);
    throw error;
  }
};
>>>>>>> main
