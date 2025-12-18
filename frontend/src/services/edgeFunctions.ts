/**
 * Supabase Edge Functions Service
 * 
 * This service provides access to Supabase Edge Functions with automatic
 * fallback to Express API routes if Edge Functions are unavailable.
 */

import { supabaseConfig } from '../config/supabase';

const EDGE_FUNCTION_URL = supabaseConfig.edgeFunctionUrl;
const SUPABASE_ANON_KEY = supabaseConfig.anonKey;

interface EdgeFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Call an Edge Function with automatic fallback to Express API
 */
async function callEdgeFunction<T = any>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    params?: Record<string, string | number>;
    fallbackUrl?: string;
  } = {}
): Promise<EdgeFunctionResponse<T>> {
  const { method = 'GET', body, params, fallbackUrl } = options;

  try {
    // Build URL with query parameters
    const url = new URL(`${EDGE_FUNCTION_URL}/${functionName}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Call Edge Function
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Edge Function returned ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Fallback to Express API if Edge Function fails
    if (fallbackUrl) {
      console.warn(`Edge Function ${functionName} failed, falling back to Express API:`, error);
      
      try {
        const fallbackResponse = await fetch(fallbackUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Fallback API returned ${fallbackResponse.status}`);
        }

        const fallbackData = await fallbackResponse.json();
        return fallbackData;
      } catch (fallbackError) {
        console.error(`Both Edge Function and fallback failed for ${functionName}:`, fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Edge Functions API
 */
export const edgeFunctions = {
  /**
   * Get inventory statistics
   */
  getInventoryStats: async () => {
    return callEdgeFunction<{
      total_items: number;
      working_items: number;
      failed_items: number;
      pending_items: number;
      last_hour: number;
      last_day: number;
    }>('inventory-stats', {
      fallbackUrl: '/api/inventory/stats',
    });
  },

  /**
   * Get paginated inventory data
   */
  getInventoryPage: async (limit: number, offset: number, search?: string) => {
    return callEdgeFunction<any[]>('inventory-page', {
      params: {
        limit,
        offset,
        ...(search && { search }),
      },
      fallbackUrl: `/api/inventory?limit=${limit}&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    });
  },

  /**
   * Bulk add items to inventory
   */
  bulkAddItems: async (items: any[], station?: string, location?: string) => {
    return callEdgeFunction('bulk-add-process', {
      method: 'POST',
      body: { items, station, location },
      fallbackUrl: '/api/inventory/bulk-add',
    });
  },
};

export default edgeFunctions;

