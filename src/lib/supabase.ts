import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseApiKey = process.env['SUPABASE_API_KEY'];

if (!supabaseUrl || !supabaseApiKey) {
  console.warn('⚠️  Supabase URL or API Key not found in environment variables');
  console.warn('   Client-side Supabase features will be disabled');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseApiKey || 'placeholder-key'
);

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseApiKey);
};

// Real-time subscription helper
export const subscribeToTable = (table: string, callback: (payload: any) => void) => {
  if (!isSupabaseConfigured()) {
    console.warn(`Cannot subscribe to ${table}: Supabase not configured`);
    return null;
  }

  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
};

// Database helper functions
export const supabaseDb = {
  // Items
  async getItems() {
    const { data, error } = await supabase
      .from('Item')
      .select('*')
      .eq('isActive', true);
    
    if (error) throw error;
    return data;
  },

  async getItemById(id: number) {
    const { data, error } = await supabase
      .from('Item')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getItemBySku(sku: string) {
    const { data, error } = await supabase
      .from('Item')
      .select('*')
      .eq('sku', sku)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getItemByImei(imei: string) {
    const { data, error } = await supabase
      .from('Item')
      .select('*')
      .eq('imei', imei)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Inventory
  async getInventory() {
    const { data, error } = await supabase
      .from('Inventory')
      .select(`
        *,
        item:Item(*),
        location:Location(*)
      `);
    
    if (error) throw error;
    return data;
  },

  async getInventoryByLocation(locationId: number) {
    const { data, error } = await supabase
      .from('Inventory')
      .select(`
        *,
        item:Item(*)
      `)
      .eq('locationId', locationId);
    
    if (error) throw error;
    return data;
  },

  // Processing Queue
  async getProcessingQueue(status?: string) {
    let query = supabase
      .from('ProcessingQueue')
      .select(`
        *,
        item:Item(*),
        inboundLog:InboundLog(*)
      `)
      .order('priority', { ascending: false })
      .order('createdAt', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // QC Approvals
  async getQCApprovals(status?: string) {
    let query = supabase
      .from('QCApproval')
      .select(`
        *,
        item:Item(*),
        processingQueue:ProcessingQueue(*)
      `)
      .order('createdAt', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
};

export default supabase;
