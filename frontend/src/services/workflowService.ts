import { apiClient } from './api';

/**
 * Workflow Service - Handles all cron job/workflow API calls
 * Replicates backend cron-job functionality in the frontend
 */

export interface BulkAddWorkflowParams {
  stations: string[];
  dateFrom: string; // ISO date string (YYYY-MM-DD)
  dateTo: string; // ISO date string (YYYY-MM-DD)
  location: string;
  triggerSource?: 'vercel-cron' | 'manual' | 'api' | 'manual-retry';
}

export interface CronJobExecution {
  id: string;
  workflowType: string;
  triggerSource: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduleId?: string | null;
  scheduleName?: string | null;
  scheduleTime?: string | null;
  scheduleFrequency?: string | null;
  stations: string[];
  dateFrom: string | null;
  dateTo: string | null;
  location: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  devicesFound: number;
  devicesProcessed: number;
  devicesAdded: number;
  devicesFailed: number;
  errorMessage: string | null;
  errorDetails?: any;
  metadata?: {
    devices?: DeviceInfo[];
    totalDevices?: number;
    workflowVersion?: string;
    stations?: string[];
    dateRange?: {
      from: string;
      to: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInfo {
  imei: string;
  station: string;
  model: string;
  brand: string;
  capacity: string;
  color: string;
  carrier: string;
  processedAt: string;
}

export interface WorkflowStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  totals: {
    daily: {
      devicesFound: number;
      devicesAdded: number;
      durationMs: number;
    };
    weekly: {
      devicesFound: number;
      devicesAdded: number;
      durationMs: number;
    };
    monthly: {
      devicesFound: number;
      devicesAdded: number;
      durationMs: number;
    };
  };
  // Deprecated: kept for backward compatibility
  averages?: {
    devicesFound: number;
    devicesAdded: number;
    durationMs: number;
  };
}

export interface StationStats {
  station: string;
  totalDevicesAdded: number;
  totalDevicesFound: number;
  totalDevicesProcessed: number;
  totalDevicesFailed: number;
  executionCount: number;
  executions: Array<{
    executionId: string;
    devicesAdded: number;
    devicesFound: number;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface ExecutionDevicesResponse {
  devices: DeviceInfo[];
  total: number;
  shown: number;
  executionId: string;
}

export interface ExecutionHistoryResponse {
  success: boolean;
  data: CronJobExecution[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Execute bulk-add workflow (manual trigger)
 */
export const executeBulkAddWorkflow = async (
  params: BulkAddWorkflowParams
): Promise<{ success: boolean; executionId?: string; message?: string; error?: string }> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      executionId?: string;
      status?: string;
      message?: string;
      error?: string;
      data?: any;
    }>('/workflows/bulk-add', {
      stations: params.stations,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      location: params.location,
      triggerSource: params.triggerSource || 'manual',
    });

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    return {
      success: result.success || false,
      executionId: result.executionId || result.data?.executionId,
      message: result.message || result.data?.message,
      error: result.error || result.data?.error,
    };
  } catch (error: any) {
    console.error('Error executing bulk-add workflow:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to execute workflow',
    };
  }
};

/**
 * Get workflow execution history with optional date filtering
 */
export const getExecutionHistory = async (
  limit: number = 50,
  offset: number = 0,
  dateFrom?: string,
  dateTo?: string
): Promise<CronJobExecution[]> => {
  try {
    console.log('[WorkflowService] getExecutionHistory called with:', { limit, offset, dateFrom, dateTo });
    console.log('[WorkflowService] Calling apiClient.get("/workflows/executions")...');
    
    const params: any = { limit, offset };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    
    const response = await apiClient.get<ExecutionHistoryResponse>('/workflows/executions', params);

    console.log('[WorkflowService] Received response:', response);

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    console.log('[WorkflowService] Processed result:', result);
    
    if (result.success && result.data) {
      const executions = Array.isArray(result.data) ? result.data : [];
      console.log(`[WorkflowService] Returning ${executions.length} executions`);
      return executions;
    }
    // Fallback: if response is already an array (direct data)
    if (Array.isArray(result)) {
      console.log(`[WorkflowService] Result is array, returning ${result.length} items`);
      return result;
    }
    console.warn('[WorkflowService] No valid data found in response, returning empty array');
    return [];
  } catch (error: any) {
    console.error('[WorkflowService] Error getting execution history:', error);
    console.error('[WorkflowService] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    return [];
  }
};

/**
 * Get specific execution details by ID
 */
export const getExecutionById = async (id: string): Promise<CronJobExecution | null> => {
  try {
    const response = await apiClient.get<{ success: boolean; data?: CronJobExecution }>(
      `/workflows/executions/${id}`
    );

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    if (result.success && result.data) {
      return result.data;
    }
    // Fallback: if response is already the execution object
    if (result.id) {
      return result as CronJobExecution;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting execution details:', error);
    return null;
  }
};

/**
 * Get devices processed in a specific execution
 */
export const getExecutionDevices = async (
  executionId: string
): Promise<ExecutionDevicesResponse | null> => {
  try {
    const response = await apiClient.get<{
      success: boolean;
      data?: ExecutionDevicesResponse;
    }>(`/workflows/executions/${executionId}/devices`);

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    if (result.success && result.data) {
      return result.data;
    }
    // Fallback: if response is already the devices response object
    if (result.devices) {
      return result as ExecutionDevicesResponse;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting execution devices:', error);
    return null;
  }
};

/**
 * Get workflow execution statistics
 */
export const getWorkflowStats = async (): Promise<WorkflowStats | null> => {
  try {
    console.log('[WorkflowService] getWorkflowStats called');
    console.log('[WorkflowService] Calling apiClient.get("/workflows/stats")...');
    
    const response = await apiClient.get<{ success: boolean; data?: WorkflowStats }>(
      '/workflows/stats'
    );

    console.log('[WorkflowService] Received stats response:', response);

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    console.log('[WorkflowService] Processed stats result:', result);
    
    if (result.success && result.data) {
      console.log('[WorkflowService] Returning stats data');
      return result.data;
    }
    // Fallback: if response is already the stats object
    if (result.total !== undefined) {
      console.log('[WorkflowService] Result is stats object, returning directly');
      return result as WorkflowStats;
    }
    console.warn('[WorkflowService] No valid stats data found, returning null');
    return null;
  } catch (error: any) {
    console.error('[WorkflowService] Error getting workflow stats:', error);
    console.error('[WorkflowService] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    return null;
  }
};

/**
 * Get device statistics grouped by station/worker
 */
export const getStationStats = async (
  dateFrom?: string,
  dateTo?: string
): Promise<{ stations: StationStats[]; total: number; dateRange: { from: string | null; to: string | null } } | null> => {
  try {
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const response = await apiClient.get<{
      success: boolean;
      data?: {
        stations: StationStats[];
        total: number;
        dateRange: { from: string | null; to: string | null };
      };
    }>('/workflows/stations/stats', params);

    // Handle both direct response and wrapped ApiResponse format
    const result = response.data || response;
    
    if (result.success && result.data) {
      return result.data;
    }
    // Fallback: if response is already the stats object
    if (result.stations) {
      return result as { stations: StationStats[]; total: number; dateRange: { from: string | null; to: string | null } };
    }
    return null;
  } catch (error: any) {
    console.error('Error getting station stats:', error);
    return null;
  }
};

/**
 * Workflow Service - Centralized export
 */
export const workflowService = {
  executeBulkAddWorkflow,
  getExecutionHistory,
  getExecutionById,
  getExecutionDevices,
  getWorkflowStats,
  getStationStats,
};

export default workflowService;

