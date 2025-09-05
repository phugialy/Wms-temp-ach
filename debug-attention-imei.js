const { Pool } = require('pg');
require('dotenv').config();

async function debugAttentionImei() {
    console.log('🔍 DEBUGGING IMEI 356317536605163 - Why does it require attention?');
    
    try {
        const pool = new Pool({
            connectionString: process.env.DIRECT_URL,
            max: 1,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 30000,
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to database');
        
        // Get the specific device details
        const deviceResult = await client.query(`
            SELECT 
                imei,
                original_sku,
                model,
                capacity,
                color,
                carrier,
                device_notes,
                sku_matched,
                match_score,
                requires_attention
            FROM sku_matching_view 
            WHERE imei = '356317536605163'
        `);
        
        if (deviceResult.rows.length === 0) {
            console.log('❌ Device not found in sku_matching_view');
            return;
        }
        
        const device = deviceResult.rows[0];
        console.log('\n📱 DEVICE DETAILS:');
        console.log(`  IMEI: ${device.imei}`);
        console.log(`  Model: ${device.model}`);
        console.log(`  Capacity: ${device.capacity}`);
        console.log(`  Color: ${device.color}`);
        console.log(`  Carrier: ${device.carrier}`);
        console.log(`  Device Notes: "${device.device_notes}"`);
        console.log(`  Matched SKU: ${device.sku_matched}`);
        console.log(`  Match Score: ${device.match_score}`);
        console.log(`  Requires Attention: ${device.requires_attention}`);
        
        // Analyze the carrier logic step by step
        console.log('\n🔍 CARRIER LOGIC ANALYSIS:');
        
        const deviceNotes = device.device_notes ? device.device_notes.toUpperCase() : '';
        console.log(`  Device Notes (uppercase): "${deviceNotes}"`);
        
        const isExplicitlyLocked = deviceNotes.includes('CARRIER LOCK');
        const isExplicitlyUnlocked = deviceNotes.includes('CARRIER UNLOCK');
        
        console.log(`  Contains "CARRIER LOCK": ${isExplicitlyLocked}`);
        console.log(`  Contains "CARRIER UNLOCK": ${isExplicitlyUnlocked}`);
        
        console.log(`  Original Carrier: "${device.carrier}"`);
        console.log(`  Carrier is "UNLOCKED": ${device.carrier && device.carrier.toUpperCase() === 'UNLOCKED'}`);
        
        // Determine the logic path
        let isCarrierLocked;
        let requiresAttention = false;
        let logicPath = '';
        
        if (isExplicitlyLocked) {
            isCarrierLocked = true;
            logicPath = 'EXPLICITLY LOCKED - device_notes contains "CARRIER LOCK"';
        } else if (isExplicitlyUnlocked) {
            isCarrierLocked = false;
            logicPath = 'EXPLICITLY UNLOCKED - device_notes contains "CARRIER UNLOCK"';
        } else if (device.carrier && device.carrier.toUpperCase() === 'UNLOCKED') {
            isCarrierLocked = false;
            logicPath = 'SPECIAL CASE - carrier is "UNLOCKED" with no device_notes';
        } else {
            isCarrierLocked = true;
            requiresAttention = true;
            logicPath = 'AMBIGUOUS - no explicit status, carrier not "UNLOCKED"';
        }
        
        console.log(`\n🧠 LOGIC PATH: ${logicPath}`);
        console.log(`  Final isCarrierLocked: ${isCarrierLocked}`);
        console.log(`  Final requiresAttention: ${requiresAttention}`);
        
        // Check what SKUs would be selected
        console.log('\n📋 SKU SELECTION ANALYSIS:');
        
        if (isCarrierLocked) {
            console.log('  🔒 CARRIER LOCKED LOGIC: Looking for SKUs WITH carrier tags');
            const lockedSkus = await client.query(`
                SELECT sku_code, sku_tags
                FROM sku_master
                WHERE sku_code LIKE 'FOLD3-512-BLK-%'
                AND (
                    sku_code LIKE '%-ATT' OR
                    sku_code LIKE '%-TMO' OR
                    sku_code LIKE '%-VRZ' OR
                    sku_code LIKE '%-VZ' OR
                    sku_code LIKE '%-XFI' OR
                    sku_code LIKE '%-XFINITY' OR
                    sku_code LIKE '%-SPECTRUM' OR
                    sku_code LIKE '%-SPRINT' OR
                    sku_code LIKE '%-TRACFONE'
                )
            `);
            console.log(`  Found ${lockedSkus.rows.length} carrier-specific SKUs:`);
            lockedSkus.rows.forEach(sku => {
                console.log(`    - ${sku.sku_code} (tags: [${sku.sku_tags.join(', ')}])`);
            });
        } else {
            console.log('  🔓 UNLOCKED LOGIC: Looking for SKUs WITHOUT carrier tags');
            const unlockedSkus = await client.query(`
                SELECT sku_code, sku_tags
                FROM sku_master
                WHERE sku_code LIKE 'FOLD3-512-BLK%'
                AND sku_code NOT LIKE '%-ATT'
                AND sku_code NOT LIKE '%-TMO'
                AND sku_code NOT LIKE '%-VRZ'
                AND sku_code NOT LIKE '%-VZ'
                AND sku_code NOT LIKE '%-XFI'
                AND sku_code NOT LIKE '%-XFINITY'
                AND sku_code NOT LIKE '%-SPECTRUM'
                AND sku_code NOT LIKE '%-SPRINT'
                AND sku_code NOT LIKE '%-TRACFONE'
            `);
            console.log(`  Found ${unlockedSkus.rows.length} unlocked SKUs:`);
            unlockedSkus.rows.forEach(sku => {
                console.log(`    - ${sku.sku_code} (tags: [${sku.sku_tags.join(', ')}])`);
            });
        }
        
        // Check the specific issue with "CARRIER UNLOKED" (typo)
        console.log('\n🔤 TYPO ANALYSIS:');
        console.log(`  Device Notes: "${device.device_notes}"`);
        console.log(`  Contains "CARRIER LOCK": ${deviceNotes.includes('CARRIER LOCK')}`);
        console.log(`  Contains "CARRIER UNLOCK": ${deviceNotes.includes('CARRIER UNLOCK')}`);
        console.log(`  Contains "CARRIER UNLOKED": ${deviceNotes.includes('CARRIER UNLOKED')}`);
        
        if (deviceNotes.includes('CARRIER UNLOKED')) {
            console.log('  ⚠️  ISSUE FOUND: "CARRIER UNLOKED" is a typo!');
            console.log('     The system expects "CARRIER UNLOCKED" but found "CARRIER UNLOKED"');
            console.log('     This causes the system to not recognize it as explicitly unlocked');
            console.log('     Result: Falls into AMBIGUOUS category → requires attention');
        }
        
        // Show what the correct logic should be
        console.log('\n💡 RECOMMENDED FIXES:');
        console.log('  1. Fix the typo in device_notes: "CARRIER UNLOKED" → "CARRIER UNLOCKED"');
        console.log('  2. OR update the matching logic to handle common typos like "UNLOKED"');
        console.log('  3. OR add fuzzy matching for carrier status keywords');
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugAttentionImei();

