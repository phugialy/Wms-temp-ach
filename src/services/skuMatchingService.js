const { Client } = require('pg');
require('dotenv').config();

class SkuMatchingService {
  constructor() {
    // No global client - create as needed
  }

  // Create a new database client for each operation
  createClient() {
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  // Normalize text for comparison
  normalizeText(text) {
    if (!text) return '';
    return text.toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .replace(/\s+/g, ''); // Remove spaces
  }

  // Calculate similarity score between two strings
  calculateSimilarity(str1, str2) {
    const normalized1 = this.normalizeText(str1);
    const normalized2 = this.normalizeText(str2);
    
    if (normalized1 === normalized2) return 1.0;
    if (!normalized1 || !normalized2) return 0.0;
    
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return Math.max(0, 1 - (distance / maxLength));
  }

  // Levenshtein distance calculation
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Get carrier variations from mapping rules
  async getCarrierVariations() {
    const client = this.createClient();
    await client.connect();
    
    try {
      const query = `
        SELECT carrier_pattern, target_sku 
        FROM sku_mapping_rules 
        WHERE carrier_pattern IS NOT NULL AND is_active = true
        ORDER BY priority DESC
      `;
      
      const result = await client.query(query);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  // Normalize carrier using mapping rules
  async normalizeCarrier(carrier) {
    if (!carrier) return '';
    
    const variations = await this.getCarrierVariations();
    const normalizedCarrier = carrier.toString().toUpperCase().trim();
    
    for (const variation of variations) {
      const patterns = variation.carrier_pattern.split('|');
      for (const pattern of patterns) {
        if (normalizedCarrier.includes(pattern.toUpperCase())) {
          return variation.target_sku;
        }
      }
    }
    
    return carrier;
  }

  // Normalize color names for better matching
  normalizeColor(color) {
    if (!color) return '';
    
    const colorUpper = color.toUpperCase().trim();
    
    // Handle specific color names and abbreviations
    if (colorUpper.includes('BLK') || colorUpper.includes('BLACK')) return 'BLK';
    if (colorUpper.includes('BLU') || colorUpper.includes('BLUE')) return 'BLU';
    if (colorUpper.includes('WHT') || colorUpper.includes('WHITE')) return 'WHT';
    if (colorUpper.includes('RED')) return 'RED';
    if (colorUpper.includes('GRN') || colorUpper.includes('GREEN')) return 'GRN';
    if (colorUpper.includes('PUR') || colorUpper.includes('PURPLE')) return 'PUR';
    if (colorUpper.includes('PNK') || colorUpper.includes('PINK')) return 'PNK';
    if (colorUpper.includes('GLD') || colorUpper.includes('GOLD')) return 'GLD';
    if (colorUpper.includes('SLV') || colorUpper.includes('SILVER')) return 'SLV';
    if (colorUpper.includes('GRY') || colorUpper.includes('GRAY') || colorUpper.includes('GREY')) return 'GRY';
    if (colorUpper.includes('HAZ') || colorUpper.includes('HAZEL')) return 'HAZ';
    
    // Handle Phantom colors - need to check the full name
    if (colorUpper.includes('PHANTOM')) {
      if (colorUpper.includes('PHANTOM BLACK') || colorUpper.includes('PHANTOMBLACK')) return 'BLK';
      if (colorUpper.includes('PHANTOM GREEN') || colorUpper.includes('PHANTOMGREEN')) return 'GRN';
      if (colorUpper.includes('PHANTOM BLUE') || colorUpper.includes('PHANTOMBLUE')) return 'BLU';
      if (colorUpper.includes('PHANTOM WHITE') || colorUpper.includes('PHANTOMWHITE')) return 'WHT';
      if (colorUpper.includes('PHANTOM RED') || colorUpper.includes('PHANTOMRED')) return 'RED';
      // If it's just "PHA" or "PHANTOM" without a specific color, return UNKNOWN
      if (colorUpper === 'PHA' || colorUpper === 'PHANTOM') return 'UNKNOWN';
      // For any other phantom color we can't identify, return UNKNOWN
      return 'UNKNOWN';
    }
    
    // If it's just "PHA" without context, we can't determine the color
    if (colorUpper === 'PHA') return 'UNKNOWN';
    
    return colorUpper;
  }

  // Find best matching SKU for a device using comprehensive data
  async findBestMatchingSku(deviceData) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const { brand, model, capacity, color, carrier, imei, device_notes } = deviceData;
      
      // Get device notes for carrier override (from view or separate query)
      let notes = device_notes;
      if (!notes && imei) {
        notes = await this.getDeviceNotes(imei);
      }
      
      // Get brand from model if not provided
      const deviceBrand = brand || this.getBrandFromModel(model);
      
             // Parse notes for carrier override
       const carrierOverride = this.parseNotesForCarrierOverride(notes, deviceBrand, carrier);
       
       // Check if device is failed - if so, return null (don't process)
       if (carrierOverride.isFailed) {
         return {
           sku_code: null,
           post_fix: null,
           is_unlocked: null,
           source_tab: null,
           match_score: 0,
           match_method: 'failed_device',
           parsed_info: null,
           carrier_override: {
             original_carrier: carrier,
             effective_carrier: carrier,
             notes: notes,
             is_failed: true
           }
         };
       }
       
       // Use overridden carrier if notes indicate it should be overridden
       const effectiveCarrier = carrierOverride.shouldOverride ? carrierOverride.newCarrier : carrier;
      
      // Normalize carrier
      const normalizedCarrier = await this.normalizeCarrier(effectiveCarrier);
      
      // Enhanced color normalization - handle abbreviations
      const normalizedColor = this.normalizeColor(color);
      
      // Determine if we're looking for unlocked or carrier-specific SKUs
      const isDeviceUnlocked = this.isUnlockedCarrier(normalizedCarrier);
      
      // Query SKU master entries with carrier logic
      let query;
      let queryParams = [];
      
      if (isDeviceUnlocked) {
        // For unlocked devices, look for SKUs that have NO carrier field (unlocked)
        query = `
          SELECT 
            sku_code,
            post_fix,
            is_unlocked,
            source_tab
          FROM sku_master 
          WHERE is_active = true
          AND (is_unlocked = true OR sku_code NOT LIKE '%-%-%-%-%')
        `;
      } else {
        // For carrier-specific devices, look for SKUs that have carrier field
        query = `
          SELECT 
            sku_code,
            post_fix,
            is_unlocked,
            source_tab
          FROM sku_master 
          WHERE is_active = true
          AND sku_code LIKE '%-%-%-%-%'
        `;
      }
      
      const result = await client.query(query, queryParams);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Calculate match scores and find the best match
      let bestMatch = null;
      let bestScore = 0;
      
      for (const row of result.rows) {
        const masterSku = row.sku_code;
        
        // Parse the master SKU to extract device information
        const parsedMasterSku = this.parseSkuCode(masterSku);
        
        // Apply carrier-specific matching logic
        const matchScore = this.calculateDeviceSimilarityWithCarrierLogic(
          { brand: deviceBrand, model, capacity, color: normalizedColor, carrier: normalizedCarrier },
          parsedMasterSku,
          isDeviceUnlocked
        );
        
        // Apply carrier-specific matching requirements with field count normalization
        let shouldAcceptMatch = false;
        let adjustedScore = matchScore;
        
        // Determine if this is a carrier-specific SKU
        const hasCarrierField = parsedMasterSku.carrier && parsedMasterSku.carrier.trim() !== '';
        const isCarrierSpecificSku = hasCarrierField;
        
        // If carrier override is applied, give MAJOR priority to carrier matches
        if (carrierOverride.shouldOverride) {
          // For carrier overrides, require higher base score but give massive boost for carrier match
          if (matchScore >= 0.5) {
            // Check if this is a perfect carrier match for the overridden carrier
            const parsedMasterCarrier = parsedMasterSku.carrier || '';
            const effectiveCarrierUpper = effectiveCarrier.toUpperCase().trim();
            const masterCarrierUpper = parsedMasterCarrier.toUpperCase().trim();
            
            if (effectiveCarrierUpper === 'UNLOCKED' && 
                (masterCarrierUpper === 'UNLOCKED' || masterCarrierUpper === 'UNL' || masterCarrierUpper === '')) {
              // Perfect carrier match for overridden device - MASSIVE boost
              adjustedScore = Math.min(1.0, matchScore + 0.4); // Up to 40% boost
              shouldAcceptMatch = true;
            } else if (effectiveCarrierUpper === masterCarrierUpper) {
              // Good carrier match for overridden device
              adjustedScore = Math.min(1.0, matchScore + 0.2); // Up to 20% boost
              shouldAcceptMatch = true;
            } else {
              // Poor carrier match for overridden device - heavy penalty
              adjustedScore = Math.max(0, matchScore - 0.3); // Up to 30% penalty
              shouldAcceptMatch = adjustedScore >= 0.4; // Still accept if score is reasonable
            }
          }
        } else {
          // No carrier override - use field count normalized logic
          if (isCarrierSpecificSku) {
            // For carrier-specific SKUs, require higher score but give bonus for carrier match
            if (matchScore >= 0.7) {
              shouldAcceptMatch = true;
              adjustedScore = matchScore;
            } else if (matchScore >= 0.5) {
              // Check if carrier matches perfectly
              const carrierScore = this.compareCarrierWithLogic(
                effectiveCarrier, 
                parsedMasterSku.carrier, 
                isDeviceUnlocked
              );
              if (carrierScore >= 0.9) {
                // Perfect carrier match - accept with boost
                adjustedScore = Math.min(1.0, matchScore + 0.2);
                shouldAcceptMatch = true;
              }
            }
          } else {
            // For unlocked SKUs, use standard logic
            if (matchScore >= 0.6) {
              shouldAcceptMatch = true;
              adjustedScore = matchScore;
            }
          }
        }
        
        if (shouldAcceptMatch && adjustedScore >= bestScore) {
          // If scores are equal, prefer base SKUs over variants
          let shouldReplace = adjustedScore > bestScore;
          
          if (adjustedScore === bestScore && bestMatch) {
            // Same score - check if current SKU is better (base vs variant)
            const currentIsBase = !row.sku_code.includes('-VG') && !row.sku_code.includes('-ACCEPTABLE') && !row.sku_code.includes('-LIKE') && !row.sku_code.includes('-NEW') && !row.sku_code.includes('-EXCELLENT') && !row.sku_code.includes('-GOOD') && !row.sku_code.includes('-FAIR');
            const bestIsBase = !bestMatch.sku_code.includes('-VG') && !bestMatch.sku_code.includes('-ACCEPTABLE') && !bestMatch.sku_code.includes('-LIKE') && !bestMatch.sku_code.includes('-NEW') && !bestMatch.sku_code.includes('-EXCELLENT') && !bestMatch.sku_code.includes('-GOOD') && !bestMatch.sku_code.includes('-FAIR');
            
            // Prefer base SKUs over variants
            if (currentIsBase && !bestIsBase) {
              shouldReplace = true;
            }
          }
          
          if (shouldReplace) {
            bestScore = adjustedScore;
            bestMatch = {
              sku_code: row.sku_code,
              post_fix: row.post_fix,
              is_unlocked: row.is_unlocked,
              source_tab: row.source_tab,
              match_score: adjustedScore,
              match_method: this.getMatchMethodFromScore(adjustedScore),
              parsed_info: parsedMasterSku,
              carrier_override: carrierOverride.shouldOverride ? {
                original_carrier: carrier,
                effective_carrier: effectiveCarrier,
                notes: notes
              } : null
            };
          }
        }
      }
      
      return bestMatch;
      
    } finally {
      await client.end();
    }
  }

  // Get comprehensive device data for SKU matching from the view
  async getDeviceDataForMatching(imei) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const query = `
        SELECT 
          imei,
          original_sku,
          sku_matched,
          match_score,
          match_method,
          match_status,
          match_notes,
          match_processed_at,
          brand,
          model,
          carrier,
          capacity,
          color,
          device_notes,
          data_completeness,
          last_activity
        FROM sku_matching_view 
        WHERE imei = $1
      `;
      
      const result = await client.query(query, [imei]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const deviceData = result.rows[0];
      
      return {
        imei: deviceData.imei,
        original_sku: deviceData.original_sku,
        sku_matched: deviceData.sku_matched,
        match_score: deviceData.match_score,
        match_method: deviceData.match_method,
        match_status: deviceData.match_status,
        match_notes: deviceData.match_notes,
        match_processed_at: deviceData.match_processed_at,
        brand: deviceData.brand,
        model: deviceData.model,
        capacity: deviceData.capacity,
        color: deviceData.color,
        carrier: deviceData.carrier,
        device_notes: deviceData.device_notes,
        data_completeness: deviceData.data_completeness,
        last_activity: deviceData.last_activity
      };
      
    } finally {
      await client.end();
    }
  }

