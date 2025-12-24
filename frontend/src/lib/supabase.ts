import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config/supabase';

const config = getSupabaseConfig();
const supabaseUrl = 'https://yviavhfpvufbgughpwsd.supabase.co';
const supabaseAnonKey = config.anonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;

