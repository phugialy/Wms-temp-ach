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

  async parseSkuWithTags(skuCode: string, description: string, sheetName: string): Promise<DeviceInfo> {
    const sku = (skuCode || '').toUpperCase().trim();
    const desc = (description || '').toLowerCase();
    
    // Always try to parse using our enhanced database reference tables first
    const dbParsedInfo = await this.parseUsingDatabaseReference(sku);
    
    // If database parsing found complete info, use it
    if (dbParsedInfo && this.isCompleteDeviceInfo(dbParsedInfo)) {
      const tags = this.generateTags(dbParsedInfo, sku);
      return {
        ...dbParsedInfo,
        sku_tags: tags,
        tag_count: tags.length
      };
    }
    
    // Fallback to enhanced local parsing
    const deviceInfo = this.extractDeviceInfo(sku, desc, sheetName);
    
    // Merge database results with local parsing (database takes priority)
    const mergedInfo = this.mergeDeviceInfo(dbParsedInfo, deviceInfo);
    
    // Generate tags array for SKU matching
    const tags = this.generateTags(mergedInfo, sku);
    
    return {
      ...mergedInfo,
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
    
    // Enhanced brand detection with better logic
    brand = this.detectBrand(sku, desc, sheetName);
    
    // Extract capacity with improved patterns
    capacity = this.extractCapacity(sku, desc);
    
    // Extract color with improved mapping
    color = this.extractColor(sku, desc);
    
    // Extract carrier with improved mapping
    carrier = this.extractCarrier(sku, desc);
    
    // Extract postfix (condition/grade indicators)
    post_fix = this.extractPostfix(sku);
    
    // Determine device type
    device_type = this.detectDeviceType(sku, desc);
    
    // Enhanced model extraction
    model = this.extractModel(sku, desc, brand, device_type);
    
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

  private detectBrand(sku: string, desc: string, sheetName: string): string {
    // Check sheet name first (most reliable)
    const sheetLower = sheetName.toLowerCase();
    if (sheetLower.includes('samsung') || sheetLower.includes('galaxy')) return 'SAMSUNG';
    if (sheetLower.includes('apple') || sheetLower.includes('iphone')) return 'APPLE';
    if (sheetLower.includes('google') || sheetLower.includes('pixel')) return 'GOOGLE';
    
    // Enhanced brand detection from SKU
    if (sku.includes('IP-') || sku.includes('IPHONE') || sku.includes('IPAD') || sku.includes('MAC') || sku.includes('AIRPODS')) {
      return 'APPLE';
    }
    
    if (sku.includes('SAMSUNG') || sku.includes('GALAXY') || sku.includes('S25') || sku.includes('S24') || 
        sku.includes('S23') || sku.includes('S22') || sku.includes('S21') || sku.includes('S20') || 
        sku.includes('S10') || sku.includes('NOTE') || sku.includes('TAB-') || sku.includes('WATCH-') || 
        sku.includes('ZFLIP') || sku.includes('FOLD')) {
      return 'SAMSUNG';
    }
    
    if (sku.includes('PIXEL') || sku.includes('GOOGLE')) {
      return 'GOOGLE';
    }
    
    if (sku.includes('ONEPLUS') || sku.includes('ONE-')) {
      return 'ONEPLUS';
    }
    
    if (sku.includes('XIAOMI') || sku.includes('MI-') || sku.includes('REDMI') || sku.includes('POCO')) {
      return 'XIAOMI';
    }
    
    if (sku.includes('HUAWEI') || sku.includes('HONOR')) {
      return 'HUAWEI';
    }
    
    // Fallback to original pattern matching
    for (const [brandName, pattern] of Object.entries(this.brandPatterns)) {
      if (pattern.test(sku) || pattern.test(desc)) {
        return brandName;
      }
    }
    
    return '';
  }

  private extractCapacity(sku: string, desc: string): string {
    // Enhanced capacity extraction
    const capacityPatterns = [
      { pattern: /(\d+)\s*(GB|TB)/i, format: (num: string, unit: string) => `${num}${unit.toUpperCase()}` },
      { pattern: /(\d+)\s*(G|T)/i, format: (num: string, unit: string) => `${num}${unit.toUpperCase()}B` },
      { pattern: /-(\d+)-/i, format: (num: string) => `${num}GB` }, // For patterns like IP-13-128-BLK
      { pattern: /-(\d+)$/i, format: (num: string) => `${num}GB` }  // For patterns like WATCH-6-44
    ];
    
    for (const { pattern, format } of capacityPatterns) {
      const match = sku.match(pattern) || desc.match(pattern);
      if (match && match[1]) {
        return format(match[1], match[2] || '');
      }
    }
    
    return '';
  }

  private extractColor(sku: string, desc: string): string {
    // Enhanced color extraction with more patterns
    const colorPatterns = [
      // Direct color codes
      { pattern: /BLK|BLACK/i, color: 'BLACK' },
      { pattern: /WHT|WHITE/i, color: 'WHITE' },
      { pattern: /SLV|SILVER/i, color: 'SILVER' },
      { pattern: /GLD|GOLD/i, color: 'GOLD' },
      { pattern: /PINK|ROSE/i, color: 'PINK' },
      { pattern: /BLU|BLUE/i, color: 'BLUE' },
      { pattern: /GRN|GREEN/i, color: 'GREEN' },
      { pattern: /RED/i, color: 'RED' },
      { pattern: /PUR|PURPLE/i, color: 'PURPLE' },
      { pattern: /YLW|YELLOW/i, color: 'YELLOW' },
      { pattern: /ORG|ORANGE/i, color: 'ORANGE' },
      { pattern: /GRY|GRAY|GREY/i, color: 'GRAY' },
      { pattern: /CREAM|BEIGE/i, color: 'CREAM' },
      { pattern: /BURGUNDY|BURG/i, color: 'BURGUNDY' }
    ];
    
    for (const { pattern, color } of colorPatterns) {
      if (pattern.test(sku) || pattern.test(desc)) {
        return color;
      }
    }
    
    return '';
  }

  private extractCarrier(sku: string, desc: string): string {
    // Enhanced carrier extraction
    const carrierPatterns = [
      { pattern: /UNLOCKED|UNLOCK/i, carrier: 'UNLOCKED' },
      { pattern: /VERIZON|VZW|VRZ/i, carrier: 'VERIZON' },
      { pattern: /ATT|AT&T/i, carrier: 'ATT' },
      { pattern: /TMOBILE|T-MOBILE|TMO|T-MO/i, carrier: 'T-MOBILE' },
      { pattern: /SPRINT|SPR/i, carrier: 'SPRINT' },
      { pattern: /WIFI|WI-FI/i, carrier: 'WIFI' },
      { pattern: /4G|LTE/i, carrier: '4G' },
      { pattern: /5G/i, carrier: '5G' }
    ];
    
    for (const { pattern, carrier } of carrierPatterns) {
      if (pattern.test(sku) || pattern.test(desc)) {
        return carrier;
      }
    }
    
    return '';
  }

  private extractPostfix(sku: string): string {
    // Extract postfix (condition/grade indicators)
    const postfixMatch = sku.match(/-([A-Z0-9]+)$/);
    if (postfixMatch && postfixMatch[1]) {
      const postfix = postfixMatch[1];
      // Only keep condition/grade indicators
      const validPostfixes = ['VG', 'NEW', 'ACCEPTABLE', 'UL', 'LN', 'OPENBOX', 'USED', 'REFURB'];
      if (validPostfixes.includes(postfix)) {
        return postfix;
      }
    }
    return '';
  }

  private detectDeviceType(sku: string, desc: string): string {
    if (sku.includes('IPAD') || sku.includes('TAB-') || desc.includes('tablet')) {
      return 'TABLET';
    } else if (sku.includes('WATCH-') || sku.includes('AW') || desc.includes('watch')) {
      return 'WATCH';
    } else if (sku.includes('MAC') || sku.includes('IMAC') || desc.includes('macbook')) {
      return 'DESKTOP';
    } else if (sku.includes('AIRPODS') || desc.includes('airpods')) {
      return 'AUDIO';
    }
    return 'PHONE';
  }

  private extractModel(sku: string, desc: string, brand: string, deviceType: string): string {
    // Enhanced model extraction based on brand and device type
    
    if (brand === 'APPLE') {
      return this.extractAppleModel(sku, desc, deviceType);
    } else if (brand === 'SAMSUNG') {
      return this.extractSamsungModel(sku, desc, deviceType);
    } else if (brand === 'GOOGLE') {
      return this.extractGoogleModel(sku, desc, deviceType);
    }
    
    return '';
  }

  private extractAppleModel(sku: string, desc: string, deviceType: string): string {
    if (deviceType === 'PHONE') {
      // iPhone models
      const iphoneMatch = sku.match(/IP-(\d+)(?:-PRO)?(?:-MAX)?/i) || desc.match(/iphone\s*(\d+)/i);
      if (iphoneMatch) {
        let model = `iPhone ${iphoneMatch[1]}`;
        if (sku.includes('PRO')) model += ' Pro';
        if (sku.includes('MAX')) model += ' Max';
        return model;
      }
    } else if (deviceType === 'TABLET') {
      // iPad models
      if (sku.includes('PRO')) return 'iPad Pro';
      if (sku.includes('AIR')) return 'iPad Air';
      if (sku.includes('MINI')) return 'iPad Mini';
      return 'iPad';
    } else if (deviceType === 'WATCH') {
      // Apple Watch models
      const watchMatch = sku.match(/WATCH-(\d+)/i);
      if (watchMatch) return `Apple Watch Series ${watchMatch[1]}`;
      return 'Apple Watch';
    }
    
    return '';
  }

  private extractSamsungModel(sku: string, desc: string, deviceType: string): string {
    if (deviceType === 'PHONE') {
      // Galaxy S series (including S24/S25)
      const sMatch = sku.match(/S(\d+)(?:-ULTRA|-PLUS|-EDGE)?/i);
      if (sMatch) {
        let model = `Galaxy S${sMatch[1]}`;
        if (sku.includes('ULTRA')) model += ' Ultra';
        else if (sku.includes('PLUS')) model += ' Plus';
        else if (sku.includes('EDGE')) model += ' Edge';
        return model;
      }
      
      // Galaxy Note series
      const noteMatch = sku.match(/NOTE-(\d+)/i);
      if (noteMatch) return `Galaxy Note ${noteMatch[1]}`;
      
      // Galaxy Flip/Fold series
      if (sku.includes('ZFLIP')) {
        const flipMatch = sku.match(/ZFLIP(\d+)/i);
        if (flipMatch) return `Galaxy Z Flip ${flipMatch[1]}`;
        return 'Galaxy Z Flip';
      }
      
      if (sku.includes('FOLD')) {
        const foldMatch = sku.match(/FOLD(\d+)/i);
        if (foldMatch) return `Galaxy Z Fold ${foldMatch[1]}`;
        return 'Galaxy Z Fold';
      }
      
      // Generic Galaxy
      if (sku.includes('GALAXY')) {
        const galaxyMatch = sku.match(/GALAXY\s*([A-Z0-9\s]+)/i);
        if (galaxyMatch && galaxyMatch[1]) return `Galaxy ${galaxyMatch[1].trim()}`;
        return 'Galaxy';
      }
    } else if (deviceType === 'TABLET') {
      // Galaxy Tab series
      const tabMatch = sku.match(/TAB-([A-Z0-9-]+)/i);
      if (tabMatch && tabMatch[1]) return `Galaxy Tab ${tabMatch[1].replace(/-/g, ' ')}`;
      return 'Galaxy Tab';
    } else if (deviceType === 'WATCH') {
      // Galaxy Watch series
      const watchMatch = sku.match(/WATCH-(\d+)/i);
      if (watchMatch) return `Galaxy Watch ${watchMatch[1]}`;
      return 'Galaxy Watch';
    }
    
    return '';
  }

  private extractGoogleModel(sku: string, desc: string, deviceType: string): string {
    if (deviceType === 'PHONE') {
      // Pixel phones
      const pixelMatch = sku.match(/PIXEL-(\d+)(?:-PRO)?/i) || desc.match(/pixel\s*(\d+)/i);
      if (pixelMatch) {
        let model = `Pixel ${pixelMatch[1]}`;
        if (sku.includes('PRO')) model += ' Pro';
        return model;
      }
    } else if (deviceType === 'WATCH') {
      // Pixel Watch
      if (sku.includes('PIXEL-WATCH')) return 'Pixel Watch';
    }
    
    return '';
  }

  /**
   * Parse SKU using database reference tables
   */
  private async parseUsingDatabaseReference(sku: string): Promise<Omit<DeviceInfo, 'sku_tags' | 'tag_count'> | null> {
    try {
      const client = this.createClient();
      await client.connect();
      
      try {
        const result = await client.query('SELECT * FROM parse_sku_complete($1::text)', [sku]);
        const parsed = result.rows[0];
        
        if (parsed) {
          return {
            brand: parsed.brand || '',
            model: parsed.model || '',
            capacity: parsed.capacity || '',
            color: parsed.color || '',
            carrier: parsed.carrier || '',
            post_fix: parsed.postfix || '',
            device_type: parsed.device_type || 'PHONE'
          };
        }
      } finally {
        await client.end();
      }
    } catch (error) {
      console.warn(`⚠️ Database parsing failed for SKU ${sku}:`, error instanceof Error ? error.message : String(error));
    }
    
    return null;
  }

  /**
   * Check if device info is complete enough
   */
  private isCompleteDeviceInfo(info: Omit<DeviceInfo, 'sku_tags' | 'tag_count'>): boolean {
    return !!(info.brand && info.model && info.capacity && info.color);
  }

  /**
   * Merge database parsing results with local parsing (database takes priority)
   */
  private mergeDeviceInfo(
    dbInfo: Omit<DeviceInfo, 'sku_tags' | 'tag_count'> | null,
    localInfo: Omit<DeviceInfo, 'sku_tags' | 'tag_count'>
  ): Omit<DeviceInfo, 'sku_tags' | 'tag_count'> {
    if (!dbInfo) return localInfo;
    
    return {
      brand: dbInfo.brand || localInfo.brand,
      model: dbInfo.model || localInfo.model,
      capacity: dbInfo.capacity || localInfo.capacity,
      color: dbInfo.color || localInfo.color,
      carrier: dbInfo.carrier || localInfo.carrier,
      post_fix: dbInfo.post_fix || localInfo.post_fix,
      device_type: dbInfo.device_type || localInfo.device_type
    };
  }

  /**
   * Enhanced SKU segmentation - break down complex SKUs into components
   */
  private segmentSku(sku: string): string[] {
    // Remove common separators and split
    const segments = sku
      .replace(/[-_\/]/g, ' ')
      .split(/\s+/)
      .filter(segment => segment.length > 0);
    
    // Further break down segments that might contain multiple components
    const expandedSegments: string[] = [];
    
    for (const segment of segments) {
      // Handle patterns like "ZFLIP5" -> ["ZFLIP", "5"]
      if (segment.match(/^[A-Z]+\d+$/)) {
        const match = segment.match(/^([A-Z]+)(\d+)$/);
        if (match && match[1] && match[2]) {
          expandedSegments.push(match[1], match[2]);
        } else {
          expandedSegments.push(segment);
        }
      }
      // Handle patterns like "S23ULTRA" -> ["S23", "ULTRA"]
      else if (segment.match(/^[A-Z]\d+[A-Z]+$/)) {
        const match = segment.match(/^([A-Z]\d+)([A-Z]+)$/);
        if (match && match[1] && match[2]) {
          expandedSegments.push(match[1], match[2]);
        } else {
          expandedSegments.push(segment);
        }
      }
      // Handle patterns like "128GB" -> ["128", "GB"]
      else if (segment.match(/^\d+[A-Z]+$/)) {
        const match = segment.match(/^(\d+)([A-Z]+)$/);
        if (match && match[1] && match[2]) {
          expandedSegments.push(match[1], match[2]);
        } else {
          expandedSegments.push(segment);
        }
      }
      else {
        expandedSegments.push(segment);
      }
    }
    
    return expandedSegments;
  }

  /**
   * Enhanced pattern matching using segmented SKU
   */
  private matchSegmentedPatterns(segments: string[], patterns: string[]): boolean {
    for (const pattern of patterns) {
      const patternUpper = pattern.toUpperCase();
      
      // Direct segment match
      if (segments.some(segment => segment === patternUpper)) {
        return true;
      }
      
      // Partial match within segments
      if (segments.some(segment => segment.includes(patternUpper) || patternUpper.includes(segment))) {
        return true;
      }
      
      // Combined segment match (e.g., "S23" + "ULTRA" matches "S23ULTRA")
      for (let i = 0; i < segments.length - 1; i++) {
        const segment1 = segments[i];
        const segment2 = segments[i + 1];
        if (segment1 && segment2) {
          const combined = segment1 + segment2;
          if (combined === patternUpper || patternUpper.includes(combined)) {
            return true;
          }
        }
      }
    }
    
    return false;
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
              const deviceInfo = await this.parseSkuWithTags(row.sku_code, row.description, sheetName);
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

