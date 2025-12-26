# 🚀 Vercel Deployment Guide

Complete guide for deploying the WMS application to Vercel.

## 📋 Pre-Deployment Checklist

- [ ] All environment variables documented and ready
- [ ] Database migrations applied to production
- [ ] Frontend build tested locally
- [ ] Backend build tested locally
- [ ] API endpoints tested
- [ ] Cron jobs configured
- [ ] Email service configured

---

## 🔧 Step 1: Prepare Your Repository

### 1.1 Ensure All Changes Are Committed

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 1.2 Verify Build Works Locally

```bash
# Build frontend
pnpm build:frontend

# Build backend
pnpm build:backend

# Test production build locally (optional)
pnpm start
```

---

## 🌐 Step 2: Connect to Vercel

### 2.1 Install Vercel CLI (if not already installed)

```bash
npm i -g vercel
```

### 2.2 Login to Vercel

```bash
vercel login
```

### 2.3 Link Your Project

```bash
vercel link
```

This will:
- Ask for your project name
- Create a `.vercel` folder with project configuration

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Required Environment Variables

Add these in **Vercel Dashboard → Your Project → Settings → Environment Variables**:

#### Database Configuration
```
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

#### Supabase Configuration
```
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
```

#### Authentication
```
JWT_SECRET=[GENERATE-A-RANDOM-SECRET]
```

#### Phonecheck API
```
PHONECHECK_USERNAME=dncltechzoneinc
PHONECHECK_PASSWORD=@Ustvmos817
PHONECHECK_BASE_URL=https://api.phonecheck.com
```

#### Email Configuration (Mailtrap)
```
MAILTRAP_API_TOKEN=[YOUR-MAILTRAP-API-TOKEN]
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
EMAIL_REPORTS_ENABLED=true
FRONTEND_URL=https://your-app.vercel.app
```

#### Application Settings
```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
APP_NAME=WMS Backend
```

#### Cron Job Configuration (Optional)
```
CRON_STATIONS=Station1,Station2,Station3
CRON_DEFAULT_LOCATION=Default Location
CRON_SECRET=[GENERATE-A-RANDOM-SECRET]
INTERNAL_API_KEY=[GENERATE-A-RANDOM-SECRET]
WORKFLOW_API_URL=https://your-app.vercel.app
```

#### Batch Processing (Optional)
```
WORKFLOW_BATCH_SIZE=50
```

### 3.2 Environment Variable Scope

Set variables for:
- **Production**: `vercel --prod`
- **Preview**: `vercel` (default)
- **Development**: Local `.env` file

**Important**: Set all variables for **Production** environment.

---

## 📦 Step 4: Configure Build Settings

### 4.1 Vercel Project Settings

In Vercel Dashboard → Settings → General:

- **Framework Preset**: Other
- **Build Command**: `pnpm build`
- **Output Directory**: `frontend/dist` (for frontend) or leave empty for monorepo
- **Install Command**: `pnpm install`
- **Root Directory**: `.` (root of repository)

### 4.2 Build Configuration

Vercel will automatically detect:
- `package.json` in root
- Build scripts defined in `package.json`

---

## 🏗️ Step 5: Deploy

### 5.1 First Deployment

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 5.2 Automatic Deployments

Once connected to Git:
- **Push to `main` branch** → Auto-deploys to production
- **Push to other branches** → Auto-deploys to preview

---

## 🔄 Step 6: Configure Cron Jobs

### 6.1 Update `vercel.json`

The cron configuration is already set up in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/workflows/bulk-add",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 6.2 Cron Schedule Options

- `0 2 * * *` - Daily at 2 AM UTC
- `0 */6 * * *` - Every 6 hours
- `*/30 * * * *` - Every 30 minutes
- `0 0 * * 1` - Every Monday at midnight

### 6.3 Verify Cron Jobs

After deployment, check:
- Vercel Dashboard → Cron Jobs
- Should show your configured cron job

---

## 🗄️ Step 7: Database Migrations

### 7.1 Run Migrations on Production

```bash
# Set production database URL
export DIRECT_URL="your-production-database-url"

