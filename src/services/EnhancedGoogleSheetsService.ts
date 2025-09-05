import { google } from 'googleapis';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeviceInfo {
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  post_fix: string;
  device_type: string;
  sku_tags: string[];
  tag_count: number;
}

interface SkuData extends DeviceInfo {
  sku_code: string;
  source_tab: string;
  sheet_row_id: number;
  is_active: boolean;
  last_synced: Date;
  created_at: Date;
  updated_at: Date;
}

interface SyncResult {
  success: boolean;
  totalSkus: number;
  newSkus: number;
  updatedSkus: number;
  skippedSkus: number;
  failedSkus: number;
  efficiency?: string;
}

interface SheetRow {
  sku_code: string;
  description: string;
  price?: string;
  condition?: string;
  row_number: number;
}

interface ExistingSku {
  source_tab: string;
  sheet_row_id: number;
  last_synced: Date;
  sku_tags: string[];
  brand: string;
  model: string;
  capacity: string;
  color: string;
  carrier: string;
  post_fix: string;
  device_type: string;
}

export class EnhancedGoogleSheetsService {
  private spreadsheetId: string = '18Zo9Z9n7D6j0dzYpPTj9_zgrg0poNFJ5rU5iss593qo';
  private sheets: any;
  private useApiKey: boolean;
  private apiKey?: string;
  private auth?: any;

  // Brand patterns for detection
  private brandPatterns: Record<string, RegExp> = {
    'APPLE': /^(IPHONE|IPAD|MAC|WATCH|AIRPODS)/i,
    'SAMSUNG': /^(GALAXY|SAMSUNG|NOTE|TAB|WATCH|GEAR|FLIP|FOLD)/i,
    'GOOGLE': /^(PIXEL|GOOGLE|NEXUS)/i,
    'ONEPLUS': /^(ONEPLUS|ONE)/i,
    'XIAOMI': /^(XIAOMI|MI|REDMI|POCO)/i,
    'HUAWEI': /^(HUAWEI|HONOR)/i
  };

  // Capacity patterns
  private capacityPatterns: Array<{ pattern: RegExp; format: (num: string, unit: string) => string }> = [
    { pattern: /(\d+)\s*(GB|TB)/i, format: (num, unit) => `${num}${unit.toUpperCase()}` },
    { pattern: /(\d+)\s*(G|T)/i, format: (num, unit) => `${num}${unit.toUpperCase()}B` }
  ];

  // Color mappings
  private colorMappings: Record<string, string> = {
    'BLK': 'BLACK', 'BLACK': 'BLACK',
    'WHT': 'WHITE', 'WHITE': 'WHITE',
    'SLV': 'SILVER', 'SILVER': 'SILVER',
    'GLD': 'GOLD', 'GOLD': 'GOLD',
    'PINK': 'PINK', 'ROSE': 'PINK',
    'BLU': 'BLUE', 'BLUE': 'BLUE',
    'GRN': 'GREEN', 'GREEN': 'GREEN',
    'RED': 'RED',
    'PUR': 'PURPLE', 'PURPLE': 'PURPLE',
    'YLW': 'YELLOW', 'YELLOW': 'YELLOW',
    'ORG': 'ORANGE', 'ORANGE': 'ORANGE',
    'GRY': 'GRAY', 'GRAY': 'GRAY', 'GREY': 'GRAY',
    'CREAM': 'CREAM', 'BEIGE': 'CREAM',
    'BURGUNDY': 'BURGUNDY', 'BURG': 'BURGUNDY'
  };

  // Carrier mappings
  private carrierMappings: Record<string, string> = {
    'UNLOCKED': 'UNLOCKED', 'UNLOCK': 'UNLOCKED',
    'VERIZON': 'VERIZON', 'VZW': 'VERIZON',
    'ATT': 'ATT', 'AT&T': 'ATT',
    'TMOBILE': 'T-MOBILE', 'T-MOBILE': 'T-MOBILE', 'TM': 'T-MOBILE',
    'SPRINT': 'SPRINT', 'SPR': 'SPRINT',
    'WIFI': 'WIFI', 'WI-FI': 'WIFI',
    '4G': '4G', 'LTE': '4G',
    '5G': '5G'
  };

