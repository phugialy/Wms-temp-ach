import express from 'express';
import { HybridSkuMatchingService } from '../services/HybridSkuMatchingService';
import { logger } from '../utils/logger';

const router = express.Router();
const hybridSkuService = new HybridSkuMatchingService();

// Initialize service
hybridSkuService.initialize().catch(error => {
  logger.error('Failed to initialize Hybrid SKU Matching Service:', error);
});

// POST /api/hybrid-sku-matching/match - Main matching endpoint
router.post('/match', async (req, res): Promise<void> => {
  try {
    const { imei, brand, model, capacity, color, carrier, device_notes, minScore, maxResults } = req.body;

    if (!imei) {
      res.status(400).json({ 
        success: false, 
        error: 'IMEI is required' 
      });
      return;
    }

    logger.info(`🔍 HYBRID MATCHING: Processing device ${imei}`);

    const imeiData = {
      imei,
      brand: brand || '',
      model: model || '',
      capacity: capacity || '',
      color: color || '',
      carrier: carrier || '',
      device_notes: device_notes || ''
    };

    const options = {
      minScore: minScore || 40,
      maxResults: maxResults || 10
    };

    const result = await hybridSkuService.matchImeiToSku(imeiData, options);

    res.json({
      success: true,
      data: {
        imei: imeiData.imei,
        input: {
          brand: imeiData.brand,
          model: imeiData.model,
          capacity: imeiData.capacity,
          color: imeiData.color,
          carrier: imeiData.carrier,
          device_notes: imeiData.device_notes
        },
        results: {
          totalMatches: result.totalMatches,
          highestScore: result.highestScore,
          matchType: result.matchType,
          processingTime: result.processingTime,
          requiresAttention: result.requiresAttention,
          isUndefined: result.isUndefined,
          undefinedReason: result.undefinedReason,
          confidenceLevel: result.matches.length > 0 ? 
            (result.matches[0].confidence_level || 'UNKNOWN') : 'NO_MATCH'
        },
        matches: result.matches.map((match: any) => ({
          sku_code: match.sku_code,
          sku_tags: match.sku_tags,
          brand: match.brand,
          model: match.model,
          capacity: match.capacity,
          color: match.color,
          carrier: match.carrier,
          post_fix: match.post_fix,
          device_type: match.device_type,
          match_score: match.match_score,
          match_type: match.match_type,
          confidence_level: match.confidence_level,
          // Individual tag breakdown
          tag_breakdown: {
            brand_tag: match.brand_tag,
            model_tag: match.model_tag,
            capacity_tag: match.capacity_tag,
            color_tag: match.color_tag,
            carrier_tag: match.carrier_tag,
            postfix_tag: match.postfix_tag
          }
        }))
      }
    });

  } catch (error) {
    logger.error('❌ HYBRID MATCHING ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during SKU matching',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/hybrid-sku-matching/bulk-match - Bulk matching endpoint
router.post('/bulk-match', async (req, res): Promise<void> => {
  try {
    const { devices, options } = req.body;

    if (!devices || !Array.isArray(devices)) {
      res.status(400).json({ 
        success: false, 
        error: 'Devices array is required' 
      });
      return;
    }

    logger.info(`🔍 HYBRID BULK MATCHING: Processing ${devices.length} devices`);

    const matchOptions = {
      minScore: options?.minScore || 40,
      maxResults: options?.maxResults || 10
    };

    const results = [];
    const startTime = Date.now();

    for (const device of devices) {
      try {
        const imeiData = {
          imei: device.imei,
          brand: device.brand || '',
          model: device.model || '',
          capacity: device.capacity || '',
          color: device.color || '',
          carrier: device.carrier || '',
          device_notes: device.device_notes || ''
        };

        const result = await hybridSkuService.matchImeiToSku(imeiData, matchOptions);
        
        results.push({
          imei: imeiData.imei,
          brand: imeiData.brand,
          model: imeiData.model,
          capacity: imeiData.capacity,
          color: imeiData.color,
          carrier: imeiData.carrier,
          success: true,
          totalMatches: result.totalMatches,
          highestScore: result.highestScore,
          requiresAttention: result.requiresAttention,
          processingTime: result.processingTime,
          topMatch: result.matches.length > 0 ? result.matches[0] : null,
          matches: result.matches.slice(0, 3) // Top 3 matches only for bulk
        });

      } catch (error) {
        results.push({
          imei: device.imei,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const successfulMatches = results.filter(r => r.success).length;
    const requiresAttention = results.filter(r => r.success && r.requiresAttention).length;

    res.json({
      success: true,
      data: {
        summary: {
          totalDevices: devices.length,
          successfulMatches,
          requiresAttention,
          totalProcessingTime,
          averageProcessingTime: Math.round(totalProcessingTime / devices.length)
        },
        results
      }
    });

  } catch (error) {
    logger.error('❌ HYBRID BULK MATCHING ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during bulk SKU matching',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/hybrid-sku-matching/filtered - Get filtered SKUs with postfix filtering
router.post('/filtered', async (req, res): Promise<void> => {
  try {
    const { device, filterPostfix } = req.body;

    if (!device || !device.imei) {
      res.status(400).json({ 
        success: false, 
        error: 'Device with IMEI is required' 
      });
      return;
    }

    logger.info(`🔍 HYBRID FILTERED MATCHING: Processing device ${device.imei}`);

    const result = await hybridSkuService.getFilteredSkus(device, filterPostfix || false);

    res.json({
      success: true,
      data: {
        imei: device.imei,
        filterPostfix,
        totalSkus: result.skus.length,
        requiresAttention: result.requiresAttention,
        skus: result.skus.map((sku: any) => ({
          sku_code: sku.sku_code,
          sku_tags: sku.sku_tags,
          brand: sku.brand,
          model: sku.model,
          capacity: sku.capacity,
          color: sku.color,
          carrier: sku.carrier,
          post_fix: sku.post_fix,
          device_type: sku.device_type,
          match_score: sku.match_score,
          match_type: sku.match_type,
          confidence_level: sku.confidence_level
        }))
      }
    });

  } catch (error) {
    logger.error('❌ HYBRID FILTERED MATCHING ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during filtered SKU matching',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/hybrid-sku-matching/test - Test endpoint with sample data
router.get('/test', async (req, res): Promise<void> => {
  try {
    const testDevices = [
      {
        imei: 'TEST001',
        brand: 'Samsung',
        model: 'Galaxy S22 Ultra',
        capacity: '256GB',
        color: 'Black',
        carrier: 'Unlocked',
        device_notes: 'Excellent condition'
      },
      {
        imei: 'TEST002',
        brand: 'Apple',
        model: 'iPhone 13',
        capacity: '128GB',
        color: 'Blue',
        carrier: 'Verizon',
        device_notes: 'Good condition'
      }
    ];

    logger.info('🧪 HYBRID TEST: Running test with sample devices');

    const results = [];
    for (const device of testDevices) {
      const imeiData = {
        imei: device.imei,
        brand: device.brand,
        model: device.model,
        capacity: device.capacity,
        color: device.color,
        carrier: device.carrier,
        device_notes: device.device_notes
      };

      const result = await hybridSkuService.matchImeiToSku(imeiData, { minScore: 40, maxResults: 5 });
      
      results.push({
        input: imeiData,
        output: {
          totalMatches: result.totalMatches,
          highestScore: result.highestScore,
          requiresAttention: result.requiresAttention,
          processingTime: result.processingTime,
          topMatches: result.matches.slice(0, 3)
        }
      });
    }

    res.json({
      success: true,
      data: {
        testType: 'hybrid_tag_first',
        totalTests: testDevices.length,
        results
      }
    });

  } catch (error) {
    logger.error('❌ HYBRID TEST ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/hybrid-sku-matching/health - Health check endpoint
router.get('/health', async (req, res): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        service: 'HybridSkuMatchingService',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        features: [
          'Tag-first matching',
          'Normalization integration',
          'Progressive scoring',
          'Single query optimization',
          'Pattern matching fallback',
          'Field matching fallback'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Service health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/hybrid-sku-matching/test-interface - Serve test interface
router.get('/test-interface', async (req, res): Promise<void> => {
  try {
    res.redirect('/hybrid-sku-test.html');
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to serve test interface',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
