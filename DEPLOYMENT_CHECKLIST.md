# ✅ Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

## 📦 Pre-Deployment

### Code Preparation
- [ ] All code committed to Git
- [ ] All changes pushed to repository
- [ ] No uncommitted changes
- [ ] Code reviewed and tested locally

### Build Verification
- [ ] `pnpm build:frontend` completes successfully
- [ ] `pnpm build:backend` completes successfully
- [ ] Frontend build output exists in `frontend/dist`
- [ ] Backend build output exists in `dist`
- [ ] No TypeScript errors
- [ ] No build warnings (or acceptable warnings documented)

### Local Testing
- [ ] Application runs locally with `pnpm start`
- [ ] Frontend loads correctly
- [ ] API endpoints respond correctly
- [ ] Database connection works
- [ ] Authentication works
- [ ] Email service configured

---

## 🔐 Environment Variables

### Database
- [ ] `DIRECT_URL` - Supabase direct connection string
- [ ] `DATABASE_URL` - Supabase pooler connection string (optional)

### Supabase
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Authentication
- [ ] `JWT_SECRET` - Strong random secret (32+ characters)

### Email
- [ ] `MAILTRAP_API_TOKEN` - Mailtrap API token
- [ ] `EMAIL_FROM` - Sender email address
- [ ] `EMAIL_FROM_NAME` - Sender name
- [ ] `EMAIL_REPORTS_ENABLED=true` - Enable email reports
- [ ] `FRONTEND_URL` - Frontend URL for email links

### Phonecheck API
- [ ] `PHONECHECK_USERNAME` - Phonecheck username
- [ ] `PHONECHECK_PASSWORD` - Phonecheck password
- [ ] `PHONECHECK_BASE_URL` - Phonecheck API URL

### Application
- [ ] `NODE_ENV=production` - Production environment
- [ ] `LOG_LEVEL=info` - Logging level

### Cron Jobs (Optional)
- [ ] `CRON_STATIONS` - Default stations
- [ ] `CRON_DEFAULT_LOCATION` - Default location
- [ ] `CRON_SECRET` - Cron job authentication secret
- [ ] `INTERNAL_API_KEY` - Internal API key
- [ ] `WORKFLOW_API_URL` - Workflow API URL

### Batch Processing (Optional)
- [ ] `WORKFLOW_BATCH_SIZE` - Batch size (default: 50)

---

## 🗄️ Database

### Migrations
- [ ] All migrations applied to production database
- [ ] Database schema matches Prisma schema
- [ ] No pending migrations

### Connection
- [ ] Database connection string tested
- [ ] Supabase firewall allows Vercel IPs
- [ ] Database is not paused (Supabase free tier)

### Data
- [ ] Production data backed up (if applicable)
- [ ] Test data removed (if applicable)
- [ ] Required seed data exists

---

## 🚀 Vercel Configuration

### Project Setup
- [ ] Vercel CLI installed (`npm i -g vercel`)
- [ ] Logged into Vercel (`vercel login`)
- [ ] Project linked (`vercel link`)
- [ ] `.vercel` folder created

### Build Settings
- [ ] Framework preset: Other
- [ ] Build command: `pnpm build`
- [ ] Install command: `pnpm install`
- [ ] Output directory: `frontend/dist` (or configured)
- [ ] Root directory: `.` (root)

### Cron Jobs
- [ ] `vercel.json` configured with cron schedule
- [ ] Cron path matches API route
- [ ] Schedule time is correct (UTC)

---

## 📝 Files & Configuration

### Required Files
- [ ] `vercel.json` exists and configured
- [ ] `.vercelignore` exists (optional but recommended)
- [ ] `package.json` has build scripts
- [ ] `tsconfig.json` configured correctly
- [ ] `prisma/schema.prisma` up to date

### Configuration Files
- [ ] `env.template` documented (for reference)
- [ ] No sensitive data in code
- [ ] No hardcoded secrets

