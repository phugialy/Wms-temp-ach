import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface ArchiveStats {
  total_archived: number;
  archived_today: number;
  archived_this_week: number;
  archived_this_month: number;
  by_table: Record<string, number>;
}

export interface ArchivedRecord {
  id: number;
  original_table: string;
  original_id: number;
  imei: string;
  archived_data: any;
  archived_at: string;
  archived_by: string;
  archive_reason: string;
}

export interface DataLogRecord {
  id: number;
  queue_id: number;
  imei: string;
  source: string;
  raw_data: any;
  processed_data?: any;
  processing_status: string;
  error_message?: string;
  processing_time_ms: number;
  created_at: string;
  processed_at: string;
}

export class ImeiArchivalService {
  
  /**
   * Manually archive an IMEI and all its related data
   */
  async archiveImei(imei: string, reason: string = 'manual_delete'): Promise<{ archived: number }> {
    try {
      logger.info('Manually archiving IMEI', { imei, reason });
      
      const { data, error } = await supabase
        .rpc('manual_archive_imei', { 
          target_imei: imei, 
          reason: reason 
        });
      
      if (error) {
        logger.error('Error archiving IMEI', { error, imei });
        throw new Error(`Failed to archive IMEI: ${error.message}`);
      }
      
      const archived = Number(data || 0);
      logger.info('IMEI archived successfully', { imei, archived });
      
      return { archived };
      
    } catch (error) {
      logger.error('Error in archiveImei', { error, imei });
      throw error;
    }
  }
  
  /**
   * Get archive statistics
   */
  async getArchiveStats(): Promise<ArchiveStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_archive_stats');
      
      if (error) {
        logger.error('Error getting archive stats', { error });
        throw new Error(`Failed to get archive stats: ${error.message}`);
      }
      
