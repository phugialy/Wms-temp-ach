import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DIRECT_URL'],
    },
  },
  // Direct connection configuration for Supabase
  log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  // Connection pool configuration for better resilience
  // Note: Prisma manages connection pooling internally
  // These settings help prevent connection exhaustion
});

// Monitor slow queries and connection issues
if (process.env['NODE_ENV'] === 'development') {
  prisma.$on('query' as never, (e: any) => {
    if (e.duration > 5000) {
      console.warn(`⚠️ Slow query detected: ${e.duration}ms`, {
        query: e.query?.substring(0, 200),
        params: e.params
      });
    }
  });
}

// Handle connection pooling issues
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
  });

export default prisma; 