import express from 'express';
import OperatorService from '../services/OperatorService';

const router = express.Router();

// Initialize operator service
const operatorService = new OperatorService();

// Initialize service on startup
operatorService.initialize().catch(console.error);

/**
 * Get device information by IMEI
 */
router.get('/device-info/:imei', async (req, res) => {
    try {
        const { imei } = req.params;
        
        if (!imei || imei.length !== 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IMEI format'
            });
        }
        
        const device = await operatorService.getDeviceInfo(imei);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }
        
        return res.json({
            success: true,
            device
        });
        
    } catch (error) {
        console.error('Error fetching device info:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * SHIPPING: Quick pickup - move device to SHIPOUT
 */
router.post('/shipping-pickup', async (req, res) => {
    try {
        const { imei } = req.body;
        
        if (!imei || imei.length !== 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IMEI format'
            });
        }
        
        const result = await operatorService.shippingQuickPickup(imei);
        
        return res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing shipping pickup:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POSTFIX: Update SKU with grade postfix
 */
router.post('/postfix-update', async (req, res) => {
    try {
        const { imei, grade } = req.body;
        
        if (!imei || imei.length !== 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IMEI format'
            });
        }
        
        if (!grade) {
            return res.status(400).json({
                success: false,
                error: 'Grade is required'
            });
        }
        
        const result = await operatorService.postfixUpdate(imei, grade);
        
        return res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing postfix update:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * REPAIR: Update location and repair notes
 */
router.post('/repair-update', async (req, res) => {
    try {
        const { imei, location, notes } = req.body;
        
        if (!imei || imei.length !== 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IMEI format'
            });
        }
        
        if (!location) {
            return res.status(400).json({
                success: false,
                error: 'Location is required'
            });
        }
        
        const result = await operatorService.repairUpdate(imei, location, notes);
        
        return res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing repair update:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * INSPECTOR: Update device characteristics
 */
router.post('/inspector-update', async (req, res) => {
    try {
        const { imei, updates } = req.body;
        
        if (!imei || imei.length !== 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid IMEI format'
            });
        }
        
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one update is required'
            });
        }
        
        const result = await operatorService.inspectorUpdate(imei, updates);
        
        return res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing inspector update:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get recent operator actions
 */
router.get('/recent-actions', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const actions = await operatorService.getRecentActions(parseInt(limit as string));
        
        return res.json({
            success: true,
            actions
        });
        
    } catch (error) {
        console.error('Error fetching recent actions:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get available locations
 */
router.get('/locations', async (req, res) => {
    try {
        const locations = operatorService.getAvailableLocations();
        
        return res.json({
            success: true,
            locations
        });
        
    } catch (error) {
        console.error('Error fetching locations:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get postfix options
 */
router.get('/postfix-options', async (req, res) => {
    try {
        const options = operatorService.getPostfixOptions();
        
        return res.json({
            success: true,
            options
        });
        
    } catch (error) {
        console.error('Error fetching postfix options:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