      const stats = data[0];
      return {
        total_archived: Number(stats?.total_archived || 0),
        archived_today: Number(stats?.archived_today || 0),
        archived_this_week: Number(stats?.archived_this_week || 0),
        archived_this_month: Number(stats?.archived_this_month || 0),
        by_table: stats?.by_table || {}
      };
      
    } catch (error) {
      logger.error('Error in getArchiveStats', { error });
      throw error;
    }
  }
  
  /**
   * Get archived records for an IMEI
   */
  async getArchivedRecords(imei: string): Promise<ArchivedRecord[]> {
    try {
      const { data, error } = await supabase
        .from('imei_archived')
        .select('*')
        .eq('imei', imei)
        .order('archived_at', { ascending: false });
      
      if (error) {
        logger.error('Error getting archived records', { error, imei });
        throw new Error(`Failed to get archived records: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('Error in getArchivedRecords', { error, imei });
      throw error;
    }
  }
  
  /**
   * Get all archived records with filters
   */
  async getAllArchivedRecords(
    limit: number = 100, 
    offset: number = 0,
    table?: string,
    reason?: string
  ): Promise<ArchivedRecord[]> {
    try {
      let query = supabase
        .from('imei_archived')
        .select('*')
        .order('archived_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (table) {
        query = query.eq('original_table', table);
      }
      
      if (reason) {
        query = query.eq('archive_reason', reason);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Error getting all archived records', { error });
        throw new Error(`Failed to get archived records: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('Error in getAllArchivedRecords', { error });
      throw error;
    }
  }
  
  /**
   * Restore archived IMEI data
   */
  async restoreArchivedImei(imei: string): Promise<{ restored: number }> {
    try {
      logger.info('Restoring archived IMEI', { imei });
      
      const { data, error } = await supabase
        .rpc('restore_archived_imei', { target_imei: imei });
      
      if (error) {
        logger.error('Error restoring archived IMEI', { error, imei });
        throw new Error(`Failed to restore archived IMEI: ${error.message}`);
      }
      
      const restored = Number(data || 0);
      logger.info('Archived IMEI restored successfully', { imei, restored });
      
      return { restored };
      
    } catch (error) {
      logger.error('Error in restoreArchivedImei', { error, imei });
      throw error;
    }
  }
  
  /**
   * Get data log records
   */
  async getDataLogRecords(
    limit: number = 100, 
    offset: number = 0,
    status?: string,
    source?: string
  ): Promise<DataLogRecord[]> {
    try {
      let query = supabase
        .from('imei_data_log')
        .select('*')
        .order('processed_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (status) {
        query = query.eq('processing_status', status);
      }
      
      if (source) {
        query = query.eq('source', source);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Error getting data log records', { error });
        throw new Error(`Failed to get data log records: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('Error in getDataLogRecords', { error });
      throw error;
    }
  }
  
  /**
   * Get data log statistics
   */
  async getDataLogStats(): Promise<{
    total_logs: number;
    successful_logs: number;
    failed_logs: number;
    average_processing_time: number;
    by_source: Record<string, number>;
    by_status: Record<string, number>;
  }> {
    try {
      // Get total counts
      const { data: totalData, error: totalError } = await supabase
        .from('imei_data_log')
        .select('processing_status, source, processing_time_ms');
      
      if (totalError) {
        logger.error('Error getting data log stats', { error: totalError });
        throw new Error(`Failed to get data log stats: ${totalError.message}`);
      }
      
      const logs = totalData || [];
      const total_logs = logs.length;
      const successful_logs = logs.filter(log => log.processing_status === 'completed').length;
      const failed_logs = logs.filter(log => log.processing_status === 'failed').length;
      
      // Calculate average processing time
      const processingTimes = logs
        .filter(log => log.processing_time_ms)
        .map(log => log.processing_time_ms);
      const average_processing_time = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;
      
      // Group by source
      const by_source: Record<string, number> = {};
      logs.forEach(log => {
        by_source[log.source] = (by_source[log.source] || 0) + 1;
      });
      
      // Group by status
      const by_status: Record<string, number> = {};
      logs.forEach(log => {
        by_status[log.processing_status] = (by_status[log.processing_status] || 0) + 1;
      });
      
      return {
        total_logs,
        successful_logs,
        failed_logs,
        average_processing_time,
        by_source,
        by_status
      };
      
    } catch (error) {
      logger.error('Error in getDataLogStats', { error });
      throw error;
    }
  }
  
  /**
   * Cleanup old queue data (move to log and delete from queue)
   */
  async cleanupOldQueueData(olderThanDays: number = 7): Promise<{ cleaned: number }> {
    try {
      logger.info('Cleaning up old queue data', { olderThanDays });
      
      const { data, error } = await supabase
        .rpc('cleanup_old_queue_data', { older_than_days: olderThanDays });
      
      if (error) {
        logger.error('Error cleaning up old queue data', { error });
        throw new Error(`Failed to cleanup old queue data: ${error.message}`);
      }
      
      const cleaned = Number(data || 0);
      logger.info('Old queue data cleanup completed', { cleaned });
      
      return { cleaned };
      
    } catch (error) {
      logger.error('Error in cleanupOldQueueData', { error });
      throw error;
    }
  }
  
  /**
   * Permanently delete archived records (irreversible)
   */
  async permanentlyDeleteArchived(imei: string): Promise<{ deleted: number }> {
    try {
      logger.info('Permanently deleting archived IMEI', { imei });
      
      const { data, error } = await supabase
        .from('imei_archived')
        .delete()
        .eq('imei', imei)
        .select('id');
      
      if (error) {
        logger.error('Error permanently deleting archived IMEI', { error, imei });
        throw new Error(`Failed to permanently delete archived IMEI: ${error.message}`);
      }
      
      const deleted = data?.length || 0;
      logger.info('Archived IMEI permanently deleted', { imei, deleted });
      
      return { deleted };
      
    } catch (error) {
      logger.error('Error in permanentlyDeleteArchived', { error, imei });
      throw error;
    }
  }
  
  /**
   * Get processing performance metrics
   */
  async getProcessingMetrics(): Promise<{
    total_processed: number;
    success_rate: number;
    average_processing_time: number;
    fastest_processing_time: number;
    slowest_processing_time: number;
    recent_performance: Array<{
      date: string;
      processed: number;
      successful: number;
      failed: number;
      avg_time: number;
    }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('imei_data_log')
        .select('processing_status, processing_time_ms, processed_at')
        .gte('processed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
      
      if (error) {
        logger.error('Error getting processing metrics', { error });
        throw new Error(`Failed to get processing metrics: ${error.message}`);
      }
      
      const logs = data || [];
      const total_processed = logs.length;
      const successful = logs.filter(log => log.processing_status === 'completed').length;
      const success_rate = total_processed > 0 ? (successful / total_processed) * 100 : 0;
      
      const processingTimes = logs
        .filter(log => log.processing_time_ms)
        .map(log => log.processing_time_ms);
      
      const average_processing_time = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;
      const fastest_processing_time = processingTimes.length > 0 ? Math.min(...processingTimes) : 0;
      const slowest_processing_time = processingTimes.length > 0 ? Math.max(...processingTimes) : 0;
      
      // Group by date for recent performance
      const dailyStats: Record<string, any> = {};
      logs.forEach(log => {
        const date = log.processed_at.split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { processed: 0, successful: 0, failed: 0, times: [] };
        }
        dailyStats[date].processed++;
        if (log.processing_status === 'completed') {
          dailyStats[date].successful++;
        } else {
          dailyStats[date].failed++;
        }
        if (log.processing_time_ms) {
          dailyStats[date].times.push(log.processing_time_ms);
        }
      });
      
      const recent_performance = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date,
          processed: stats.processed,
          successful: stats.successful,
          failed: stats.failed,
          avg_time: stats.times.length > 0 ? stats.times.reduce((a: number, b: number) => a + b, 0) / stats.times.length : 0
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7); // Last 7 days
      
      return {
        total_processed,
        success_rate,
        average_processing_time,
        fastest_processing_time,
        slowest_processing_time,
        recent_performance
      };
      
    } catch (error) {
      logger.error('Error in getProcessingMetrics', { error });
      throw error;
    }
  }
}

export default new ImeiArchivalService();
