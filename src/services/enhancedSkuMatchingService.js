const { Client } = require('pg');

class EnhancedSkuMatchingService {
    constructor() {
        this.createClient = () => new Client({ connectionString: process.env.DATABASE_URL });
    }

    // Product category detection
    detectProductCategory(description, model, brand) {
        const desc = (description || '').toLowerCase();
        const mod = (model || '').toLowerCase();
        const br = (brand || '').toLowerCase();

        // Watch detection - more specific
        if (desc.includes('watch') || mod.includes('watch') || 
            desc.includes('galaxy watch') || desc.includes('apple watch') ||
            (mod.includes('ultra') && (desc.includes('watch') || desc.includes('galaxy watch')))) {
            return 'WATCH';
        }

        // Tablet detection
        if (desc.includes('tablet') || desc.includes('ipad') || 
            mod.includes('tab') || mod.includes('tablet') ||
            desc.includes('galaxy tab') || desc.includes('ipad')) {
            return 'TABLET';
        }

        // Computer detection
        if (desc.includes('laptop') || desc.includes('desktop') || 
            desc.includes('computer') || desc.includes('2-in-1') ||
            mod.includes('laptop') || mod.includes('desktop') ||
            desc.includes('dell') || desc.includes('hp') || desc.includes('lenovo')) {
            return 'COMPUTER';
        }

        // Phone (default)
        return 'PHONE';
    }

    // Parse SKU components from master SKU
    parseMasterSku(sku) {
        const parts = sku.split('-');
        const result = {
            original: sku,
            parts: parts,
            category: null,
            model: null,
            variant: null,
            capacity: null,
            size: null,
            color: null,
            carrier: null,
            wifi: false,
            cellular: false
        };

        if (parts.length < 2) return result;

        // Detect category from first part
        const firstPart = parts[0].toUpperCase();
        if (['WATCH', 'TAB', 'IPAD', 'DESKTOP', '2IN1', 'LAPTOP'].includes(firstPart)) {
            result.category = firstPart;
            if (firstPart === 'TAB' || firstPart === 'IPAD') {
                result.category = 'TABLET';
            }
        } else {
            result.category = 'PHONE';
        }

        // Parse based on category
        switch (result.category) {
            case 'WATCH':
                this.parseWatchSku(parts, result);
                break;
            case 'TABLET':
            case 'IPAD':
                this.parseTabletSku(parts, result);
                break;
            case 'COMPUTER':
            case 'DESKTOP':
            case '2IN1':
            case 'LAPTOP':
                this.parseComputerSku(parts, result);
                break;
            default:
                this.parsePhoneSku(parts, result);
        }

        return result;
    }

    parseWatchSku(parts, result) {
        result.category = 'WATCH';
        
        if (parts.length >= 4) {
            // WATCH-ULTRA-47-SILVER or WATCH-5-40-WIFI-PINK
            result.model = parts[1]; // ULTRA or 5
            
            if (parts[2].match(/^\d+$/)) {
                result.size = parts[2]; // 47 or 40
            }
            
            // Check for carrier/size in different positions
            if (parts[3] && ['WIFI', '4G', '5G'].includes(parts[3].toUpperCase())) {
                result.carrier = parts[3].toUpperCase();
                result.wifi = result.carrier === 'WIFI';
                result.cellular = ['4G', '5G'].includes(result.carrier);
                
                if (parts[4]) {
                    result.color = parts[4];
                }
            } else {
                result.color = parts[3];
                if (parts[4]) {
                    result.carrier = parts[4].toUpperCase();
                    result.wifi = result.carrier === 'WIFI';
                    result.cellular = ['4G', '5G'].includes(result.carrier);
                }
            }
        }
    }

    parseTabletSku(parts, result) {
        result.category = 'TABLET';
        
        if (parts.length >= 4) {
            // IPAD-AIR-256GB-SILVER-WIFI or TAB-SAMSUNG-128GB-BLACK-5G
            result.model = parts[1]; // AIR or SAMSUNG
            
            // Find capacity (contains GB/TB)
            const capacityPart = parts.find(p => p.match(/\d+GB|\d+TB/i));
            if (capacityPart) {
                result.capacity = capacityPart.toUpperCase();
            }
            
            // Find color (not capacity, not carrier)
            const colorPart = parts.find(p => 
                !p.match(/\d+GB|\d+TB|WIFI|4G|5G/i) && 
                p !== result.model &&
                ['BLACK', 'WHITE', 'SILVER', 'GOLD', 'PINK', 'BLUE', 'GREEN', 'RED'].includes(p.toUpperCase())
            );
            if (colorPart) {
                result.color = colorPart.toUpperCase();
            }
            
            // Find carrier
            const carrierPart = parts.find(p => ['WIFI', '4G', '5G'].includes(p.toUpperCase()));
            if (carrierPart) {
                result.carrier = carrierPart.toUpperCase();
                result.wifi = result.carrier === 'WIFI';
                result.cellular = ['4G', '5G'].includes(result.carrier);
            }
        }
    }

