# Supabase Database Setup Guide

## 1. Create Environment File

Create a `.env` file in your project root with the following content:

```env
# Database Configuration - Supabase
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info

# JWT Secret (for future authentication)
JWT_SECRET="your-jwt-secret-here"
```

## 2. Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > Database
3. Copy the connection string from the "Connection string" section
4. Replace `[YOUR-PASSWORD]` with your database password
5. Replace `[YOUR-PROJECT-REF]` with your project reference

## 3. Apply Schema Changes

Once you have the `.env` file configured, run:

```bash
# Push schema changes to Supabase
pnpm prisma:push

# Verify the changes
pnpm prisma:studio
```

## 4. Database Migration (if needed)

If you have existing data, you may need to create a migration:

```bash
# Create a migration
pnpm db:migrate

# Apply the migration
pnpm prisma migrate deploy
```

## 5. Verify Connection

Test your connection by running:

```bash
# Start the development server
pnpm dev
```

The server should start without database connection errors. 