---

## 🧪 Testing

### Health Check
- [ ] `/api/health` endpoint responds
- [ ] Returns correct status

### Frontend
- [ ] Frontend loads at root URL
- [ ] React app initializes
- [ ] No console errors
- [ ] Routes work correctly
- [ ] Authentication flow works

### API Endpoints
- [ ] `/api/admin/inventory-stats` works
- [ ] `/api/workflows/bulk-add` works (test with small dataset)
- [ ] `/api/auth/login` works
- [ ] `/api/auth/register` works
- [ ] Other critical endpoints tested

### Database Operations
- [ ] Can read from database
- [ ] Can write to database
- [ ] Prisma client works correctly

### Email Service
- [ ] Email service configured
- [ ] Test email can be sent
- [ ] Email templates work

---

## 🔄 Deployment

### First Deployment
- [ ] Deployed to preview (`vercel`)
- [ ] Preview deployment successful
- [ ] Preview tested and working
- [ ] Deployed to production (`vercel --prod`)
- [ ] Production deployment successful

### Post-Deployment
- [ ] Production URL accessible
- [ ] Health check passes
- [ ] Frontend loads correctly
- [ ] API endpoints work
- [ ] Database connection works
- [ ] Authentication works

### Cron Jobs
- [ ] Cron jobs visible in Vercel Dashboard
- [ ] Cron jobs scheduled correctly
- [ ] Test cron job execution (if possible)
- [ ] Cron job logs accessible

---

## 📊 Monitoring

### Logs
- [ ] Can access Vercel deployment logs
- [ ] Can access function logs
- [ ] Logs show no errors
- [ ] Application logs working

### Analytics
- [ ] Vercel Analytics enabled (optional)
- [ ] Function execution times monitored
- [ ] Error rates monitored

### Alerts
- [ ] Error notifications set up (optional)
- [ ] Deployment notifications enabled (optional)

---

## 🔒 Security

### Secrets
- [ ] All secrets in environment variables
- [ ] No secrets in code
- [ ] `.env` files in `.gitignore`
- [ ] Strong secrets generated

### Access Control
- [ ] Authentication required for protected routes
- [ ] API endpoints secured
- [ ] CORS configured correctly
- [ ] Rate limiting considered (if needed)

### Database
- [ ] Database credentials secure
- [ ] Service role key not exposed
- [ ] Row Level Security (RLS) enabled (if applicable)

---

## 📚 Documentation

### Updated
- [ ] `README.md` updated
- [ ] `VERCEL_DEPLOYMENT_GUIDE.md` reviewed
- [ ] `ENVIRONMENT_VARIABLES_REFERENCE.md` reviewed
- [ ] Deployment process documented

### Team
- [ ] Team members have access
- [ ] Deployment process shared
- [ ] Environment variables documented
- [ ] Troubleshooting guide available

---

## ✅ Final Verification

### Production Ready
- [ ] All checklist items completed
- [ ] Application tested in production
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Monitoring set up

### Go Live
- [ ] DNS configured (if custom domain)
- [ ] SSL certificate active
- [ ] Backup plan ready
- [ ] Rollback plan ready
- [ ] Team notified

---

## 🎉 Deployment Complete!

Once all items are checked:
1. ✅ Application is live
2. ✅ Monitor for first 24 hours
3. ✅ Check logs regularly
4. ✅ Verify cron jobs run
5. ✅ Test critical workflows

---

## 🆘 If Something Goes Wrong

1. **Check Vercel Logs**: Dashboard → Project → Logs
2. **Check Function Logs**: Dashboard → Functions → [Function] → Logs
3. **Verify Environment Variables**: Dashboard → Settings → Environment Variables
4. **Test Locally**: Reproduce issue locally if possible
5. **Rollback if Needed**: Vercel Dashboard → Deployments → [Deployment] → Rollback

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0