  constructor() {
    this.sheets = google.sheets({ version: 'v4' });
    
    // Initialize auth based on available credentials
    if (process.env['GOOGLE_API_KEY']) {
      this.useApiKey = true;
      this.apiKey = process.env['GOOGLE_API_KEY'];
      console.log('🔑 Using Google API Key authentication');
    } else if (process.env['GOOGLE_SERVICE_ACCOUNT_JSON']) {
      this.useApiKey = false;
      const serviceAccount = JSON.parse(process.env['GOOGLE_SERVICE_ACCOUNT_JSON']);
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('🔐 Using Google Service Account JSON authentication');
    } else {
      console.error('❌ No Google authentication configured');
      throw new Error('No Google authentication configured. Please set GOOGLE_API_KEY or GOOGLE_SERVICE_ACCOUNT_JSON in your .env file');
    }
  }

  private createClient(): Client {
    return new Client({
      connectionString: process.env['DIRECT_URL'],
      connectionTimeoutMillis: 30000,
    });
  }

  async getSheetNames(): Promise<string[]> {
    try {
      const request: any = {
        spreadsheetId: this.spreadsheetId,
        ranges: [],
        includeGridData: false,
      };

      if (this.useApiKey) {
        request.auth = this.apiKey;
      } else {
        request.auth = this.auth;
      }

      const response = await this.sheets.spreadsheets.get(request);
      return response.data.sheets.map((sheet: any) => sheet.properties.title);
    } catch (error) {
      console.error('❌ Error getting sheet names:', error);
      throw error;
    }
  }

  async readSheetData(sheetName: string): Promise<SheetRow[]> {
    try {
      const request: any = {
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      };

      if (this.useApiKey) {
        request.auth = this.apiKey;
      } else {
        request.auth = this.auth;
      }

      const response = await this.sheets.spreadsheets.values.get(request);
      const rows = response.data.values || [];

      if (rows.length === 0) {
        return [];
      }

      // Assume first row is headers
      const headers = rows[0].map((h: string) => h.toLowerCase().replace(/\s+/g, '_'));
      const dataRows = rows.slice(1);

      return dataRows
        .map((row: any[], index: number) => {
          const rowData: any = { row_number: index + 2 }; // +2 because we skip header and 0-indexed
          
          headers.forEach((header: string, colIndex: number) => {
            rowData[header] = row[colIndex] || '';
          });

          return {
            sku_code: rowData.sku_code || rowData.sku || '',
            description: rowData.description || rowData.product_description || '',
            price: rowData.price || '',
            condition: rowData.condition || '',
            row_number: rowData.row_number
          };
        })
        .filter((row: SheetRow) => row.sku_code && row.sku_code.trim());
    } catch (error) {
      console.error(`❌ Error reading sheet ${sheetName}:`, error);
      throw error;
    }
  }

  parseSkuWithTags(skuCode: string, description: string, sheetName: string): DeviceInfo {
    const sku = (skuCode || '').toUpperCase().trim();
    const desc = (description || '').toLowerCase();
    
    // Extract basic device information
    const deviceInfo = this.extractDeviceInfo(sku, desc, sheetName);
    
    // Generate tags array for SKU matching
    const tags = this.generateTags(deviceInfo, sku);
    
    return {
      ...deviceInfo,
      sku_tags: tags,
      tag_count: tags.length
    };
  }

