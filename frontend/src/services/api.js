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
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('access_token')
        window.location.href = '/login'
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
