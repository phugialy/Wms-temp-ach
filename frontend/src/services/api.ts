import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import type { ApiResponse } from '../types';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000, // Reduced from 30s to 15s for faster failure detection
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Get Supabase session token
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      // If Supabase is not available, continue without token
      console.warn('Could not get Supabase session for API request:', error);
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
      const criticalEndpoints = ['/inventory', '/inventory/stats', '/admin/dashboard', '/workflows'];
      const isCritical = criticalEndpoints.some(endpoint => 
        error.config?.url?.includes(endpoint)
      );
      
      if (isCritical) {
        // Log critical 404s (including workflow endpoints)
        console.error('Critical endpoint not found:', {
          url: error.config?.url,
          status: error.response.status,
          data: error.response.data
        });
      }
      
      return Promise.reject(error);
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
    console.log(`[ApiClient] GET ${url}`, params ? { params } : '');
    try {
      const response = await api.get<ApiResponse<T>>(url, { params });
      console.log(`[ApiClient] GET ${url} - Response:`, {
        status: response.status,
        data: response.data,
      });
      return response.data;
    } catch (error: any) {
      console.error(`[ApiClient] GET ${url} - Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  post: async <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
    console.log(`[ApiClient] POST ${url}`, data ? { data } : '');
    try {
      const response = await api.post<ApiResponse<T>>(url, data);
      console.log(`[ApiClient] POST ${url} - Response:`, {
        status: response.status,
        data: response.data,
      });
      return response.data;
    } catch (error: any) {
      console.error(`[ApiClient] POST ${url} - Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  put: async <T = any>(url: string, data?: any): Promise<ApiResponse<T>> => {
    console.log(`[ApiClient] PUT ${url}`, data ? { data } : '');
    try {
      const response = await api.put<ApiResponse<T>>(url, data);
      console.log(`[ApiClient] PUT ${url} - Response:`, {
        status: response.status,
        data: response.data,
      });
      return response.data;
    } catch (error: any) {
      console.error(`[ApiClient] PUT ${url} - Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },

  delete: async <T = any>(url: string): Promise<ApiResponse<T>> => {
    console.log(`[ApiClient] DELETE ${url}`);
    try {
      const response = await api.delete<ApiResponse<T>>(url);
      console.log(`[ApiClient] DELETE ${url} - Response:`, {
        status: response.status,
        data: response.data,
      });
      return response.data;
    } catch (error: any) {
      console.error(`[ApiClient] DELETE ${url} - Error:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw error;
    }
  },
};

export { api };
export default api;