  private extractDeviceInfo(sku: string, desc: string, sheetName: string): Omit<DeviceInfo, 'sku_tags' | 'tag_count'> {
    let brand = '';
    let model = '';
    let capacity = '';
    let color = '';
    let carrier = '';
    let post_fix = '';
    let device_type = 'PHONE';
    
    // Determine brand
    for (const [brandName, pattern] of Object.entries(this.brandPatterns)) {
      if (pattern.test(sku) || pattern.test(desc) || sheetName.includes(brandName)) {
        brand = brandName;
        break;
      }
    }
    
    // Extract capacity
    for (const { pattern, format } of this.capacityPatterns) {
      const match = sku.match(pattern) || desc.match(pattern);
      if (match && match[1] && match[2]) {
        capacity = format(match[1], match[2]);
        break;
      }
    }
    
    // Extract color
    for (const [abbrev, fullColor] of Object.entries(this.colorMappings)) {
      if (sku.includes(abbrev) || desc.includes(abbrev.toLowerCase())) {
        color = fullColor;
        break;
      }
    }
    
    // Extract carrier
    for (const [abbrev, fullCarrier] of Object.entries(this.carrierMappings)) {
      if (sku.includes(abbrev) || desc.includes(abbrev.toLowerCase())) {
        carrier = fullCarrier;
        break;
      }
    }
    
    // Extract postfix (usually at the end after a dash)
    const postfixMatch = sku.match(/-([A-Z0-9]+)$/);
    if (postfixMatch && postfixMatch[1]) {
      post_fix = postfixMatch[1];
    }
    
    // Determine device type
    if (sku.includes('IPAD') || sku.includes('TAB') || desc.includes('tablet')) {
      device_type = 'TABLET';
    } else if (sku.includes('WATCH') || sku.includes('AW') || desc.includes('watch')) {
      device_type = 'WATCH';
    } else if (sku.includes('MAC') || sku.includes('IMAC') || desc.includes('macbook')) {
      device_type = 'DESKTOP';
    }
    
    // Extract model (simplified)
    if (brand === 'APPLE') {
      if (sku.includes('IPHONE')) {
        const iphoneMatch = sku.match(/IPHONE(\d+)/) || desc.match(/iphone\s*(\d+)/);
        if (iphoneMatch) model = `iPhone ${iphoneMatch[1]}`;
      } else if (sku.includes('IPAD')) {
        if (sku.includes('PRO')) model = 'iPad Pro';
        else if (sku.includes('AIR')) model = 'iPad Air';
        else if (sku.includes('MINI')) model = 'iPad Mini';
        else model = 'iPad';
      }
    } else if (brand === 'SAMSUNG') {
      if (sku.includes('GALAXY')) {
        const galaxyMatch = sku.match(/GALAXY\s*([A-Z0-9\s]+)/);
        if (galaxyMatch && galaxyMatch[1]) model = `Galaxy ${galaxyMatch[1].trim()}`;
      }
    } else if (brand === 'GOOGLE') {
      const pixelMatch = sku.match(/PIXEL\s*(\d+[A-Z]?)/) || desc.match(/pixel\s*(\d+[a-z]?)/);
      if (pixelMatch) model = `Pixel ${pixelMatch[1]}`;
    }
    
    return {
      brand,
      model,
      capacity,
      color,
      carrier,
      post_fix,
      device_type
    };
  }

  private generateTags(deviceInfo: Omit<DeviceInfo, 'sku_tags' | 'tag_count'>, sku: string): string[] {
    const tags: string[] = [];
    
    // Add brand tag
    if (deviceInfo.brand) {
      tags.push(deviceInfo.brand);
    }
    
    // Add model tag (normalized)
    if (deviceInfo.model) {
      const normalizedModel = this.normalizeModel(deviceInfo.model);
      if (normalizedModel) tags.push(normalizedModel);
    }
    
    // Add capacity tag
    if (deviceInfo.capacity) {
      tags.push(deviceInfo.capacity);
    }
    
    // Add color tag
    if (deviceInfo.color) {
      tags.push(deviceInfo.color);
    }
    
    // Add carrier tag
    if (deviceInfo.carrier) {
      tags.push(deviceInfo.carrier);
    }
    
    // Add postfix tag
    if (deviceInfo.post_fix) {
      tags.push(deviceInfo.post_fix);
    }
    
    // Add device type tag
    if (deviceInfo.device_type) {
      tags.push(deviceInfo.device_type);
    }
    
    // Add SKU segments as individual tags for flexible matching
    const segments = sku.split(/[-_\/]/).filter(seg => seg.length > 1);
    segments.forEach(segment => {
      if (!tags.includes(segment)) {
        tags.push(segment);
      }
    });
    
    return tags;
  }

  private normalizeModel(model: string): string | null {
    if (!model) return null;
    
    const normalized = model
      .replace(/\s+/g, ' ')
      .replace(/\bDUOS\b/gi, 'Duos')
      .replace(/\b5G\b/gi, '5G')
      .replace(/\bULTRA\b/gi, 'Ultra')
      .replace(/\bPLUS\b/gi, 'Plus')
      .replace(/\bPRO\b/gi, 'Pro')
      .replace(/\bMAX\b/gi, 'Max')
      .trim();
    
    return normalized;
  }

