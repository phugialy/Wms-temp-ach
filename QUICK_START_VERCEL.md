# 🚀 Quick Start: Deploy to Vercel

## Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

## Step 2: Login
```bash
vercel login
```

## Step 3: Link Project
```bash
vercel link
```

## Step 4: Set Environment Variables

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

### Required (Minimum)
```
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
JWT_SECRET=[GENERATE-RANDOM-SECRET]
MAILTRAP_API_TOKEN=[YOUR-TOKEN]
EMAIL_FROM=noreply@dncltechzone.com
EMAIL_FROM_NAME=Central WMS System
FRONTEND_URL=https://your-app.vercel.app
PHONECHECK_USERNAME=dncltechzoneinc
PHONECHECK_PASSWORD=@Ustvmos817
NODE_ENV=production
```

### Optional (Recommended)
```
EMAIL_REPORTS_ENABLED=true
WORKFLOW_BATCH_SIZE=50
CRON_SECRET=[GENERATE-RANDOM-SECRET]
INTERNAL_API_KEY=[GENERATE-RANDOM-SECRET]
```

## Step 5: Deploy
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Step 6: Verify
1. Visit your Vercel URL
2. Check `/api/health` endpoint
3. Test login functionality
4. Verify cron jobs in Vercel Dashboard

## 📚 Full Documentation

- **Complete Guide**: See `VERCEL_DEPLOYMENT_GUIDE.md`
- **Environment Variables**: See `ENVIRONMENT_VARIABLES_REFERENCE.md`
- **Checklist**: See `DEPLOYMENT_CHECKLIST.md`

## 🆘 Troubleshooting

**Build fails?**
- Check Vercel logs
- Verify `pnpm build` works locally
- Check Node.js version (Vercel uses 18.x)

**Environment variables not working?**
- Verify they're set in Vercel Dashboard
- Check variable names (case-sensitive)
- Redeploy after adding variables

**Database connection fails?**
- Verify `DIRECT_URL` is correct
- Check Supabase firewall allows Vercel IPs
- Test connection string locally

---

**That's it! Your app should be live! 🎉**

