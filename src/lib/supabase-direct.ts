import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];
const directUrl = process.env['DIRECT_URL'];

if (!supabaseUrl || !supabaseApiKey) {
  console.warn('⚠️  Supabase URL or API Key not found in environment variables');
}

// Direct connection client for bulk operations (bypasses pooling)
export const supabaseDirect = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseApiKey || 'placeholder-key',
  {
    db: {
      schema: 'public'
    },
    // Use direct connection if available
    ...(directUrl && {
      db: {
        schema: 'public',
        connectionString: directUrl
      }
    })
  }
);

// Helper function to check if direct connection is available
export const isDirectConnectionAvailable = (): boolean => {
  return !!(directUrl && supabaseUrl && supabaseApiKey);
};

export default supabaseDirect;
