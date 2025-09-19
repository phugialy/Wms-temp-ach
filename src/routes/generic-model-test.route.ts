import { Router, Request, Response } from 'express';
import { HybridSkuMatchingService } from '../services/HybridSkuMatchingService';
import { DatabaseConnectionService } from '../services/DatabaseConnectionService';

const router = Router();
const hybridSkuMatchingService = new HybridSkuMatchingService();
const dbService = DatabaseConnectionService.getInstance();

// Test endpoint for generic model matching
router.post('/test-generic-matching', async (req: Request, res: Response): Promise<void> => {
    try {
        const { testCases } = req.body;
        
        if (!testCases || !Array.isArray(testCases)) {
            res.status(400).json({
                success: false,
                error: 'testCases array is required'
            });
            return;
        }

        const results = [];
        
        for (const testCase of testCases) {
            try {
                const result = await runGenericModelTest(testCase);
                results.push(result);
            } catch (error) {
                results.push({
                    name: testCase.name,
                    passed: false,
                    error: error instanceof Error ? error.message : String(error),
                    input: testCase.input,
                    expectedSku: testCase.expectedSku,
                    actualMatches: [],
                    shouldMatch: testCase.shouldMatch
                });
            }
        }
        
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        const accuracy = total > 0 ? (passed / total * 100) : 0;
        
        res.json({
            success: true,
            results,
            summary: {
                total,
                passed,
                failed: total - passed,
                accuracy: parseFloat(accuracy.toFixed(1))
            }
        });
        
    } catch (error) {
        console.error('Generic model test error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Single device test endpoint
router.post('/test-device', async (req: Request, res: Response): Promise<void> => {
    try {
        const { imei, brand, model, capacity, color, carrier, device_notes } = req.body;
        
        if (!imei || !brand || !model) {
            res.status(400).json({
                success: false,
                error: 'imei, brand, and model are required'
            });
            return;
        }
        
        const deviceData = {
            imei,
            brand,
            model,
            capacity: capacity || '',
            color: color || '',
            carrier: carrier || '',
            device_notes: device_notes || ''
        };
        
        const result = await hybridSkuMatchingService.matchImeiToSku(deviceData);
        
        res.json({
            success: true,
            matches: result.matches,
            totalMatches: result.totalMatches,
            highestScore: result.highestScore,
            requiresAttention: result.requiresAttention,
            isUndefined: result.isUndefined,
            processingTime: result.processingTime
        });
        
    } catch (error) {
        console.error('Device test error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get available SKUs for testing
router.get('/available-skus', async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT DISTINCT 
                sku_code,
                brand,
                model,
                capacity,
                color,
                carrier
            FROM sku_master 
            WHERE is_active = true 
            ORDER BY brand, model, capacity, color, carrier
            LIMIT 100
        `;
        
        const result = await dbService.query(query, []);
        
        res.json({
            success: true,
            skus: result.rows
        });
        
    } catch (error) {
        console.error('Available SKUs error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Test specific model number extraction
router.post('/test-model-numbers', async (req: Request, res: Response): Promise<void> => {
    try {
        const { models } = req.body;
        
        if (!models || !Array.isArray(models)) {
            res.status(400).json({
                success: false,
                error: 'models array is required'
            });
            return;
        }
        
        const results = models.map(model => {
            const numbers = extractModelNumbers(model);
            return {
                model,
                numbers,
                hasNumbers: numbers.length > 0,
                firstNumber: numbers.length > 0 ? numbers[0] : null
            };
        });
        
        res.json({
            success: true,
            results
        });
        
    } catch (error) {
        console.error('Model number test error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

async function runGenericModelTest(testCase: any) {
    const deviceData = {
        imei: 'TEST_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        brand: testCase.input.brand,
        model: testCase.input.model,
        capacity: testCase.input.capacity || '',
        color: testCase.input.color || '',
        carrier: testCase.input.carrier || '',
        device_notes: 'Generic model matching test'
    };
    
    const result = await hybridSkuMatchingService.matchImeiToSku(deviceData);
    const matches = result.matches || [];
    const hasMatch = matches.length > 0;
    
    let passed = true;
    let error = null;
    
    if (testCase.shouldMatch !== null) {
        if (testCase.shouldMatch && !hasMatch) {
            passed = false;
            error = 'Expected match but got no matches';
        } else if (!testCase.shouldMatch && hasMatch) {
            passed = false;
            error = `Expected no match but got ${matches.length} matches`;
        }
    }
    
    // If we have an expected SKU, check if it's in the matches
    if (testCase.expectedSku && hasMatch) {
        const hasExpectedSku = matches.some(match => 
            match.sku_code === testCase.expectedSku
        );
        if (!hasExpectedSku) {
            passed = false;
            error = `Expected SKU ${testCase.expectedSku} not found in matches`;
        }
    }
    
    return {
        name: testCase.name,
        passed,
        error,
        input: testCase.input,
        expectedSku: testCase.expectedSku,
        actualMatches: matches,
        shouldMatch: testCase.shouldMatch,
        matchCount: matches.length,
        highestScore: matches.length > 0 ? matches[0].match_score : 0,
        processingTime: result.processingTime
    };
}

function extractModelNumbers(model: string): number[] {
    const numbers = model.match(/\d+/g);
    return numbers ? numbers.map(n => parseInt(n, 10)) : [];
}

export default router;
