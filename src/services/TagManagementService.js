const { Pool } = require('pg');
require('dotenv').config();

class TagManagementService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    async initialize() {
        try {
            // Verify tables exist
            await this.verifyTablesExist();
            console.log('✅ Tag Management Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Tag Management Service:', error);
            throw error;
        }
    }

    async verifyTablesExist() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('sku_tags', 'sku_master_tags', 'undefined_tag_review')
            `);
            
            if (result.rows.length !== 3) {
                throw new Error('Required tag tables do not exist. Please run Phase 1 migration first.');
            }
        } finally {
            client.release();
        }
    }

    // Tag CRUD Operations
    async createTag(tagName, tagCategory, tagValue) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO sku_tags (tag_name, tag_category, tag_value)
                VALUES ($1, $2, $3)
                ON CONFLICT (tag_name, tag_category) 
                DO UPDATE SET 
                    usage_count = sku_tags.usage_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [tagName, tagCategory, tagValue]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async getTag(tagName, tagCategory) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM sku_tags 
                WHERE tag_name = $1 AND tag_category = $2
            `, [tagName, tagCategory]);
            
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async updateTag(tagName, tagCategory, updates) {
        const client = await this.pool.connect();
        try {
            const setClause = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 3}`)
                .join(', ');
            
            const result = await client.query(`
                UPDATE sku_tags 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                WHERE tag_name = $1 AND tag_category = $2
                RETURNING *
            `, [tagName, tagCategory, ...Object.values(updates)]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async deleteTag(tagName, tagCategory) {
        const client = await this.pool.connect();
        try {
            // Check if tag is in use
            const usageResult = await client.query(`
                SELECT COUNT(*) FROM sku_master_tags smt
                JOIN sku_tags st ON smt.tag_id = st.id
                WHERE st.tag_name = $1 AND st.tag_category = $2
            `, [tagName, tagCategory]);
            
            if (parseInt(usageResult.rows[0].count) > 0) {
                throw new Error(`Cannot delete tag ${tagName} (${tagCategory}) - it is currently in use`);
            }
            
            const result = await client.query(`
                DELETE FROM sku_tags 
                WHERE tag_name = $1 AND tag_category = $2
                RETURNING *
            `, [tagName, tagCategory]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    // Tag Querying and Search
    async searchTags(query, category = null, limit = 50) {
        const client = await this.pool.connect();
        try {
            let sql = `
                SELECT * FROM sku_tags 
                WHERE (tag_name ILIKE $1 OR tag_value ILIKE $1)
            `;
            let params = [`%${query}%`];
            let paramIndex = 1;
            
            if (category) {
                sql += ` AND tag_category = $${++paramIndex}`;
                params.push(category);
            }
            
            sql += ` ORDER BY usage_count DESC, tag_name ASC LIMIT $${++paramIndex}`;
            params.push(limit);
            
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getTagsByCategory(category, limit = 100) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM sku_tags 
                WHERE tag_category = $1 
                ORDER BY usage_count DESC, tag_name ASC 
                LIMIT $2
            `, [category, limit]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getPopularTags(limit = 20) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM sku_tags 
                ORDER BY usage_count DESC 
                LIMIT $1
            `, [limit]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    // SKU-Tag Relationship Management
    async addTagToSku(skuMasterId, tagName, tagCategory, position = null) {
        const client = await this.pool.connect();
        try {
            // Get or create tag
            let tag = await this.getTag(tagName, tagCategory);
            if (!tag) {
                tag = await this.createTag(tagName, tagCategory, tagName);
            }
            
            // Check if relationship already exists
            const existingResult = await client.query(`
                SELECT * FROM sku_master_tags 
                WHERE sku_master_id = $1 AND tag_id = $2
            `, [skuMasterId, tag.id]);
            
            if (existingResult.rows.length > 0) {
                return existingResult.rows[0];
            }
            
            // Create relationship
            const result = await client.query(`
                INSERT INTO sku_master_tags (sku_master_id, tag_id, tag_position)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [skuMasterId, tag.id, position]);
            
            // Update tag count in sku_master
            await client.query(`
                UPDATE sku_master 
                SET tag_count = (
                    SELECT COUNT(*) FROM sku_master_tags 
                    WHERE sku_master_id = $1
                )
                WHERE id = $1
            `, [skuMasterId]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async removeTagFromSku(skuMasterId, tagName, tagCategory) {
        const client = await this.pool.connect();
        try {
            // Get tag
            const tag = await this.getTag(tagName, tagCategory);
            if (!tag) {
                throw new Error(`Tag ${tagName} (${tagCategory}) not found`);
            }
            
            // Remove relationship
            const result = await client.query(`
                DELETE FROM sku_master_tags 
                WHERE sku_master_id = $1 AND tag_id = $2
                RETURNING *
            `, [skuMasterId, tag.id]);
            
            // Update tag count in sku_master
            await client.query(`
                UPDATE sku_master 
                SET tag_count = (
                    SELECT COUNT(*) FROM sku_master_tags 
                    WHERE sku_master_id = $1
                )
                WHERE id = $1
            `, [skuMasterId]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async getSkuTags(skuMasterId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT st.*, smt.tag_position
                FROM sku_master_tags smt
                JOIN sku_tags st ON smt.tag_id = st.id
                WHERE smt.sku_master_id = $1
                ORDER BY smt.tag_position, st.tag_category, st.tag_name
            `, [skuMasterId]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getSkusByTag(tagName, tagCategory, limit = 100) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT sm.*, st.tag_name, st.tag_category, st.tag_value
                FROM sku_master sm
                JOIN sku_master_tags smt ON sm.id = smt.sku_master_id
                JOIN sku_tags st ON smt.tag_id = st.id
                WHERE st.tag_name = $1 AND st.tag_category = $2
                ORDER BY sm.id
                LIMIT $3
            `, [tagName, tagCategory, limit]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    // Advanced Tag Queries
    async getTagsBySkuPattern(pattern) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT DISTINCT st.*, COUNT(smt.sku_master_id) as sku_count
                FROM sku_tags st
                JOIN sku_master_tags smt ON st.id = smt.tag_id
                JOIN sku_master sm ON smt.sku_master_id = sm.id
                WHERE sm.sku_code ILIKE $1
                GROUP BY st.id, st.tag_name, st.tag_category, st.tag_value, st.usage_count, st.created_at, st.updated_at
                ORDER BY sku_count DESC, st.usage_count DESC
            `, [`%${pattern}%`]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getTagStatistics() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    tag_category,
                    COUNT(*) as tag_count,
                    SUM(usage_count) as total_usage,
                    AVG(usage_count) as avg_usage,
                    MAX(usage_count) as max_usage,
                    MIN(usage_count) as min_usage
                FROM sku_tags 
                GROUP BY tag_category 
                ORDER BY tag_count DESC
            `);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getBrandTagDistribution() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    st.tag_value as brand,
                    COUNT(DISTINCT sm.id) as sku_count,
                    COUNT(DISTINCT st2.id) as tag_count
                FROM sku_tags st
                JOIN sku_master_tags smt ON st.id = smt.tag_id
                JOIN sku_master sm ON smt.sku_master_id = sm.id
                JOIN sku_master_tags smt2 ON sm.id = smt2.sku_master_id
                JOIN sku_tags st2 ON smt2.tag_id = st2.id
                WHERE st.tag_category = 'BRAND'
                GROUP BY st.tag_value
                ORDER BY sku_count DESC
            `);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    // Tag Validation and Cleanup
    async validateTagConsistency() {
        const client = await this.pool.connect();
        try {
            const issues = [];
            
            // Check for orphaned sku_master_tags
            const orphanedResult = await client.query(`
                SELECT smt.id, smt.sku_master_id, smt.tag_id
                FROM sku_master_tags smt
                LEFT JOIN sku_master sm ON smt.sku_master_id = sm.id
                LEFT JOIN sku_tags st ON smt.tag_id = st.id
                WHERE sm.id IS NULL OR st.id IS NULL
            `);
            
            if (orphanedResult.rows.length > 0) {
                issues.push({
                    type: 'ORPHANED_RELATIONSHIPS',
                    count: orphanedResult.rows.length,
                    details: orphanedResult.rows
                });
            }
            
            // Check for mismatched tag counts
            const mismatchedResult = await client.query(`
                SELECT sm.id, sm.sku_code, sm.tag_count, 
                       (SELECT COUNT(*) FROM sku_master_tags WHERE sku_master_id = sm.id) as actual_count
                FROM sku_master sm
                WHERE sm.tag_count != (SELECT COUNT(*) FROM sku_master_tags WHERE sku_master_id = sm.id)
            `);
            
            if (mismatchedResult.rows.length > 0) {
                issues.push({
                    type: 'MISMATCHED_TAG_COUNTS',
                    count: mismatchedResult.rows.length,
                    details: mismatchedResult.rows
                });
            }
            
            return issues;
        } finally {
            client.release();
        }
    }

    async cleanupOrphanedTags() {
        const client = await this.pool.connect();
        try {
            // Delete orphaned sku_master_tags
            const orphanedResult = await client.query(`
                DELETE FROM sku_master_tags 
                WHERE sku_master_id NOT IN (SELECT id FROM sku_master)
                   OR tag_id NOT IN (SELECT id FROM sku_tags)
            `);
            
            // Update tag counts
            await client.query(`
                UPDATE sku_master 
                SET tag_count = (
                    SELECT COUNT(*) FROM sku_master_tags 
                    WHERE sku_master_id = sku_master.id
                )
            `);
            
            return {
                orphanedRelationshipsRemoved: orphanedResult.rowCount,
                tagCountsUpdated: true
            };
        } finally {
            client.release();
        }
    }

    // Undefined Tag Management
    async getUndefinedTags(status = 'UNDEFINED', limit = 100) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM undefined_tag_review 
                WHERE status = $1
                ORDER BY created_at DESC 
                LIMIT $2
            `, [status, limit]);
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    async updateUndefinedTag(id, updates) {
        const client = await this.pool.connect();
        try {
            const setClause = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 2}`)
                .join(', ');
            
            const result = await client.query(`
                UPDATE undefined_tag_review 
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [id, ...Object.values(updates)]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async resolveUndefinedTag(id, tagName, tagCategory, reviewedBy) {
        const client = await this.pool.connect();
        try {
            // Create the tag
            const tag = await this.createTag(tagName, tagCategory, tagName);
            
            // Update undefined tag status
            await this.updateUndefinedTag(id, {
                status: 'RESOLVED',
                reviewed_by: reviewedBy,
                reviewed_at: new Date()
            });
            
            return tag;
        } finally {
            client.release();
        }
    }

    // Performance and Analytics
    async getTagPerformanceMetrics() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_tags,
                    COUNT(DISTINCT tag_category) as category_count,
                    AVG(usage_count) as avg_usage,
                    SUM(usage_count) as total_usage,
                    MAX(usage_count) as max_usage,
                    MIN(usage_count) as min_usage,
                    COUNT(CASE WHEN usage_count = 1 THEN 1 END) as single_use_tags,
                    COUNT(CASE WHEN usage_count > 10 THEN 1 END) as popular_tags
                FROM sku_tags
            `);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = TagManagementService;

