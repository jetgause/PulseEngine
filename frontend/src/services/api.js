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

// API Methods
export const getBacktests = async () => {
  return await apiClient.get('/backtests');
};

export const runBacktest = async (data) => {
  return await apiClient.post('/backtests/run', data);
};

export const getPaperPortfolio = async () => {
  return await apiClient.get('/paper-trading/portfolio');
};

export const getPaperTradeHistory = async () => {
  return await apiClient.get('/paper-trading/history');
};

export const submitPaperOrder = async (data) => {
  return await apiClient.post('/paper-trading/orders', data);
};

export const getOptimizationJobs = async () => {
  return await apiClient.get('/optimization/jobs');
};

export const createBacktest = async (data) => {
  return await apiClient.post('/backtests', data);
};

export const getGreeksData = async (params) => {
  return await apiClient.post('/greeks/calculate', params);
};

export const runOptimization = async (data) => {
  return await apiClient.post('/optimization/run', data);
};

export const startOptimization = async (data) => {
  return await apiClient.post('/optimization/start', data);
};

export const calculateGreeks = async (data) => {
  return await apiClient.post('/greeks/calculate', data);
};

export default apiClient
