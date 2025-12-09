// Common types for the application

export interface User {
  id: string;
  name: string;
  role: 'OPERATOR' | 'ADMIN' | 'MANAGER';
  email?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface Location {
  id: string;
  name: string;
  warehouseId?: string;
  description?: string;
}

export interface DeviceInfo {
  imei: string;
  brand?: string;
  model?: string;
  color?: string;
  capacity?: string;
  condition?: string;
  [key: string]: any;
}

