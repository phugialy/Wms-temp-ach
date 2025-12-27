/**
 * Supabase Configuration
 * No Vite needed - uses direct values or runtime config
 */

export interface SupabaseConfig {
  edgeFunctionUrl: string;
  anonKey: string;
}

/**
 * Get Supabase configuration
 * Can be overridden at runtime via window.__SUPABASE_CONFIG__
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  // Check for runtime config (useful for different environments)
  if (typeof window !== 'undefined' && (window as any).__SUPABASE_CONFIG__) {
    return (window as any).__SUPABASE_CONFIG__;
  }
  
  // Default values - can be changed here or via runtime config
  return {
    edgeFunctionUrl: 'https://yviavhfpvufbgughpwsd.supabase.co/functions/v1',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2aWF2aGZwdnVmYmd1Z2hwd3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3OTE4OTgsImV4cCI6MjA3MTM2Nzg5OH0.G5rb2KMqD95-Wv01AvSricGYn8cqu9vvMYdyHkMht60',
  };
};

// Export singleton config
export const supabaseConfig = getSupabaseConfig();



