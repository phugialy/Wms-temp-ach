import { Router, Request, Response } from 'express';
import { SkuManualUpdateService } from '../services/SkuManualUpdateService';
import { logger } from '../utils/logger';

const router = Router();
const skuManualUpdateService = new SkuManualUpdateService();

// Initialize the manual update log table
skuManualUpdateService.createManualUpdateLogTable().catch(error => {
  logger.error('Failed to create manual update log table:', error);
});

/**
 * GET /api/sku-manual-update/review
 * Get SKUs that need manual review
 */
router.get('/review', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const skus = await skuManualUpdateService.getSkusNeedingReview(limit);
    
    res.json({
      success: true,
      count: skus.length,
      skus: skus
    });
    
  } catch (error) {
    logger.error('Error getting SKUs for review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SKUs for review'
    });
  }
});

/**
 * GET /api/sku-manual-update/suggestions/:skuCode
 * Get parsing suggestions for a specific SKU
 */
router.get('/suggestions/:skuCode', async (req: Request, res: Response) => {
  try {
    const { skuCode } = req.params;
    
    if (!skuCode) {
      return res.status(400).json({
        success: false,
        error: 'SKU code is required'
      });
    }
    
    const suggestions = await skuManualUpdateService.getSkuParsingSuggestions(skuCode);
    
    if (suggestions.error) {
      return res.status(404).json({
        success: false,
        error: suggestions.error
      });
    }
    
    return res.json({
      success: true,
      sku_code: skuCode,
      current: suggestions.current,
      suggested: suggestions.suggested,
      needs_update: suggestions.needs_update
    });
    
  } catch (error) {
    logger.error('Error getting SKU suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get SKU suggestions'
    });
  }
});

/**
 * POST /api/sku-manual-update/update
 * Manually update a single SKU
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const updateRequest = req.body;
    
    // Validate required fields
    if (!updateRequest.sku_code) {
      return res.status(400).json({
        success: false,
        error: 'sku_code is required'
      });
    }
    
    const result = await skuManualUpdateService.updateSkuManually(updateRequest);
    
    if (result.success) {
      return res.json({
        success: true,
        message: `SKU ${result.sku_code} updated successfully`,
        changes: result.changes
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    logger.error('Error updating SKU manually:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update SKU'
    });
  }
});

/**
 * POST /api/sku-manual-update/bulk-update
 * Bulk update multiple SKUs using parsing suggestions
 */
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { sku_codes, updated_by } = req.body;
    
    if (!sku_codes || !Array.isArray(sku_codes)) {
      return res.status(400).json({
        success: false,
        error: 'sku_codes array is required'
      });
    }
    
    const results = await skuManualUpdateService.bulkUpdateFromSuggestions(
      sku_codes, 
      updated_by || 'api-user'
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return res.json({
      success: true,
      message: `Bulk update completed: ${successful.length} successful, ${failed.length} failed`,
      results: {
        successful: successful,
        failed: failed
      }
    });
    
  } catch (error) {
    logger.error('Error bulk updating SKUs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk update SKUs'
    });
  }
});

/**
 * POST /api/sku-manual-update/auto-fix-missing
 * Automatically fix SKUs with missing data using parsing suggestions
 */
router.post('/auto-fix-missing', async (req: Request, res: Response) => {
  try {
    const { limit = 100, updated_by = 'auto-fix' } = req.body;
    
    // Get SKUs that need review
    const skusNeedingReview = await skuManualUpdateService.getSkusNeedingReview(limit);
    
    if (skusNeedingReview.length === 0) {
      return res.json({
        success: true,
        message: 'No SKUs need fixing',
        results: {
          successful: [],
          failed: []
        }
      });
    }
    
    // Extract SKU codes
    const skuCodes = skusNeedingReview.map(sku => sku.sku_code);
    
    // Bulk update using suggestions
    const results = await skuManualUpdateService.bulkUpdateFromSuggestions(
      skuCodes, 
      updated_by
    );
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return res.json({
      success: true,
      message: `Auto-fix completed: ${successful.length} successful, ${failed.length} failed`,
      results: {
        successful: successful,
        failed: failed
      }
    });
    
  } catch (error) {
    logger.error('Error auto-fixing SKUs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-fix SKUs'
    });
  }
});

export default router;