# Run migrations
pnpm db:deploy
```

Or use Prisma Studio:
```bash
pnpm db:studio
```

### 7.2 Verify Database Connection

Test the connection:
```bash
curl https://your-app.vercel.app/api/health
```

---

## ✅ Step 8: Post-Deployment Verification

### 8.1 Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "WMS API Server is running"
}
```

### 8.2 Test Frontend

1. Visit: `https://your-app.vercel.app`
2. Verify React app loads
3. Test login functionality
4. Check dashboard loads

### 8.3 Test API Endpoints

```bash
# Test inventory stats
curl https://your-app.vercel.app/api/admin/inventory-stats

# Test workflow execution
curl -X POST https://your-app.vercel.app/api/workflows/bulk-add \
  -H "Content-Type: application/json" \
  -d '{"stations":["Station1"],"dateFrom":"2024-01-01","dateTo":"2024-01-01","location":"Test"}'
```

### 8.4 Test Cron Jobs

1. Go to Vercel Dashboard → Cron Jobs
2. Check execution logs
3. Verify jobs are running on schedule

---

## 🐛 Troubleshooting

### Issue: Build Fails

**Solution:**
1. Check build logs in Vercel Dashboard
2. Verify all dependencies are in `package.json`
3. Check Node.js version (Vercel uses Node 18.x by default)
4. Ensure `pnpm` is available (Vercel auto-detects)

### Issue: Environment Variables Not Working

**Solution:**
1. Verify variables are set in Vercel Dashboard
2. Check variable names match exactly (case-sensitive)
3. Redeploy after adding variables
4. Check variable scope (Production vs Preview)

### Issue: Database Connection Fails

**Solution:**
1. Verify `DIRECT_URL` is correct
2. Check Supabase firewall allows Vercel IPs
3. Test connection string locally
4. Check database is not paused (Supabase free tier)

### Issue: Frontend Not Loading

**Solution:**
1. Verify `frontend/dist` exists after build
2. Check build output in Vercel logs
3. Verify `server.js` serves static files correctly
4. Check browser console for errors

### Issue: Cron Jobs Not Running

**Solution:**
1. Verify `vercel.json` has correct cron configuration
2. Check Vercel Dashboard → Cron Jobs
3. Verify environment variables are set
4. Check cron job logs for errors

### Issue: API Timeout

**Solution:**
1. Vercel serverless functions have timeout limits:
   - Hobby: 60 seconds
   - Pro: 300 seconds (5 minutes)
2. For long-running jobs, use background processing
3. Consider splitting large operations into smaller chunks

---

## 📊 Monitoring & Logs

### View Logs

1. **Vercel Dashboard** → Your Project → Logs
2. **Real-time logs**: `vercel logs --follow`
3. **Function logs**: Vercel Dashboard → Functions → [Function Name] → Logs

### Monitor Performance

- Vercel Dashboard → Analytics
- Check function execution times
- Monitor error rates
- Track API response times

---

## 🔒 Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is secure (backend only)
- [ ] `JWT_SECRET` is strong and random
- [ ] `CRON_SECRET` is set for cron job authentication
- [ ] Database connection strings are secure
- [ ] API keys are rotated regularly
- [ ] CORS is properly configured

---

## 🚀 Production Optimizations

### 1. Enable Caching

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 2. Optimize Build

- Frontend: Already optimized with esbuild
- Backend: TypeScript compilation optimized
- Consider enabling Vercel's Edge Functions for API routes

### 3. Database Connection Pooling

- Use Supabase connection pooler (`DATABASE_URL`)
- Direct connection (`DIRECT_URL`) for migrations only

---

## 📝 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

---

## 🆘 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review this guide's troubleshooting section
3. Check application logs via Vercel Dashboard
4. Verify all environment variables are set correctly

---

## ✅ Deployment Checklist Summary

- [ ] Repository pushed to Git
- [ ] Vercel project linked
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Build tested locally
- [ ] Deployed to Vercel
- [ ] Health check passes
- [ ] Frontend loads correctly
- [ ] API endpoints work
- [ ] Cron jobs configured
- [ ] Email service tested
- [ ] Monitoring set up

**You're ready to go live! 🎉**