  // Get devices that need SKU matching (with sufficient data)
  async getDevicesNeedingSkuMatching(limit = 100, minDataScore = 60) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const query = `
        SELECT 
          imei,
          original_sku,
          brand,
          model,
          capacity,
          color,
          carrier,
          device_notes,
          data_completeness,
          last_activity
        FROM sku_matching_view 
        WHERE data_completeness = 'complete'
          AND original_sku LIKE '%-%-%-%'  -- Generated SKU pattern
          AND imei NOT IN (
            SELECT DISTINCT imei 
            FROM sku_match_log 
            WHERE created_at > NOW() - INTERVAL '7 days'
          )
          -- FILTER OUT FAILED DEVICES
          AND (device_notes IS NULL OR 
               (device_notes NOT LIKE '%FAILED%' 
                AND device_notes NOT LIKE '%FAIL%'
                AND device_notes NOT LIKE '%NO SIM MANAGER%'
                AND device_notes NOT LIKE '%OPENED BACK%'
                AND device_notes NOT LIKE '%OPEN BACK%'
                AND device_notes NOT LIKE '%SCREEN POPED UP%'
                AND device_notes NOT LIKE '%WIFI ISSUES%'))
        ORDER BY data_completeness_score DESC, last_activity DESC
        LIMIT $2
      `;
      
