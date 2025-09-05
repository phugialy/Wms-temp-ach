const express = require('express');
const OperatorService = require('../services/OperatorService');
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
        
        res.json({
            success: true,
            device
        });
        
    } catch (error) {
        console.error('Error fetching device info:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing shipping pickup:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing postfix update:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing repair update:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error processing inspector update:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get recent operator actions
 */
router.get('/recent-actions', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const actions = await operatorService.getRecentActions(parseInt(limit));
        
        res.json({
            success: true,
            actions
        });
        
    } catch (error) {
        console.error('Error fetching recent actions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get available locations
 */
router.get('/locations', async (req, res) => {
    try {
        const locations = operatorService.getAvailableLocations();
        
        res.json({
            success: true,
            locations
        });
        
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get postfix options
 */
router.get('/postfix-options', async (req, res) => {
    try {
        const options = operatorService.getPostfixOptions();
        
        res.json({
            success: true,
            options
        });
        
    } catch (error) {
        console.error('Error fetching postfix options:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