    parseComputerSku(parts, result) {
        result.category = 'COMPUTER';
        
        if (parts.length >= 3) {
            result.model = parts[1]; // Brand/model
            
            // Find capacity
            const capacityPart = parts.find(p => p.match(/\d+GB|\d+TB/i));
            if (capacityPart) {
                result.capacity = capacityPart.toUpperCase();
            }
            
            // Find color
            const colorPart = parts.find(p => 
                !p.match(/\d+GB|\d+TB/i) && 
                p !== result.model &&
                ['BLACK', 'WHITE', 'SILVER', 'GOLD', 'GRAY'].includes(p.toUpperCase())
            );
            if (colorPart) {
                result.color = colorPart.toUpperCase();
            }
        }
    }

    parsePhoneSku(parts, result) {
        result.category = 'PHONE';
        
        if (parts.length >= 3) {
            // S22-256GB-BLACK-AT&T or S22-ULTRA-512GB-BLACK-AT&T
            result.model = parts[0]; // S22
            
            // Check for variant (ULTRA, PRO, MAX, etc.)
            if (parts[1] && ['ULTRA', 'PRO', 'MAX', 'PLUS', 'MINI'].includes(parts[1].toUpperCase())) {
                result.variant = parts[1].toUpperCase();
                result.model = `${result.model}-${result.variant}`;
                
                // Capacity should be next
                if (parts[2] && parts[2].match(/\d+GB|\d+TB/i)) {
                    result.capacity = parts[2].toUpperCase();
                }
            } else if (parts[1] && parts[1].match(/\d+GB|\d+TB/i)) {
                result.capacity = parts[1].toUpperCase();
            }
            
            // Find color and carrier
            const remainingParts = parts.slice(result.variant ? 3 : 2);
            if (remainingParts.length >= 2) {
                result.color = remainingParts[0].toUpperCase();
                result.carrier = remainingParts[1].toUpperCase();
            } else if (remainingParts.length === 1) {
                result.color = remainingParts[0].toUpperCase();
            }
        }
    }

    // Generate SKU from device data
    generateSkuFromDevice(deviceData) {
        const category = this.detectProductCategory(
            deviceData.description, 
            deviceData.model, 
            deviceData.brand
        );

        const model = this.normalizeModel(deviceData.model, category);
        const capacity = this.normalizeCapacity(deviceData.capacity);
        const color = this.normalizeColor(deviceData.color);
        const carrier = this.normalizeCarrier(deviceData.carrier, category);

        switch (category) {
            case 'WATCH':
                return this.generateWatchSku(model, deviceData.size, color, carrier);
            case 'TABLET':
                return this.generateTabletSku(model, capacity, color, carrier);
            case 'COMPUTER':
                return this.generateComputerSku(model, capacity, color);
            case 'PHONE':
            default:
                return this.generatePhoneSku(model, capacity, color, carrier);
        }
    }

    generateWatchSku(model, size, color, carrier) {
        const parts = ['WATCH', model];
        
        if (size) {
            parts.push(size.toString());
        }
        
        if (carrier && carrier !== 'UNLOCKED') {
            parts.push(carrier);
        }
        
        if (color) {
            parts.push(color);
        }
        
        return parts.join('-');
    }

    generateTabletSku(model, capacity, color, carrier) {
        const parts = ['TAB', model];
        
        if (capacity) {
            parts.push(capacity);
        }
        
        if (color) {
            parts.push(color);
        }
        
        if (carrier && carrier !== 'UNLOCKED') {
            parts.push(carrier);
        }
        
        return parts.join('-');
    }

    generateComputerSku(model, capacity, color) {
        const parts = ['DESKTOP', model];
        
        if (capacity) {
            parts.push(capacity);
        }
        
        if (color) {
            parts.push(color);
        }
        
        return parts.join('-');
    }

