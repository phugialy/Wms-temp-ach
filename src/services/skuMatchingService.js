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

  // Find best matching SKU for a device
  async findBestMatchingSku(deviceData) {
    const client = this.createClient();
    await client.connect();
    
    try {
      const { brand, model, capacity, color, carrier } = deviceData;
      
      // Normalize carrier
      const normalizedCarrier = await this.normalizeCarrier(carrier);
      
      // Build search query with multiple matching strategies
      const query = `
        SELECT 
          sku_code,
          brand,
          model,
          capacity,
          color,
          carrier,
          post_fix,
          is_unlocked,
          source_tab,
          -- Calculate match scores
          CASE 
            WHEN LOWER(brand) = LOWER($1) THEN 10
            WHEN LOWER(brand) LIKE '%' || LOWER($1) || '%' OR LOWER($1) LIKE '%' || LOWER(brand) || '%' THEN 8
            ELSE 0
          END as brand_score,
          CASE 
            WHEN LOWER(model) = LOWER($2) THEN 10
            WHEN LOWER(model) LIKE '%' || LOWER($2) || '%' OR LOWER($2) LIKE '%' || LOWER(model) || '%' THEN 8
            ELSE 0
          END as model_score,
          CASE 
            WHEN LOWER(capacity) = LOWER($3) THEN 10
            WHEN LOWER(capacity) LIKE '%' || LOWER($3) || '%' OR LOWER($3) LIKE '%' || LOWER(capacity) || '%' THEN 8
            ELSE 0
          END as capacity_score,
          CASE 
            WHEN LOWER(color) = LOWER($4) THEN 10
            WHEN LOWER(color) LIKE '%' || LOWER($4) || '%' OR LOWER($4) LIKE '%' || LOWER(color) || '%' THEN 8
            ELSE 0
          END as color_score,
          CASE 
            WHEN LOWER(carrier) = LOWER($5) THEN 10
            WHEN LOWER(carrier) LIKE '%' || LOWER($5) || '%' OR LOWER($5) LIKE '%' || LOWER(carrier) || '%' THEN 8
            WHEN ($5 = 'Unlocked' OR $5 = 'UNLOCKED') AND is_unlocked = true THEN 10
            ELSE 0
          END as carrier_score
        FROM sku_master 
        WHERE is_active = true
        ORDER BY 
          (brand_score + model_score + capacity_score + color_score + carrier_score) DESC,
          brand_score DESC,
          model_score DESC
        LIMIT 10
      `;
      
      const result = await client.query(query, [
        brand || '',
        model || '',
        capacity || '',
        color || '',
        normalizedCarrier || ''
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Calculate final match scores and find the best match
      let bestMatch = null;
      let bestScore = 0;
      
      for (const row of result.rows) {
        const totalScore = row.brand_score + row.model_score + row.capacity_score + row.color_score + row.carrier_score;
        const maxPossibleScore = 50; // 10 points per field
        const matchScore = totalScore / maxPossibleScore;
        
        // Require at least 60% match (30 out of 50 points)
        if (matchScore >= 0.6 && matchScore > bestScore) {
          bestScore = matchScore;
          bestMatch = {
            sku_code: row.sku_code,
            brand: row.brand,
            model: row.model,
            capacity: row.capacity,
            color: row.color,
            carrier: row.carrier,
            post_fix: row.post_fix,
            is_unlocked: row.is_unlocked,
            source_tab: row.source_tab,
            match_score: matchScore,
            match_method: this.getMatchMethod(row, totalScore)
          };
        }
      }
      
      return bestMatch;
      
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
}

module.exports = SkuMatchingService;
