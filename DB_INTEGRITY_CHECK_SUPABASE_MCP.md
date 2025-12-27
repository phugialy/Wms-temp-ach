# Database Integrity Check - Supabase MCP Integration

## Overview

The Database Integrity Check feature uses direct PostgreSQL connections via `DIRECT_URL` for runtime operations. However, **Supabase MCP tools** can be used for verification, testing, and monitoring of queries.

## MCP Tools Available

The following Supabase MCP tools can be used to support the integrity check feature:

### 1. `mcp_supabase_execute_sql`
Execute SQL queries directly against the Supabase database. Useful for:
- Testing queries before implementing them
- Verifying query results
- Manual data inspection
- Debugging query issues

### 2. `mcp_supabase_list_tables`
List all tables in the database. Useful for:
- Verifying table structure
- Checking if `item` table exists
- Understanding schema relationships

### 3. `mcp_supabase_get_advisors`
Get security and performance advisories. Useful for:
- Checking for missing indexes
- Verifying RLS policies
- Performance optimization suggestions

## Example: Verifying Integrity Check Queries

### Check Missing Data Statistics

```typescript
// This query is used by getMissingDataStats()
const statsQuery = `
  SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN model IS NULL OR model = '' OR model = 'N/A' THEN 1 END) as missing_model,
    COUNT(CASE WHEN capacity IS NULL OR capacity = '' OR capacity = 'N/A' THEN 1 END) as missing_capacity,
    COUNT(CASE WHEN color IS NULL OR color = '' OR color = 'N/A' THEN 1 END) as missing_color,
    COUNT(CASE WHEN carrier IS NULL OR carrier = '' OR carrier = 'N/A' THEN 1 END) as missing_carrier,
    COUNT(CASE WHEN 
      (model IS NULL OR model = '' OR model = 'N/A') OR
      (capacity IS NULL OR capacity = '' OR capacity = 'N/A') OR
      (color IS NULL OR color = '' OR color = 'N/A') OR
      (carrier IS NULL OR carrier = '' OR carrier = 'N/A')
    THEN 1 END) as missing_any_field
  FROM item
`;

// Use MCP tool to verify:
// mcp_supabase_execute_sql({ query: statsQuery })
```

### Scan for Missing Data

```typescript
// Example query for scanning missing model data
const scanQuery = `
  SELECT 
    imei,
    model,
    capacity,
    color,
    carrier
  FROM item
  WHERE (model IS NULL OR model = '' OR model = 'N/A')
  ORDER BY imei
  LIMIT 10
`;

// Use MCP tool to verify:
// mcp_supabase_execute_sql({ query: scanQuery })
```

### Verify Table Structure

```typescript
// Check if item table has all required columns
// Use: mcp_supabase_list_tables({ schemas: ['public'] })
// Look for 'item' table and verify columns:
// - imei (VARCHAR, PRIMARY KEY)
// - model (VARCHAR, nullable)
// - capacity (VARCHAR, nullable)
// - color (VARCHAR, nullable)
// - carrier (VARCHAR, nullable)
```

## Runtime vs. MCP Tools

### Runtime (Service Layer)
- **Uses**: Direct PostgreSQL Pool connections via `DIRECT_URL`
- **Why**: MCP tools are only available in AI assistant context, not in Node.js runtime
- **Location**: `src/services/db-integrity-check.service.ts`

### Verification/Testing (AI Assistant Context)
- **Uses**: Supabase MCP tools (`mcp_supabase_execute_sql`, etc.)
- **Why**: Can verify queries, test logic, inspect data without running the service
- **Location**: AI assistant can call MCP tools directly

## Benefits of Using MCP Tools

1. **Query Verification**: Test SQL queries before implementing
2. **Data Inspection**: Check actual data without running the full service
3. **Performance Analysis**: Verify query performance and indexes
4. **Security Checks**: Use `get_advisors` to check for security issues
5. **Schema Validation**: Verify table structure matches expectations

## Example Workflow

1. **Design Query**: Write SQL query in service
2. **Verify with MCP**: Use `mcp_supabase_execute_sql` to test query
3. **Check Results**: Verify query returns expected data
4. **Optimize**: Use `get_advisors` to check for performance issues
5. **Implement**: Add verified query to service code
6. **Monitor**: Use MCP tools to monitor query results over time

## Current Implementation

The service currently uses:
- **Direct PostgreSQL Pool** for all database operations
- **DIRECT_URL** environment variable for connection
- **Standard pg library** for query execution

MCP tools can be used alongside for:
- Development verification
- Query testing
- Data inspection
- Performance monitoring

## Future Enhancements

Potential improvements using MCP tools:
1. **Query Logging**: Log all queries executed via MCP for audit
2. **Performance Monitoring**: Track query execution times
3. **Automated Testing**: Use MCP tools in test suites
4. **Query Optimization**: Use advisors to suggest improvements
5. **Data Validation**: Verify data integrity using MCP queries

## Notes

- MCP tools are **read-only** for verification/testing
- Service layer uses **direct connections** for read/write operations
- Both approaches use the same Supabase database
- MCP tools provide additional visibility and verification capabilities