  async getExistingSkus(client: Client): Promise<Map<string, ExistingSku>> {
    const result = await client.query(`
      SELECT 
        sku_code,
        source_tab,
        sheet_row_id,
        last_synced,
        sku_tags,
        brand,
        model,
        capacity,
        color,
        carrier,
        post_fix,
        device_type
      FROM sku_master 
      WHERE is_active = true
    `);
    
    const existingSkus = new Map<string, ExistingSku>();
    result.rows.forEach((row: any) => {
      existingSkus.set(row.sku_code, {
        source_tab: row.source_tab,
        sheet_row_id: row.sheet_row_id,
        last_synced: row.last_synced,
        sku_tags: row.sku_tags || [],
        brand: row.brand,
        model: row.model,
        capacity: row.capacity,
        color: row.color,
        carrier: row.carrier,
        post_fix: row.post_fix,
        device_type: row.device_type
      });
    });
    
    return existingSkus;
  }

  private hasSkuChanged(existingSku: ExistingSku | undefined, newSkuData: DeviceInfo): boolean {
    if (!existingSku) return true; // New SKU
    
    // Compare key fields
    const fieldsToCompare: (keyof Omit<ExistingSku, 'source_tab' | 'sheet_row_id' | 'last_synced' | 'sku_tags'>)[] = ['brand', 'model', 'capacity', 'color', 'carrier', 'post_fix', 'device_type'];
    
    for (const field of fieldsToCompare) {
      if (existingSku[field] !== newSkuData[field]) {
        return true;
      }
    }
    
    // Compare tags array
    const existingTags = existingSku.sku_tags || [];
    const newTags = newSkuData.sku_tags || [];
    
    if (existingTags.length !== newTags.length) {
      return true;
    }
    
    // Check if tags content is different
    const existingTagsSorted = [...existingTags].sort();
    const newTagsSorted = [...newTags].sort();
    
    for (let i = 0; i < existingTagsSorted.length; i++) {
      if (existingTagsSorted[i] !== newTagsSorted[i]) {
        return true;
      }
    }
    
    return false;
  }

  async upsertSkuWithTags(client: Client, skuData: SkuData): Promise<{ id: number; sku_code: string; isNew: boolean }> {
    try {
      const upsertQuery = `
        INSERT INTO sku_master (
          sku_code, brand, model, capacity, color, carrier, post_fix, 
          device_type, source_tab, sheet_row_id, sku_tags, tag_count,
          is_active, last_synced, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
        ON CONFLICT (sku_code) DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          capacity = EXCLUDED.capacity,
          color = EXCLUDED.color,
          carrier = EXCLUDED.carrier,
          post_fix = EXCLUDED.post_fix,
          device_type = EXCLUDED.device_type,
          source_tab = EXCLUDED.source_tab,
          sheet_row_id = EXCLUDED.sheet_row_id,
          sku_tags = EXCLUDED.sku_tags,
          tag_count = EXCLUDED.tag_count,
          is_active = EXCLUDED.is_active,
          last_synced = EXCLUDED.last_synced,
          updated_at = NOW()
        RETURNING id, sku_code, (xmax = 0) AS is_new
      `;
      
      const result = await client.query(upsertQuery, [
        skuData.sku_code,
        skuData.brand,
        skuData.model,
        skuData.capacity,
        skuData.color,
        skuData.carrier,
        skuData.post_fix,
        skuData.device_type,
        skuData.source_tab,
        skuData.sheet_row_id,
        skuData.sku_tags,
        skuData.tag_count,
        true
      ]);
      
      return {
        id: result.rows[0].id,
        sku_code: result.rows[0].sku_code,
        isNew: result.rows[0].is_new
      };
      
    } catch (error) {
      console.error(`❌ Error upserting SKU ${skuData.sku_code}:`, error);
      throw error;
    }
  }

  async createSyncLog(client: Client, syncType: string): Promise<number> {
    const result = await client.query(`
      INSERT INTO sku_sync_log (sync_type, status, started_at)
      VALUES ($1, 'running', NOW())
      RETURNING id
    `, [syncType]);
    
    return result.rows[0].id;
  }