    generatePhoneSku(model, capacity, color, carrier) {
        const parts = [model];
        
        if (capacity) {
            parts.push(capacity);
        }
        
        if (color) {
            parts.push(color);
        }
        
        if (carrier && carrier !== 'UNLOCKED') {
            parts.push(carrier);
        }
        
        return parts.join('-');
    }

    // Normalization helpers
    normalizeModel(model, category) {
        if (!model) return 'UNKNOWN';
        
        const normalized = model.toUpperCase().replace(/\s+/g, '');
        
        // Handle special cases
        if (category === 'WATCH') {
            if (normalized.includes('ULTRA')) return 'ULTRA';
            if (normalized.match(/^\d+$/)) return normalized; // Just the number
        }
        
        return normalized;
    }

    normalizeCapacity(capacity) {
        if (!capacity) return null;
        
        const cap = capacity.toString().toUpperCase().replace(/\s+/g, '');
        
        // Handle various capacity formats
        if (cap.match(/\d+GB/i)) {
            return cap.replace(/GB/i, 'GB');
        }
        if (cap.match(/\d+TB/i)) {
            return cap.replace(/TB/i, 'TB');
        }
        
        return cap;
    }

    normalizeColor(color) {
        if (!color) return null;
        
        const col = color.toUpperCase().replace(/\s+/g, '');
        
        // Handle long color names (up to 12 chars)
        if (col.length <= 12) {
            return col;
        }
        
        // Handle specific long colors
        const colorMap = {
            'PHANTOMBLACK': 'BLACK',
            'PHANTOMWHITE': 'WHITE',
            'PHANTOM GREEN': 'GREEN',
            'PHANTOM BLUE': 'BLUE',
            'PHANTOM RED': 'RED'
        };
        
        return colorMap[col] || col.substring(0, 12);
    }

    normalizeCarrier(carrier, category) {
        if (!carrier) return 'UNLOCKED';
        
        const car = carrier.toUpperCase().replace(/\s+/g, '');
        
        // Handle special cases for different categories
        if (category === 'WATCH' || category === 'TABLET') {
            if (['WIFI', '4G', '5G'].includes(car)) {
                return car;
            }
        }
        
        // Standard carrier normalization
        const carrierMap = {
            'ATT': 'AT&T',
            'AT&T WIRELESS': 'AT&T',
            'VERIZON': 'VERIZON',
            'VER': 'VERIZON',
            'VERZ': 'VERIZON',
            'VERIZON WIRELESS': 'VERIZON',
            'TMOBILE': 'T-MOBILE',
            'TMB': 'T-MOBILE',
            'T-MOBILE': 'T-MOBILE',
            'UNLOCKED': 'UNLOCKED',
            'UNL': 'UNLOCKED'
        };
        
        return carrierMap[car] || car;
    }

