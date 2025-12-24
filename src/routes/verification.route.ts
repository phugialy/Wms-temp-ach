import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const router = Router();

// Initialize database pool using DIRECT_URL (Supabase connection)
const pool = new Pool({
  connectionString: process.env['DIRECT_URL'],
  ssl: { rejectUnauthorized: false },
});

interface VerificationResult {
  imei: string;
  found: boolean;
  deviceData?: {
    imei: string;
    sku?: string;
    brand?: string;
    model?: string;
    capacity?: string;
    color?: string;
    carrier?: string;
    location?: string;
    working?: string;
    created_at?: string;
  };
}

/**
 * POST /api/verification/bulk-verify
 * Verify a list of IMEI/Serial numbers against the database
 */
router.post('/bulk-verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imeis } = req.body;

    if (!imeis || !Array.isArray(imeis) || imeis.length === 0) {
      res.status(400).json({
        success: false,
        error: 'IMEI list is required and must be a non-empty array',
      });
      return;
    }

    // Clean and validate IMEIs (remove whitespace, convert to uppercase)
    const cleanImeis = imeis
      .map((imei: string) => String(imei).trim().toUpperCase())
      .filter((imei: string) => imei.length > 0);

    if (cleanImeis.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid IMEIs provided',
      });
      return;
    }

    // Remove duplicates
    const uniqueImeis = [...new Set(cleanImeis)];

    logger.info('[VerificationRoute] Bulk verification request', {
      total: imeis.length,
      unique: uniqueImeis.length,
    });

    // Query database for all IMEIs at once
    const placeholders = uniqueImeis.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT 
        p.imei,
        p.sku,
        p.brand,
        p.date_in as created_at,
        i.model,
        i.model_number,
        i.capacity,
        i.color,
        i.carrier,
        i.location,
        i.working,
        i.battery_health,
        i.battery_count
      FROM product p
      LEFT JOIN item i ON p.imei = i.imei
      WHERE p.imei = ANY($1::varchar[])
      ORDER BY p.imei
    `;

    const { rows } = await pool.query(query, [uniqueImeis]);

    // Create a map of found IMEIs
    const foundMap = new Map<string, any>();
    rows.forEach((row) => {
      foundMap.set(row.imei, {
        imei: row.imei,
        sku: row.sku || null,
        brand: row.brand || null,
        model: row.model || row.model_number || null,
        capacity: row.capacity || null,
        color: row.color || null,
        carrier: row.carrier || null,
        location: row.location || null,
        working: row.working || null,
        battery_health: row.battery_health || null,
        battery_count: row.battery_count || null,
        created_at: row.created_at || null,
      });
    });

    // Build results array
    const results: VerificationResult[] = uniqueImeis.map((imei) => {
      const deviceData = foundMap.get(imei);
      return {
        imei,
        found: !!deviceData,
        deviceData: deviceData || undefined,
      };
    });

    const matched = results.filter((r) => r.found);
    const notMatched = results.filter((r) => !r.found);

    logger.info('[VerificationRoute] Verification complete', {
      total: results.length,
      matched: matched.length,
      notMatched: notMatched.length,
    });

    res.json({
      success: true,
      data: {
        total: results.length,
        matched: matched.length,
        notMatched: notMatched.length,
        results,
        matchedDevices: matched.map((r) => r.deviceData),
        notMatchedImeis: notMatched.map((r) => r.imei),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('[VerificationRoute] Error during bulk verification:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to verify IMEIs',
      details: errorMessage,
    });
  }
});

export default router;