  async updateSyncLog(client: Client, syncLogId: number, status: string, data: any): Promise<void> {
    // Add skipped_skus column if it doesn't exist
    await client.query(`
      ALTER TABLE sku_sync_log 
      ADD COLUMN IF NOT EXISTS skipped_skus INTEGER DEFAULT 0
    `);
    
    await client.query(`
      UPDATE sku_sync_log 
      SET status = $1, 
          total_skus = $2,
          new_skus = $3,
          updated_skus = $4,
          failed_skus = $5,
          skipped_skus = $6,
          error_message = $7,
          completed_at = NOW()
      WHERE id = $8
    `, [
      status,
      data.totalSkus || 0,
      data.newSkus || 0,
      data.updatedSkus || 0,
      data.failedSkus || 0,
      data.skippedSkus || 0,
      data.errorMessage || null,
      syncLogId
    ]);
  }

  async syncSkusWithTags(syncType: string = 'enhanced', forceFullSync: boolean = false): Promise<SyncResult> {
    const client = this.createClient();
    await client.connect();
    
    const syncLogId = await this.createSyncLog(client, syncType);
    let totalSkus = 0;
    let newSkus = 0;
    let updatedSkus = 0;
    let skippedSkus = 0;
    let failedSkus = 0;
    
    try {
      console.log('🚀 Starting ENHANCED SKU sync with incremental updates...');
      
      // Get existing SKUs for comparison
      const existingSkus = await this.getExistingSkus(client);
      console.log(`📊 Found ${existingSkus.size} existing SKUs in database`);
      
      // Get all sheet names
      const sheetNames = await this.getSheetNames();
      console.log(`📋 Found ${sheetNames.length} sheets:`, sheetNames);
      
      // Process each sheet
      for (const sheetName of sheetNames) {
        try {
          console.log(`📄 Processing sheet: ${sheetName}`);
          
          // Read sheet data
          const rows = await this.readSheetData(sheetName);
          console.log(`📦 Found ${rows.length} SKUs in sheet ${sheetName}`);
          
          let sheetNewSkus = 0;
          let sheetUpdatedSkus = 0;
          let sheetSkippedSkus = 0;
          
          // Process each SKU with enhanced parsing
          for (const row of rows) {
            try {
              const deviceInfo = this.parseSkuWithTags(row.sku_code, row.description, sheetName);
              const skuData: SkuData = {
                ...deviceInfo,
                sku_code: row.sku_code,
                source_tab: sheetName,
                sheet_row_id: row.row_number,
                is_active: true,
                last_synced: new Date(),
                created_at: new Date(),
                updated_at: new Date()
              };
              
              const existingSku = existingSkus.get(skuData.sku_code);
              
              // Check if we need to update this SKU
              if (forceFullSync || this.hasSkuChanged(existingSku, deviceInfo)) {
                const result = await this.upsertSkuWithTags(client, skuData);
                totalSkus++;
                
                if (result.isNew) {
                  newSkus++;
                  sheetNewSkus++;
                } else {
                  updatedSkus++;
                  sheetUpdatedSkus++;
                }
                
                // Log progress every 50 SKUs
                if (totalSkus % 50 === 0) {
                  console.log(`✅ Processed ${totalSkus} SKUs (${newSkus} new, ${updatedSkus} updated, ${skippedSkus} skipped)...`);
                }
              } else {
                skippedSkus++;
                sheetSkippedSkus++;
              }
              
            } catch (error) {
              console.error(`❌ Error processing SKU ${row.sku_code}:`, error);
              failedSkus++;
            }
          }
          
          console.log(`📊 Sheet ${sheetName}: ${sheetNewSkus} new, ${sheetUpdatedSkus} updated, ${sheetSkippedSkus} skipped`);
          
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
        failedSkus,
        skippedSkus
      });
      
      console.log(`✅ ENHANCED SKU sync completed: ${totalSkus} processed (${newSkus} new, ${updatedSkus} updated, ${skippedSkus} skipped), ${failedSkus} failed`);
      
      return {
        success: true,
        totalSkus,
        newSkus,
        updatedSkus,
        skippedSkus,
        failedSkus,
        efficiency: `${Math.round((skippedSkus / (totalSkus + skippedSkus)) * 100)}% skipped (no changes)`
      };
      
    } catch (error) {
      console.error('❌ Enhanced sync failed:', error);
      
      // Update sync log with failure
      await this.updateSyncLog(client, syncLogId, 'failed', {
        totalSkus,
        newSkus,
        updatedSkus,
        failedSkus,
        skippedSkus,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    } finally {
      await client.end();
    }
  }
}
