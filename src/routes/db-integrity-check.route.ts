import { Router } from 'express';
import { Pool } from 'pg';
import { DbIntegrityCheckController } from '../controllers/db-integrity-check.controller';
import { logger } from '../utils/logger';

const router = Router();

// Initialize database pool using DIRECT_URL (Supabase connection)
// Note: Supabase MCP tools can be used for verification/testing via AI assistant
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false }
});

// Initialize controller
const integrityCheckController = new DbIntegrityCheckController(pool);

// Log connection status
logger.info('DB Integrity Check routes initialized', {
  usingSupabase: !!process.env['DIRECT_URL'],
  connectionType: 'Direct PostgreSQL Pool'
});

// Get statistics about missing data
router.get('/stats', integrityCheckController.getStats);

// Scan for records with missing data (read-only)
router.post('/scan', integrityCheckController.scanMissingData);

// Run complete integrity check (scan + process)
router.post('/run', integrityCheckController.runIntegrityCheck);

// Process specific IMEIs
router.post('/process-imeis', integrityCheckController.processSpecificImeis);

export default router;
