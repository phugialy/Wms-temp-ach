import { apiClient } from './api';

/**
 * Cron Schedule Service - Handles scheduled cron job management
 */

export interface CronJobSchedule {
  id: string;
  name: string;
  workflowType: string;
  stations: string[];
  location: string;
  dateRangeDays: number; // How many days back to process (e.g., 1 = yesterday)
  scheduleTime: string; // HH:mm format
  timezone: string;
  frequency: 'daily' | 'weekly';
  weeklyDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  cronExpression?: string;
  isActive: boolean;
  description?: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateCronScheduleParams {
  name: string;
  workflowType?: string;
  stations: string[];
  location: string;
  dateRangeDays?: number;
  scheduleTime: string; // HH:mm
  timezone?: string;
  frequency: 'daily' | 'weekly';
  weeklyDays?: number[];
  description?: string;
}

export interface UpdateCronScheduleParams extends Partial<CreateCronScheduleParams> {
  isActive?: boolean;
}

/**
 * Get all cron schedules
 */
export const getCronSchedules = async (): Promise<CronJobSchedule[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data?: CronJobSchedule[] }>(
      '/workflows/schedules'
    );
    const result = response.data || response;
    if (result.success && result.data) {
      return result.data;
    }
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  } catch (error: any) {
    console.error('Error getting cron schedules:', error);
    return [];
  }
};

/**
 * Create a new cron schedule
 */
export const createCronSchedule = async (
  params: CreateCronScheduleParams
): Promise<{ success: boolean; data?: CronJobSchedule; error?: string }> => {
  try {
    console.log('[CronScheduleService] Creating schedule with params:', params);
    const response = await apiClient.post<{ success: boolean; data?: CronJobSchedule; error?: string }>(
      '/workflows/schedules',
      params
    );
    console.log('[CronScheduleService] Response received:', response);
    const result = response.data || response;
    console.log('[CronScheduleService] Parsed result:', result);
    console.log('[CronScheduleService] Success:', result.success);
    
    if (result.success && result.data) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    return {
      success: false,
      data: result.data,
      error: result.error || 'Unknown error occurred',
    };
  } catch (error: any) {
    console.error('[CronScheduleService] Error creating cron schedule:', error);
    console.error('[CronScheduleService] Error response:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to create cron schedule',
    };
  }
};

/**
 * Update a cron schedule
 */
export const updateCronSchedule = async (
  id: string,
  params: UpdateCronScheduleParams
): Promise<{ success: boolean; data?: CronJobSchedule; error?: string }> => {
  try {
    const response = await apiClient.put<{ success: boolean; data?: CronJobSchedule; error?: string }>(
      `/workflows/schedules/${id}`,
      params
    );
    const result = response.data || response;
    return {
      success: result.success || false,
      data: result.data,
      error: result.error,
    };
  } catch (error: any) {
    console.error('Error updating cron schedule:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update cron schedule',
    };
  }
};

/**
 * Delete a cron schedule
 */
export const deleteCronSchedule = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await apiClient.delete<{ success: boolean; error?: string }>(
      `/workflows/schedules/${id}`
    );
    const result = response.data || response;
    return {
      success: result.success || false,
      error: result.error,
    };
  } catch (error: any) {
    console.error('Error deleting cron schedule:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete cron schedule',
    };
  }
};

/**
 * Toggle cron schedule active status
 */
export const toggleCronSchedule = async (
  id: string,
  isActive: boolean
): Promise<{ success: boolean; data?: CronJobSchedule; error?: string }> => {
  return updateCronSchedule(id, { isActive });
};

export const cronScheduleService = {
  getCronSchedules,
  createCronSchedule,
  updateCronSchedule,
  deleteCronSchedule,
  toggleCronSchedule,
};

export default cronScheduleService;

