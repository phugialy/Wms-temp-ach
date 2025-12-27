# Environment Variables Reference

Complete list of all environment variables used in the WMS application.

## 🔴 Required Variables

These must be set for the application to work:

### Database
```bash
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```
- **Purpose**: Direct database connection for Prisma
- **Used by**: Backend database operations
- **Where to get**: Supabase Dashboard → Settings → Database → Connection string (Direct connection)

```bash
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```
- **Purpose**: Connection pooler URL (optional, for connection pooling)
- **Used by**: Alternative database connection method
- **Where to get**: Supabase Dashboard → Settings → Database → Connection string (Connection pooling)

### Supabase
```bash
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
```
- **Purpose**: Supabase project URL
- **Used by**: Frontend and backend Supabase clients
- **Where to get**: Supabase Dashboard → Settings → API → Project URL

```bash
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```
- **Purpose**: Supabase anonymous/public key
- **Used by**: Frontend Supabase client
- **Where to get**: Supabase Dashboard → Settings → API → anon/public key

```bash
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
```
- **Purpose**: Supabase service role key (admin access)
- **Used by**: Backend admin operations
- **Where to get**: Supabase Dashboard → Settings → API → service_role key
- **⚠️ Security**: Keep this secret! Never expose to frontend

---

## 🟡 Recommended Variables

These should be set for production:

### Application
```bash
NODE_ENV=production
```
- **Purpose**: Environment mode
- **Default**: `development`
- **Options**: `development`, `production`, `test`

```bash
PORT=3001
```
- **Purpose**: Server port
- **Default**: `3001`
- **Note**: Vercel ignores this (uses their port)

```bash
LOG_LEVEL=info
```
- **Purpose**: Logging verbosity
- **Default**: `info`
- **Options**: `error`, `warn`, `info`, `debug`

### Authentication
```bash
JWT_SECRET=[RANDOM-SECRET-STRING]
```
- **Purpose**: JWT token signing secret
- **Used by**: Authentication system
- **Generate**: Use a strong random string (32+ characters)

### Email
```bash
MAILTRAP_API_TOKEN=[YOUR-MAILTRAP-API-TOKEN]
```
- **Purpose**: Mailtrap API token for sending emails
- **Used by**: Email service
- **Where to get**: Mailtrap Dashboard → Settings → API Tokens
- **Note**: If not set, falls back to SMTP

```bash
EMAIL_FROM=noreply@dncltechzone.com
```
- **Purpose**: Default sender email address
- **Default**: `noreply@dncltechzone.com`

```bash
EMAIL_FROM_NAME=Central WMS System
```
- **Purpose**: Default sender name
- **Default**: `Central WMS System`

```bash
EMAIL_REPORTS_ENABLED=true
```
- **Purpose**: Enable/disable email reports
- **Default**: `false`
- **Options**: `true`, `false`

```bash
FRONTEND_URL=https://your-app.vercel.app
```
- **Purpose**: Frontend URL for email links
- **Used by**: Email templates
- **Example**: `https://wms-app.vercel.app`

---

## 🟢 Optional Variables

These are optional but useful:

### Phonecheck API
```bash
PHONECHECK_USERNAME=dncltechzoneinc
```
- **Purpose**: Phonecheck API username
- **Default**: `dncltechzoneinc`

```bash
PHONECHECK_PASSWORD=@Ustvmos817
```
- **Purpose**: Phonecheck API password
- **Default**: `@Ustvmos817`
- **⚠️ Security**: Consider using a more secure password

```bash
PHONECHECK_BASE_URL=https://api.phonecheck.com
```
- **Purpose**: Phonecheck API base URL
- **Default**: `https://api.phonecheck.com`

### Cron Jobs
```bash
CRON_STATIONS=Station1,Station2,Station3
```
- **Purpose**: Default stations for cron jobs
- **Format**: Comma-separated list
- **Used by**: Vercel cron job handler

```bash
CRON_DEFAULT_LOCATION=Default Location
```
- **Purpose**: Default location for cron jobs
- **Default**: `Default Location`

```bash
CRON_SECRET=[RANDOM-SECRET-STRING]
```
- **Purpose**: Secret for authenticating cron job requests
- **Used by**: Vercel cron job security
- **Generate**: Use a strong random string

```bash
INTERNAL_API_KEY=[RANDOM-SECRET-STRING]
```
- **Purpose**: Internal API key for service-to-service communication
- **Used by**: Internal API calls
- **Generate**: Use a strong random string

```bash
WORKFLOW_API_URL=https://your-app.vercel.app
```
- **Purpose**: Workflow API URL
- **Used by**: Cron job handler
- **Example**: `https://wms-app.vercel.app`

### Batch Processing
```bash
WORKFLOW_BATCH_SIZE=50
```
- **Purpose**: Number of devices to process per batch
- **Default**: `50`
- **Range**: 10-200 (recommended)

### Application Metadata
```bash
APP_NAME=WMS Backend
```
- **Purpose**: Application name
- **Default**: `WMS Backend`

```bash
APP_VERSION=1.0.0
```
- **Purpose**: Application version
- **Default**: `1.0.0`

---

## 📝 Environment-Specific Configuration

### Development (Local)
Create `.env` file in project root:
```bash
# Copy from env.template
cp env.template .env

# Edit .env with your values
```

### Production (Vercel)
Set in Vercel Dashboard:
1. Go to Project → Settings → Environment Variables
2. Add each variable
3. Select environment (Production, Preview, Development)
4. Save and redeploy

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use strong secrets** for `JWT_SECRET`, `CRON_SECRET`, etc.
3. **Rotate secrets regularly** (every 90 days)
4. **Use different secrets** for development and production
5. **Limit access** to environment variables
6. **Use Vercel's environment variable encryption**

---

## 🧪 Testing Environment Variables

### Check if variables are loaded:
```bash
# Backend
curl http://localhost:3001/api/health

# Frontend
# Check browser console for Supabase connection
```

### Test email configuration:
```bash
curl http://localhost:3001/api/email/test
```

### Test database connection:
```bash
# Should return database stats
curl http://localhost:3001/api/admin/inventory-stats
```

---

## 📋 Quick Setup Checklist

- [ ] `DIRECT_URL` - Database connection
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Frontend Supabase key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Backend Supabase key
- [ ] `JWT_SECRET` - Authentication secret
- [ ] `MAILTRAP_API_TOKEN` - Email service token
- [ ] `EMAIL_FROM` - Sender email
- [ ] `FRONTEND_URL` - Frontend URL for emails
- [ ] `PHONECHECK_USERNAME` - Phonecheck API username
- [ ] `PHONECHECK_PASSWORD` - Phonecheck API password
- [ ] `NODE_ENV=production` - Environment mode

---

## 🆘 Troubleshooting

### Variable not found?
1. Check variable name (case-sensitive)
2. Verify it's set in correct environment
3. Redeploy after adding variables
4. Check for typos

### Variable not working?
1. Restart server after adding variables
2. Check variable scope (Production vs Preview)
3. Verify variable value is correct
4. Check for special characters that need escaping

---

## 📚 Related Documentation

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Environment Variables](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)
- [Prisma Environment Variables](https://www.prisma.io/docs/concepts/components/prisma-schema#environment-variable-expansion)