      const result = await client.query(query, [minDataScore, limit]);
      return result.rows;
      
    } finally {
      await client.end();
    }
  }

  // Determine match method based on scores
  getMatchMethod(row, totalScore) {
    if (totalScore >= 45) return 'exact';
    if (totalScore >= 35) return 'fuzzy';
    return 'rule_based';
  }

  // Log SKU match for tracking
  async logSkuMatch(imei, originalSku, matchedSku, matchScore, matchMethod, ruleId = null) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const query = `
        INSERT INTO sku_match_log (imei, original_sku, matched_sku, match_score, match_method, applied_rule_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
        imei,
        originalSku,
        matchedSku,
        matchScore,
        matchMethod,
        ruleId
      ]);
    } finally {
      await client.end();
    }
  }

  // Get SKU match statistics
  async getMatchStats() {
    const client = this.createClient();
    await client.connect();
    
    try {
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total_matches,
          COUNT(CASE WHEN match_score >= 0.9 THEN 1 END) as exact_matches,
          COUNT(CASE WHEN match_score >= 0.7 AND match_score < 0.9 THEN 1 END) as fuzzy_matches,
          COUNT(CASE WHEN match_score < 0.7 THEN 1 END) as rule_based_matches,
          AVG(match_score) as avg_match_score,
          MAX(created_at) as last_match
        FROM sku_match_log
      `);
      
      const recentMatches = await client.query(`
        SELECT imei, original_sku, matched_sku, match_score, match_method, created_at
        FROM sku_match_log 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      return {
        stats: stats.rows[0],
        recentMatches: recentMatches.rows
      };
    } finally {
      await client.end();
    }
  }

  // Generate SKU from device data (same logic as in queue processor)
  generateSkuFromDeviceData(brand, model, capacity, color, carrier) {
    const cleanModel = (model || '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const cleanCapacity = (capacity || '').toString().replace(/\s+/g, '').toUpperCase();
    
    // Enhanced color processing
    let cleanColor = (color || '').replace(/\s+/g, '').toUpperCase();
    
    // Handle Phantom colors properly
    if (cleanColor.includes('PHANTOM')) {
      if (cleanColor.includes('PHANTOMBLACK')) cleanColor = 'BLK';
      else if (cleanColor.includes('PHANTOMGREEN')) cleanColor = 'GRN';
      else if (cleanColor.includes('PHANTOMBLUE')) cleanColor = 'BLU';
      else if (cleanColor.includes('PHANTOMWHITE')) cleanColor = 'WHT';
      else if (cleanColor.includes('PHANTOMRED')) cleanColor = 'RED';
      else if (cleanColor === 'PHA' || cleanColor === 'PHANTOM') cleanColor = 'UNKNOWN';
      else cleanColor = 'UNKNOWN';
    } else {
      // For non-phantom colors, apply the 10-character limit
      if (cleanColor.length > 10) {
        cleanColor = cleanColor.substring(0, 10);
      }
    }
    
    // Enhanced carrier processing
    let cleanCarrier = 'UNLOCKED';
    if (carrier && carrier.trim() !== '') {
      cleanCarrier = carrier.replace(/\s+/g, '').toUpperCase();
      if (cleanCarrier.length > 10) {
        cleanCarrier = cleanCarrier.substring(0, 10);
      }
    }
    
    return `${cleanModel}-${cleanCapacity}-${cleanColor}-${cleanCarrier}`;
  }

  // Calculate similarity between two SKUs
  calculateSkuSimilarity(sku1, sku2) {
    if (!sku1 || !sku2) return 0;
    
    const parts1 = sku1.split('-');
    const parts2 = sku2.split('-');
    
    if (parts1.length !== parts2.length) return 0;
    
    let matches = 0;
    for (let i = 0; i < parts1.length; i++) {
      if (parts1[i] === parts2[i]) {
        matches++;
      } else if (this.isSimilarComponent(parts1[i], parts2[i])) {
        matches += 0.8; // Partial match
      }
    }
    
    return matches / parts1.length;
  }

  // Check if two components are similar
  isSimilarComponent(comp1, comp2) {
    if (!comp1 || !comp2) return false;
    
    // Handle common variations
    const variations = {
      'UNLOCKED': ['UNL', 'UNLOCKED'],
      'UNL': ['UNLOCKED', 'UNL'],
      'BLK': ['BLACK', 'BLK'],
      'BLACK': ['BLK', 'BLACK'],
      'GRN': ['GREEN', 'GRN'],
      'GREEN': ['GRN', 'GREEN'],
      'WHT': ['WHITE', 'WHT'],
      'WHITE': ['WHT', 'WHITE'],
      // Add carrier variations
      'AT&T': ['ATT', 'AT&T', 'AT&T WIRELESS'],
      'ATT': ['AT&T', 'ATT', 'AT&T WIRELESS'],
      'T-MOBILE': ['TMOBILE', 'T-MOBILE', 'TMO'],
      'TMOBILE': ['T-MOBILE', 'TMOBILE', 'TMO'],
      'VERIZON': ['VERIZON', 'VZW', 'VERIZON WIRELESS'],
      'VZW': ['VERIZON', 'VZW', 'VERIZON WIRELESS']
    };
    
    const comp1Upper = comp1.toUpperCase();
    const comp2Upper = comp2.toUpperCase();
    
    if (comp1Upper === comp2Upper) return true;
    
    const comp1Variations = variations[comp1Upper] || [];
    const comp2Variations = variations[comp2Upper] || [];
    
    return comp1Variations.includes(comp2Upper) || comp2Variations.includes(comp1Upper);
  }

  // Get match method from score
  getMatchMethodFromScore(score) {
    if (score >= 0.95) return 'exact';
    if (score >= 0.8) return 'fuzzy';
    if (score >= 0.6) return 'rule_based';
    return 'partial';
  }

  // Parse SKU code to extract device information
  parseSkuCode(skuCode) {
    if (!skuCode) return { brand: '', model: '', capacity: '', color: '', carrier: '' };
    
    const sku = skuCode.trim().toUpperCase();
    const parts = sku.split('-');
    
    // Handle different SKU formats
    if (sku.includes('GL10DH') || sku.includes('3H185LL') || sku.includes('3YL92LL')) {
      // Apple internal codes - these are harder to parse
      return this.parseAppleInternalCode(sku);
    } else if (parts.length >= 3) {
      // Standard format like A15-128-BLK-ATT
      return this.parseStandardSku(parts);
    } else {
      // Generic codes - try to extract what we can
      return this.parseGenericSku(sku);
    }
  }

  // Parse Apple internal codes
  parseAppleInternalCode(sku) {
    // These are Apple's internal codes - we'll need a mapping table
    // For now, return basic info
    return {
      brand: 'Apple',
      model: 'Unknown',
      capacity: 'Unknown',
      color: 'Unknown',
      carrier: 'Unknown'
    };
  }

  // Parse standard SKU format (e.g., A15-128-BLK-ATT, FOLD3-256-BLK)
  parseStandardSku(parts) {
    const result = {
      brand: '',
      model: '',
      capacity: '',
      color: '',
      carrier: ''
    };

    if (parts.length >= 1) {
      // First part is usually model
      result.model = parts[0];
      
      // Detect brand from model
      if (result.model.startsWith('A') || result.model.startsWith('IP')) {
        result.brand = 'Apple';
      } else if (result.model.includes('GALAXY') || result.model.includes('SAMSUNG') || result.model.includes('FOLD')) {
        result.brand = 'Samsung';
        // Convert FOLD3 to Galaxy Z Fold3 for better matching
        if (result.model === 'FOLD3') {
          result.model = 'Galaxy Z Fold3';
        }
      } else if (result.model.includes('PIXEL') || result.model.includes('GOOGLE')) {
        result.brand = 'Google';
      }
    }

    if (parts.length >= 2) {
      // Second part is usually capacity
      const capacityPart = parts[1];
      if (capacityPart.includes('GB') || capacityPart.includes('TB') || /^\d+$/.test(capacityPart)) {
        // Convert numeric capacity to GB format
        if (/^\d+$/.test(capacityPart)) {
          result.capacity = `${capacityPart}GB`;
        } else {
          result.capacity = capacityPart;
        }
      }
    }

    if (parts.length >= 3) {
      // Third part is usually color
      const colorPart = parts[2];
      result.color = this.normalizeColor(colorPart);
    }

    if (parts.length >= 4) {
      // Fourth part is usually carrier (ignore post-fix fields like -VG, -ACCEPTABLE, etc.)
      const carrierPart = parts[3];
      
      // Check if this is a post-fix field (condition/notes) rather than carrier
      const postFixPatterns = ['VG', 'ACCEPTABLE', 'LIKE', 'NEW', 'EXCELLENT', 'GOOD', 'FAIR'];
      const isPostFix = postFixPatterns.some(pattern => 
        carrierPart.toUpperCase().includes(pattern)
      );
      
      if (isPostFix) {
        // This is a post-fix field, not a carrier - look for carrier in earlier parts
        if (parts.length >= 5) {
          result.carrier = parts[4]; // Carrier might be in 5th position
        }
        // If no carrier found, leave as empty (unlocked)
      } else {
        // This is a carrier field
        result.carrier = carrierPart;
      }
    }

    return result;
  }

  // Parse generic SKU codes
  parseGenericSku(sku) {
    return {
      brand: 'Unknown',
      model: 'Unknown',
      capacity: 'Unknown',
      color: 'Unknown',
      carrier: 'Unknown'
    };
  }

  // Calculate similarity between device characteristics
  calculateDeviceSimilarity(device1, device2) {
    let totalScore = 0;
    let maxScore = 0;

    // Brand comparison (weight: 15%)
    const brandScore = this.compareField(device1.brand, device2.brand);
    totalScore += brandScore * 0.15;
    maxScore += 0.15;

    // Model comparison (weight: 25%)
    const modelScore = this.compareField(device1.model, device2.model);
    totalScore += modelScore * 0.25;
    maxScore += 0.25;

    // Capacity comparison (weight: 15%)
    const capacityScore = this.compareField(device1.capacity, device2.capacity);
    totalScore += capacityScore * 0.15;
    maxScore += 0.15;

    // Color comparison (weight: 10%)
    const colorScore = this.compareField(device1.color, device2.color);
    totalScore += colorScore * 0.10;
    maxScore += 0.10;

    // Carrier comparison (weight: 35%) - MUCH HIGHER WEIGHT
    const carrierScore = this.compareField(device1.carrier, device2.carrier);
    totalScore += carrierScore * 0.35;
    maxScore += 0.35;

    // Apply carrier bonus: If carriers match, boost the score significantly
    let finalScore = totalScore / maxScore;
    
    if (carrierScore >= 0.8) { // Good carrier match
      // Boost score by up to 20% for carrier match
      const carrierBonus = carrierScore * 0.2;
      finalScore = Math.min(1.0, finalScore + carrierBonus);
    } else if (carrierScore < 0.3) { // Poor carrier match
      // Penalize score by up to 15% for poor carrier match
      const carrierPenalty = (0.3 - carrierScore) * 0.15;
      finalScore = Math.max(0, finalScore - carrierPenalty);
    }

    return finalScore;
  }

  // Check if carrier is unlocked
  isUnlockedCarrier(carrier) {
    if (!carrier) return true; // Empty carrier = unlocked
    const carrierUpper = carrier.toString().toUpperCase().trim();
    return carrierUpper === 'UNLOCKED' || carrierUpper === 'UNL' || carrierUpper === '';
  }

  // Get device notes from device_test table
  async getDeviceNotes(imei) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const query = `
        SELECT notes
        FROM device_test 
        WHERE imei = $1
      `;
      
      const result = await client.query(query, [imei]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].notes;
    } finally {
      await client.end();
    }
  }

  // Parse notes to determine carrier override
  parseNotesForCarrierOverride(notes, brand, carrier) {
    if (!notes) return { shouldOverride: false, newCarrier: carrier };
    
    const notesUpper = notes.toUpperCase().trim();
    const brandUpper = (brand || '').toUpperCase().trim();
    
    // Check for failed devices - these should not be processed
    if (notesUpper.includes('FAILED') || 
        notesUpper.includes('FAIL') ||
        notesUpper.includes('NO SIM MANAGER') ||
        notesUpper.includes('OPENED BACK') ||
        notesUpper.includes('OPEN BACK') ||
        notesUpper.includes('SCREEN POPED UP') ||
        notesUpper.includes('WIFI ISSUES')) {
      return { shouldOverride: false, newCarrier: carrier, isFailed: true };
    }
    
    // Samsung devices - check for carrier unlock/lock patterns
    if (brandUpper.includes('SAMSUNG') || brandUpper.includes('GALAXY')) {
      // Check for carrier unlock patterns
      if (notesUpper.includes('CARRIER UNLOCKED') || 
          notesUpper.includes('UNLOCKED') ||
          notesUpper.includes('UNLOCK') ||
          notesUpper.includes('CARRIR UNLOCK') || // Common typo
          notesUpper.includes('CARRIERS UNLOCKED')) {
        
        // Only override if original carrier is one of the big 3
        const originalCarrier = (carrier || '').toUpperCase().trim();
        if (originalCarrier === 'AT&T' || originalCarrier === 'T-MOBILE' || originalCarrier === 'VERIZON' || originalCarrier === 'ATT' || originalCarrier === 'TMOBILE' || originalCarrier === 'VZW') {
          return { shouldOverride: true, newCarrier: 'UNLOCKED' };
        }
      }
      
      // Check for carrier locked patterns
      if (notesUpper.includes('CARRIER LOCKED') || 
          notesUpper.includes('LOCKED') ||
          notesUpper.includes('LOCK')) {
        return { shouldOverride: false, newCarrier: carrier }; // Keep original carrier
      }
    }
    
    // Google Pixel devices - check for ESIM locked patterns
    if (brandUpper.includes('GOOGLE') || brandUpper.includes('PIXEL')) {
      if (notesUpper.includes('ESIM LOCKED') || 
          notesUpper.includes('E-SIM LOCKED') ||
          notesUpper.includes('ESIM LOCK') ||
          notesUpper.includes('E-SIM LOCK')) {
        
        // Only override if original carrier is one of the big 3
        const originalCarrier = (carrier || '').toUpperCase().trim();
        if (originalCarrier === 'AT&T' || originalCarrier === 'T-MOBILE' || originalCarrier === 'VERIZON' || originalCarrier === 'ATT' || originalCarrier === 'TMOBILE' || originalCarrier === 'VZW') {
          return { shouldOverride: true, newCarrier: 'UNLOCKED' };
        }
      }
    }
    
    return { shouldOverride: false, newCarrier: carrier };
  }

  // Get device brand from model
  getBrandFromModel(model) {
    if (!model) return '';
    
    const modelUpper = model.toUpperCase().trim();
    
    if (modelUpper.includes('GALAXY') || modelUpper.includes('SAMSUNG') || modelUpper.includes('FOLD')) {
      return 'Samsung';
    } else if (modelUpper.includes('PIXEL') || modelUpper.includes('GOOGLE')) {
      return 'Google';
    } else if (modelUpper.startsWith('A') || modelUpper.startsWith('IP')) {
      return 'Apple';
    }
    
    return '';
  }

  // Calculate similarity with carrier-specific logic
  calculateDeviceSimilarityWithCarrierLogic(device1, device2, isDeviceUnlocked) {
    let totalScore = 0;
    let maxScore = 0;

    // Brand comparison (weight: 10%)
    const brandScore = this.compareField(device1.brand, device2.brand);
    totalScore += brandScore * 0.10;
    maxScore += 0.10;

    // Model comparison (weight: 20%)
    const modelScore = this.compareField(device1.model, device2.model);
    totalScore += modelScore * 0.20;
    maxScore += 0.20;

    // Capacity comparison (weight: 15%)
    const capacityScore = this.compareField(device1.capacity, device2.capacity);
    totalScore += capacityScore * 0.15;
    maxScore += 0.15;

    // Color comparison (weight: 10%)
    const colorScore = this.compareField(device1.color, device2.color);
    totalScore += colorScore * 0.10;
    maxScore += 0.10;

    // Carrier comparison with business logic (weight: 45%) - MUCH HIGHER WEIGHT
    const carrierScore = this.compareCarrierWithLogic(device1.carrier, device2.carrier, isDeviceUnlocked);
    totalScore += carrierScore * 0.45;
    maxScore += 0.45;

    // Calculate base score
    let finalScore = totalScore / maxScore;
    
    // MODEL PENALTY - Heavily penalize poor model matches
    if (modelScore < 0.3) {
      // Very poor model match - heavy penalty
      const modelPenalty = (0.3 - modelScore) * 0.70; // 70% penalty for poor model
      finalScore = Math.max(0, finalScore - modelPenalty);
    } else if (modelScore < 0.5) {
      // Poor model match - moderate penalty
      const modelPenalty = (0.5 - modelScore) * 0.40; // 40% penalty for poor model
      finalScore = Math.max(0, finalScore - modelPenalty);
    }
    
    // FIELD COUNT NORMALIZATION - Fix bias between 3-field and 4-field SKUs
    const hasCarrierField = device2.carrier && device2.carrier.trim() !== '';
    const isCarrierSpecificSku = hasCarrierField;
    
    // Apply field count normalization with BALANCED bonuses
    if (isCarrierSpecificSku) {
      // For 4-field SKUs (with carrier), give bonus for carrier match
      if (carrierScore >= 0.9) {
        // Perfect carrier match in 4-field SKU - MODERATE boost
        const carrierBonus = carrierScore * 0.25; // 25% boost (reduced from 40%)
        finalScore = Math.min(1.0, finalScore + carrierBonus);
      } else if (carrierScore >= 0.7) {
        // Good carrier match in 4-field SKU - small boost
        const carrierBonus = carrierScore * 0.15; // 15% boost (reduced from 20%)
        finalScore = Math.min(1.0, finalScore + carrierBonus);
      } else if (carrierScore < 0.3) {
        // Poor carrier match in 4-field SKU - heavy penalty
        const carrierPenalty = (0.3 - carrierScore) * 0.50; // 50% penalty
        finalScore = Math.max(0, finalScore - carrierPenalty);
      }
    } else {
      // For 3-field SKUs (no carrier), apply different logic
      if (isDeviceUnlocked) {
        // Device is unlocked and SKU has no carrier - this is perfect
        if (carrierScore >= 0.9) {
          // Perfect match for unlocked device with unlocked SKU
          const unlockBonus = carrierScore * 0.20; // 20% boost (reduced from 30%)
          finalScore = Math.min(1.0, finalScore + unlockBonus);
        }
      } else {
        // Device has carrier but SKU has no carrier - this is wrong
        if (carrierScore < 0.3) {
          // Heavy penalty for carrier device matching unlocked SKU
          const carrierPenalty = (0.3 - carrierScore) * 0.60; // 60% penalty
          finalScore = Math.max(0, finalScore - carrierPenalty);
        }
      }
    }

    // BASE SKU PRIORITY BONUS - Give slight preference to base SKUs over variants
    const postFixPatterns = ['-VG', '-ACCEPTABLE', '-LIKE', '-NEW', '-EXCELLENT', '-GOOD', '-FAIR'];
    const hasPostFix = postFixPatterns.some(pattern => device2.model && device2.model.includes(pattern));
    
    if (!hasPostFix) {
      // This is a base SKU - give a small bonus
      finalScore = Math.min(1.0, finalScore + 0.001); // Tiny bonus to break ties
    }

    return finalScore;
  }

  // Compare carrier with business logic
  compareCarrierWithLogic(deviceCarrier, masterCarrier, isDeviceUnlocked) {
    const deviceCarrierUpper = (deviceCarrier || '').toString().toUpperCase().trim();
    const masterCarrierUpper = (masterCarrier || '').toString().toUpperCase().trim();
    
    // Case 1: Device is unlocked
    if (isDeviceUnlocked) {
      // Device should match with master SKUs that have NO carrier field (unlocked)
      if (!masterCarrierUpper || masterCarrierUpper === '') {
        return 1.0; // Perfect match - unlocked device with unlocked SKU
      }
      if (masterCarrierUpper === 'UNLOCKED' || masterCarrierUpper === 'UNL') {
        return 1.0; // Perfect match - unlocked device with unlocked SKU
      }
      return 0.1; // Poor match - unlocked device with carrier-specific SKU
    }
    
    // Case 2: Device has specific carrier
    else {
      // Device should match with master SKUs that have matching carrier field
      if (!masterCarrierUpper || masterCarrierUpper === '') {
        return 0.1; // Poor match - carrier device with unlocked SKU
      }
      if (masterCarrierUpper === 'UNLOCKED' || masterCarrierUpper === 'UNL') {
        return 0.1; // Poor match - carrier device with unlocked SKU
      }
      
      // Compare specific carriers - handle common variations
      if (deviceCarrierUpper === masterCarrierUpper) {
        return 1.0; // Perfect match
      }
      
      // Handle common carrier abbreviations and variations
      const carrierVariations = {
        'AT&T': ['ATT', 'AT&T', 'AT&T WIRELESS'],
        'ATT': ['AT&T', 'ATT', 'AT&T WIRELESS'],
        'T-MOBILE': ['TMOBILE', 'T-MOBILE', 'TMO'],
        'TMOBILE': ['T-MOBILE', 'TMOBILE', 'TMO'],
        'VERIZON': ['VERIZON', 'VZW', 'VERIZON WIRELESS'],
        'VZW': ['VERIZON', 'VZW', 'VERIZON WIRELESS']
      };
      
      // Check if carriers match through variations
      const deviceVariations = carrierVariations[deviceCarrierUpper] || [deviceCarrierUpper];
      const masterVariations = carrierVariations[masterCarrierUpper] || [masterCarrierUpper];
      
      // Check if there's any overlap in variations
      for (const deviceVar of deviceVariations) {
        for (const masterVar of masterVariations) {
          if (deviceVar === masterVar) {
            return 1.0; // Perfect match through variations
          }
        }
      }
      
      // Check for carrier variations using existing logic
      if (this.isSimilarComponent(deviceCarrierUpper, masterCarrierUpper)) {
        return 0.8; // Good match
      }
      
      // Check for partial matches
      if (deviceCarrierUpper.includes(masterCarrierUpper) || masterCarrierUpper.includes(deviceCarrierUpper)) {
        return 0.6; // Partial match
      }
      
      return 0.2; // Poor match
    }
  }

  // Compare individual fields
  compareField(field1, field2) {
    if (!field1 || !field2) return 0;
    
    const f1 = field1.toString().toUpperCase().trim();
    const f2 = field2.toString().toUpperCase().trim();
    
    if (f1 === f2) return 1.0;
    
    // Special handling for brand - if one is "Unknown" and the other is a real brand, give partial credit
    if ((f1 === 'UNKNOWN' && f2 !== 'UNKNOWN') || (f2 === 'UNKNOWN' && f1 !== 'UNKNOWN')) {
      return 0.5; // Partial credit for brand detection
    }
    
    // Check for partial matches
    if (f1.includes(f2) || f2.includes(f1)) return 0.8;
    
    // Check for similar variations
    if (this.isSimilarComponent(f1, f2)) return 0.6;
    
    return 0;
  }
}

module.exports = SkuMatchingService;
