import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import type { ApiResponse } from '../types';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    
    // Suppress 404 errors in console for non-critical endpoints
    // (reduce noise from old HTML pages and missing optional endpoints)
    if (error.response?.status === 404) {
      // Only log 404s for critical endpoints
      const criticalEndpoints = ['/inventory', '/inventory/stats', '/admin/dashboard'];
      const isCritical = criticalEndpoints.some(endpoint => 
        error.config?.url?.includes(endpoint)
      );
      
      if (!isCritical) {
        // Don't log non-critical 404s
        return Promise.reject(error);
      }
    }
    
    // Log server errors (500+)
    if (error.response?.status && error.response.status >= 500) {
      console.error('Server error:', {
        status: error.response.status,
        url: error.config?.url,
        data: error.response.data
      });
    }
    
    // Log network errors
    if (!error.response) {
      console.error('Network error:', {
        message: error.message,
        url: error.config?.url
      });
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const apiClient = {
  get: async <T = any>(url: string, params?: any): Promise<ApiResponse<T>> => {
    const response = await api.get<ApiResponse<T>>(url, { params });
    return response.data;
  },

  post: async <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
    const response = await api.post<ApiResponse<T>>(url, data);
    return response.data;
  },

  put: async <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
    const response = await api.put<ApiResponse<T>>(url, data);
    return response.data;
  },

  delete: async <T = any>(url: string): Promise<ApiResponse<T>> => {
    const response = await api.delete<ApiResponse<T>>(url);
    return response.data;
  },
};

export { api };
export default api;

