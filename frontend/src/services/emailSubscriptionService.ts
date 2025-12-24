import { apiClient } from './api';

export interface EmailSubscription {
  id: string;
  name: string;
  description?: string;
  scheduleIds: string[]; // Array of schedule IDs (empty = all schedules)
  locationFilter?: string;
  emailRecipients: string[]; // Array of email addresses
  deliveryMode: 'immediate' | 'scheduled';
  scheduleTime?: string; // HH:mm format
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  scheduleDays?: number[]; // For weekly: [1,2,3] = Mon, Tue, Wed
  timezone?: string;
  emailOnSuccess: boolean;
  emailOnFailure: boolean;
  summaryOnly: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSentAt?: string | null;
}

export interface CreateEmailSubscriptionParams {
  name: string;
  description?: string;
  scheduleIds?: string[];
  locationFilter?: string;
  emailRecipients: string[];
  deliveryMode: 'immediate' | 'scheduled';
  scheduleTime?: string;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  scheduleDays?: number[];
  timezone?: string;
  emailOnSuccess?: boolean;
  emailOnFailure?: boolean;
  summaryOnly?: boolean;
}

export interface UpdateEmailSubscriptionParams extends Partial<CreateEmailSubscriptionParams> {
  isActive?: boolean;
}

class EmailSubscriptionService {
  /**
   * Get all email subscriptions
   */
  async getAllSubscriptions(activeOnly: boolean = false): Promise<{ success: boolean; data?: EmailSubscription[]; error?: string }> {
    try {
      const response = await apiClient.get<{ success: boolean; data: EmailSubscription[] }>(
        `/email/subscriptions${activeOnly ? '?activeOnly=true' : ''}`
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error getting subscriptions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get a specific subscription by ID
   */
  async getSubscriptionById(id: string): Promise<{ success: boolean; data?: EmailSubscription; error?: string }> {
    try {
      const response = await apiClient.get<{ success: boolean; data: EmailSubscription }>(
        `/email/subscriptions/${id}`
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error getting subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create a new email subscription
   */
  async createSubscription(params: CreateEmailSubscriptionParams): Promise<{ success: boolean; data?: EmailSubscription; error?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; data: EmailSubscription }>(
        '/email/subscriptions',
        params
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error creating subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update an email subscription
   */
  async updateSubscription(id: string, params: UpdateEmailSubscriptionParams): Promise<{ success: boolean; data?: EmailSubscription; error?: string }> {
    try {
      const response = await apiClient.put<{ success: boolean; data: EmailSubscription }>(
        `/email/subscriptions/${id}`,
        params
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error updating subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete an email subscription
   */
  async deleteSubscription(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        `/email/subscriptions/${id}`
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error deleting subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a test email for a subscription
   */
  async sendTestEmail(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>(
        `/email/subscriptions/${id}/test`
      );
      return response;
    } catch (error) {
      console.error('[EmailSubscriptionService] Error sending test email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }
}

export const emailSubscriptionService = new EmailSubscriptionService();