    // Enhanced matching logic
    async findBestMatchingSku(deviceData) {
        const client = this.createClient();
        
        try {
            await client.connect();
            
            // Use the original_sku from the view if available, otherwise generate one
            let originalSku = deviceData.original_sku;
            if (!originalSku) {
                originalSku = this.generateSkuFromDevice(deviceData);
            }
            
            const generatedSkuInfo = this.parseMasterSku(originalSku);
            
            console.log(`🔍 Original SKU: ${originalSku}`);
            console.log(`📱 Device Category: ${generatedSkuInfo.category}`);
            console.log(`📊 Data Completeness: ${deviceData.data_completeness || 'unknown'}`);
            
            // Get all master SKUs
            const masterSkusResult = await client.query(`
                SELECT sku_code
                FROM sku_master
                WHERE sku_code IS NOT NULL AND sku_code != ''
            `);
            
            let bestMatch = null;
            let bestScore = 0;
            let bestMethod = '';
            
            for (const masterSku of masterSkusResult.rows) {
                const masterSkuInfo = this.parseMasterSku(masterSku.sku_code);
                
                // Calculate match score
                const score = this.calculateMatchScore(generatedSkuInfo, masterSkuInfo, deviceData);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = masterSku.sku_code;
                    bestMethod = this.getMatchMethod(generatedSkuInfo, masterSkuInfo);
                }
            }
            
            return {
                originalSku: originalSku,
                matchedSku: bestMatch,
                matchScore: bestScore,
                matchMethod: bestMethod,
                category: generatedSkuInfo.category
            };
            
        } catch (error) {
            console.error('❌ Error in SKU matching:', error);
            throw error;
        } finally {
            await client.end();
        }
    }

    calculateMatchScore(generated, master, deviceData) {
        let score = 0;
        let totalWeight = 0;
        
        // Category match (highest weight)
        if (generated.category === master.category) {
            score += 40;
            totalWeight += 40;
        }
        
        // Model match
        if (generated.model && master.model) {
            const modelScore = this.calculateStringSimilarity(generated.model, master.model);
            score += modelScore * 25;
            totalWeight += 25;
        }
        
        // Capacity match
        if (generated.capacity && master.capacity) {
            if (generated.capacity === master.capacity) {
                score += 20;
            }
            totalWeight += 20;
        }
        
        // Color match
        if (generated.color && master.color) {
            const colorScore = this.calculateStringSimilarity(generated.color, master.color);
            score += colorScore * 10;
            totalWeight += 10;
        }
        
        // Carrier match
        if (generated.carrier && master.carrier) {
            if (generated.carrier === master.carrier) {
                score += 5;
            }
            totalWeight += 5;
        }
        
        return totalWeight > 0 ? score / totalWeight : 0;
    }

    calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1;
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        // Simple Levenshtein-based similarity
        const maxLength = Math.max(s1.length, s2.length);
        const distance = this.levenshteinDistance(s1, s2);
        
        return 1 - (distance / maxLength);
    }

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

    getMatchMethod(generated, master) {
        if (generated.category !== master.category) {
            return 'category_mismatch';
        }
        
        if (generated.model === master.model) {
            return 'exact_model';
        }
        
        if (this.calculateStringSimilarity(generated.model, master.model) > 0.8) {
            return 'fuzzy_model';
        }
        
        return 'partial_match';
    }

    // Process SKU matching for a single IMEI
    async processSkuMatchingForImei(imei) {
        const client = this.createClient();
        
        try {
            await client.connect();
            
            // Get device data from sku_matching_view with enhanced fields
            const deviceResult = await client.query(`
                SELECT 
                    imei,
                    original_sku,
                    sku_matched,
                    brand,
                    model,
                    model_number,
                    carrier,
                    capacity,
                    color,
                    battery_health,
                    battery_count,
                    working,
                    location,
                    defects,
                    notes,
                    custom1,
                    movement_date,
                    data_completeness,
                    working_status,
                    last_activity
                FROM sku_matching_view 
                WHERE imei = $1
            `, [imei]);
            
            if (deviceResult.rows.length === 0) {
                throw new Error(`IMEI ${imei} not found`);
            }
            
            const deviceData = deviceResult.rows[0];
            
            // Find best matching SKU
            const matchResult = await this.findBestMatchingSku(deviceData);
            
            // Determine match status
            let matchStatus = 'no_match';
            let matchNotes = 'No suitable match found';
            
            if (matchResult.matchScore >= 0.8) {
                matchStatus = 'matched';
                matchNotes = `Automatic match (${matchResult.matchMethod})`;
            } else if (matchResult.matchScore >= 0.6) {
                matchStatus = 'manual_review';
                matchNotes = `Requires manual review (${matchResult.matchMethod})`;
            }
            
            // Insert or update matching result
            await client.query(`
                INSERT INTO sku_matching_results (
                    imei, original_sku, matched_sku, match_score, 
                    match_method, match_status, match_notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (imei) 
                DO UPDATE SET
                    matched_sku = EXCLUDED.matched_sku,
                    match_score = EXCLUDED.match_score,
                    match_method = EXCLUDED.match_method,
                    match_status = EXCLUDED.match_status,
                    match_notes = EXCLUDED.match_notes,
                    updated_at = NOW()
            `, [
                imei, 
                deviceData.original_sku, // Use the original_sku from the view
                matchResult.matchedSku, 
                matchResult.matchScore,
                matchResult.matchMethod, 
                matchStatus, 
                matchNotes
            ]);
            
            return {
                imei,
                originalSku: deviceData.original_sku,
                matchedSku: matchResult.matchedSku,
                matchScore: matchResult.matchScore,
                matchStatus,
                matchNotes,
                category: matchResult.category,
                dataCompleteness: deviceData.data_completeness,
                workingStatus: deviceData.working_status
            };
            
        } catch (error) {
            console.error('❌ Error processing SKU matching:', error);
            throw error;
        } finally {
            await client.end();
        }
    }
}

module.exports = EnhancedSkuMatchingService;
