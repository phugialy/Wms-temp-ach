const { google } = require('googleapis');
const { Client } = require('pg');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    // Google Sheets configuration
    this.spreadsheetId = '18Zo9Z9n7D6j0dzYpPTj9_zgrg0poNFJ5rU5iss593qo';
    this.sheets = google.sheets({ version: 'v4' });
    
    // Initialize auth based on available credentials
    if (process.env.GOOGLE_API_KEY) {
      // Use API key (simpler for read-only access)
      this.useApiKey = true;
      this.apiKey = process.env.GOOGLE_API_KEY;
      console.log('🔑 Using Google API Key authentication');
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Use service account JSON from environment variable
      this.useApiKey = false;
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('🔐 Using Google Service Account JSON authentication');
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Use service account key file path
      this.useApiKey = false;
      this.auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('📁 Using Google Service Account Key file authentication');
    } else {
      console.error('❌ No Google authentication configured');
      console.error('Available environment variables:', {
        GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
        GOOGLE_SERVICE_ACCOUNT_JSON: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      });
      throw new Error('No Google authentication configured. Please set GOOGLE_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_KEY in your .env file');
    }
  }

  // Create a new database client for each operation
  createClient() {
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  // Get all sheet names from the spreadsheet
  async getSheetNames() {
    try {
      let requestOptions = {
        spreadsheetId: this.spreadsheetId
      };

      if (this.useApiKey) {
        // For API key, add it as a query parameter
        requestOptions.key = this.apiKey;
      } else {
        // For service accounts, use auth client
        const auth = await this.auth.getClient();
        requestOptions.auth = auth;
      }
      
      const response = await this.sheets.spreadsheets.get(requestOptions);
      return response.data.sheets.map(sheet => sheet.properties.title);
    } catch (error) {
      console.error('❌ Error getting sheet names:', error);
      throw error;
    }
  }

  // Read data from a specific sheet
  async readSheetData(sheetName, range = 'A:Z') {
    try {
      let requestOptions = {
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`
      };

      if (this.useApiKey) {
        // For API key, add it as a query parameter
        requestOptions.key = this.apiKey;
      } else {
        // For service accounts, use auth client
        const auth = await this.auth.getClient();
        requestOptions.auth = auth;
      }
      
      const response = await this.sheets.spreadsheets.values.get(requestOptions);
      return response.data.values || [];
    } catch (error) {
      console.error(`❌ Error reading sheet ${sheetName}:`, error);
      throw error;
    }
  }

  // Parse SKU data from sheet rows
  parseSkuData(rows, sheetName) {
    if (!rows || rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const skus = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      try {
        const skuCode = row[headers.indexOf('sku')] || row[0] || '';
        const productDescription = row[headers.indexOf('product description')] || '';
        
        // Parse product description to extract device information
        const parsedInfo = this.parseProductDescription(productDescription, skuCode, sheetName);
        
        const skuData = {
          sku_code: skuCode,
          brand: parsedInfo.brand,
          model: parsedInfo.model,
          capacity: parsedInfo.capacity,
          color: parsedInfo.color,
          carrier: parsedInfo.carrier,
          post_fix: row[headers.indexOf('post_fix')] || row[headers.indexOf('postfix')] || '',
          is_unlocked: (row[headers.indexOf('unlocked')] || '').toLowerCase() === 'true',
          source_tab: sheetName,
          sheet_row_id: i + 1
        };
        
        // Only add if we have a valid SKU code
        if (skuData.sku_code && skuData.sku_code.trim()) {
          skus.push(skuData);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing row ${i + 1} in sheet ${sheetName}:`, error);
      }
    }
    
    return skus;
  }

  // Parse product description to extract device information
  parseProductDescription(description, skuCode, sheetName) {
    const desc = (description || '').toLowerCase();
    const sku = (skuCode || '').toUpperCase();
    
    let brand = '';
    let model = '';
    let capacity = '';
    let color = '';
    let carrier = '';
    
    // Determine brand based on sheet name and description
    if (sheetName.includes('APPLE') || desc.includes('apple') || desc.includes('iphone') || desc.includes('ipad')) {
      brand = 'Apple';
    } else if (sheetName.includes('SAMSUNG') || sheetName.includes('ZFLIP') || sheetName.includes('FOLD') || desc.includes('samsung') || desc.includes('galaxy')) {
      brand = 'Samsung';
    } else if (sheetName.includes('PIXEL') || desc.includes('pixel')) {
      brand = 'Google';
    } else {
      brand = 'Unknown';
    }
    
    // Extract capacity (look for GB/TB patterns)
    const capacityMatch = desc.match(/(\d+)\s*(gb|tb)/i) || sku.match(/(\d+)(GB|TB)/);
    if (capacityMatch) {
      capacity = `${capacityMatch[1]}${capacityMatch[2].toUpperCase()}`;
    }
    
    // Extract color (common colors)
    const colors = ['black', 'white', 'silver', 'gold', 'pink', 'blue', 'green', 'red', 'purple', 'yellow', 'orange', 'gray', 'grey'];
    for (const colorName of colors) {
      if (desc.includes(colorName)) {
        color = colorName.charAt(0).toUpperCase() + colorName.slice(1);
        break;
      }
    }
    
    // Extract carrier/connectivity
    if (desc.includes('wifi') || desc.includes('wi-fi')) {
      carrier = 'WIFI';
    } else if (desc.includes('4g')) {
      carrier = '4G';
    } else if (desc.includes('5g')) {
      carrier = '5G';
    } else if (desc.includes('unlocked')) {
      carrier = 'UNLOCKED';
    }
    
    // Extract model from description or SKU
    if (desc.includes('iphone')) {
      const iphoneMatch = desc.match(/iphone\s*(\d+)/i) || sku.match(/IP-(\d+)/);
      if (iphoneMatch) {
        model = `iPhone ${iphoneMatch[1]}`;
      }
    } else if (desc.includes('ipad')) {
      const ipadMatch = desc.match(/ipad\s*(pro|air|mini)?/i);
      if (ipadMatch) {
        model = `iPad ${ipadMatch[1] || ''}`.trim();
      }
    } else if (desc.includes('pixel')) {
      const pixelMatch = desc.match(/pixel\s*(\d+[a-z]?)/i) || sku.match(/PIXEL-(\d+[A-Z]?)/);
      if (pixelMatch) {
        model = `Pixel ${pixelMatch[1]}`;
      }
    } else if (desc.includes('galaxy') || desc.includes('fold') || desc.includes('flip')) {
      const samsungMatch = desc.match(/(galaxy\s+\w+|fold\s*\d+|flip\s*\d+)/i);
      if (samsungMatch) {
        model = samsungMatch[1];
      }
    }
    
    return { brand, model, capacity, color, carrier };
  }

  // Sync all SKUs from Google Sheets
  async syncSkusFromSheets(syncType = 'manual') {
    const client = this.createClient();
    await client.connect();
    
    const syncLogId = await this.createSyncLog(client, syncType);
    let totalSkus = 0;
    let newSkus = 0;
    let updatedSkus = 0;
    let failedSkus = 0;
    
    try {
      console.log('📊 Starting SKU sync from Google Sheets...');
      
      // Get all sheet names
      const sheetNames = await this.getSheetNames();
      console.log(`📋 Found ${sheetNames.length} sheets:`, sheetNames);
      
      // Process each sheet
      for (const sheetName of sheetNames) {
        try {
          console.log(`📄 Processing sheet: ${sheetName}`);
          
          // Read sheet data
          const rows = await this.readSheetData(sheetName);
          const skus = this.parseSkuData(rows, sheetName);
          
          console.log(`📦 Found ${skus.length} SKUs in sheet ${sheetName}`);
          
          // Process each SKU
          for (const sku of skus) {
            try {
              const result = await this.upsertSku(client, sku);
              totalSkus++;
              
              if (result.isNew) {
                newSkus++;
              } else {
                updatedSkus++;
              }
            } catch (error) {
              console.error(`❌ Error processing SKU ${sku.sku_code}:`, error);
              failedSkus++;
            }
          }
        } catch (error) {
          console.error(`❌ Error processing sheet ${sheetName}:`, error);
          failedSkus += 10; // Estimate failed SKUs
        }
      }
      
      // Update sync log with success
      await this.updateSyncLog(client, syncLogId, 'success', {
        totalSkus,
        newSkus,
        updatedSkus,
        failedSkus
      });
      
      console.log(`✅ SKU sync completed: ${totalSkus} total, ${newSkus} new, ${updatedSkus} updated, ${failedSkus} failed`);
      
      return {
        success: true,
        totalSkus,
        newSkus,
        updatedSkus,
        failedSkus
      };
      
    } catch (error) {
      console.error('❌ Error during SKU sync:', error);
      
      // Update sync log with failure
      await this.updateSyncLog(client, syncLogId, 'failed', {
        totalSkus,
        newSkus,
        updatedSkus,
        failedSkus,
        errorMessage: error.message
      });
      
      throw error;
    } finally {
      await client.end();
    }
  }

  // Upsert SKU to database
  async upsertSku(client, skuData) {
    const query = `
      INSERT INTO sku_master (sku_code, brand, model, capacity, color, carrier, post_fix, is_unlocked, source_tab, sheet_row_id, last_synced)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (sku_code) 
      DO UPDATE SET 
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        capacity = EXCLUDED.capacity,
        color = EXCLUDED.color,
        carrier = EXCLUDED.carrier,
        post_fix = EXCLUDED.post_fix,
        is_unlocked = EXCLUDED.is_unlocked,
        source_tab = EXCLUDED.source_tab,
        sheet_row_id = EXCLUDED.sheet_row_id,
        last_synced = NOW(),
        updated_at = NOW()
      RETURNING id, (xmax = 0) as is_new
    `;
    
    const values = [
      skuData.sku_code,
      skuData.brand,
      skuData.model,
      skuData.capacity,
      skuData.color,
      skuData.carrier,
      skuData.post_fix,
      skuData.is_unlocked,
      skuData.source_tab,
      skuData.sheet_row_id
    ];
    
    const result = await client.query(query, values);
    return {
      id: result.rows[0].id,
      isNew: result.rows[0].is_new
    };
  }

  // Create sync log entry
  async createSyncLog(client, syncType) {
    const query = `
      INSERT INTO sku_sync_log (sync_type, status, started_at)
      VALUES ($1, 'running', NOW())
      RETURNING id
    `;
    
    const result = await client.query(query, [syncType]);
    return result.rows[0].id;
  }

  // Update sync log entry
  async updateSyncLog(client, syncLogId, status, stats) {
    const query = `
      UPDATE sku_sync_log 
      SET 
        status = $1,
        total_skus = $2,
        new_skus = $3,
        updated_skus = $4,
        failed_skus = $5,
        error_message = $6,
        completed_at = NOW()
      WHERE id = $7
    `;
    
    await client.query(query, [
      status,
      stats.totalSkus || 0,
      stats.newSkus || 0,
      stats.updatedSkus || 0,
      stats.failedSkus || 0,
      stats.errorMessage || null,
      syncLogId
    ]);
  }

  // Get SKU statistics
  async getSkuStats() {
    const client = this.createClient();
    await client.connect();
    
    try {
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total_skus,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_skus,
          COUNT(DISTINCT brand) as unique_brands,
          COUNT(DISTINCT carrier) as unique_carriers,
          COUNT(CASE WHEN is_unlocked = true THEN 1 END) as unlocked_skus,
          MAX(last_synced) as last_sync
        FROM sku_master
      `);
      
      const recentSyncs = await client.query(`
        SELECT sync_type, status, total_skus, new_skus, updated_skus, failed_skus, started_at, completed_at
        FROM sku_sync_log 
        ORDER BY started_at DESC 
        LIMIT 5
      `);
      
      return {
        stats: stats.rows[0],
        recentSyncs: recentSyncs.rows
      };
    } finally {
      await client.end();
    }
  }
}

module.exports = GoogleSheetsService;
