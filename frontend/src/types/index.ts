/**
 * Common API response types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * User type for authentication
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  role: 'OPERATOR' | 'ADMIN' | 'MANAGER';
  is_verified?: boolean;
  is_active?: boolean;
}
