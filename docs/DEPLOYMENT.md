# Deployment Guide - Instagram Analytics MVP

This guide covers deploying the Instagram Analytics MVP to production.

## Overview

The application consists of three main components that need to be deployed separately:

1. **Web App** (Next.js) → Vercel, Netlify, or similar
2. **Worker** (Node.js) → Railway, Heroku, or similar
3. **Edge Functions** (Deno) → Supabase
4. **Database** (PostgreSQL) → Supabase (already hosted)

## Part 1: Deploy Web App

### Option A: Deploy to Vercel (Recommended)

Vercel is optimized for Next.js applications.

#### Prerequisites
- Vercel account (free tier available)
- GitHub repository with your code

#### Steps

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/instagram-analytics-mvp.git
   git push -u origin main
   ```

2. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Choose "Next.js" framework
   - Click "Import"

3. **Configure environment variables**
   - In Vercel dashboard, go to **Settings** → **Environment Variables**
   - Add the following:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     VITE_APP_TITLE=Instagram Analytics MVP
     VITE_APP_LOGO=https://your-logo-url.png
     ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option B: Deploy to Netlify

1. **Connect GitHub repository**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Select GitHub and authorize
   - Choose your repository

2. **Configure build settings**
   - Build command: `pnpm build`
   - Publish directory: `apps/web/dist`

3. **Add environment variables**
   - In Netlify, go to **Site settings** → **Build & deploy** → **Environment**
   - Add the same variables as Vercel above

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete

## Part 2: Deploy Worker to Railway

Railway is ideal for Node.js applications.

### Prerequisites
- Railway account (free tier available)
- GitHub repository

### Steps

1. **Create Railway project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Authorize and select your repository

2. **Configure Railway**
   - Railway will auto-detect Node.js
   - Set start command: `cd apps/worker && npm start`

3. **Add environment variables**
   - In Railway dashboard, go to **Variables**
   - Add the following:
     ```
     WORKER_SUPABASE_URL=https://your-project.supabase.co
     WORKER_SUPABASE_SERVICE_ROLE=your-service-role-key
     WORKER_ENCRYPTION_KEY=your-32-byte-hex-key
     LOG_LEVEL=info
     ```

4. **Deploy**
   - Click "Deploy"
   - Railway will build and start your worker
   - Check logs to verify it's running

### Verify Worker is Running

```bash
# Check Railway logs
railway logs

# You should see:
# [Worker] Starting job polling...
# [Worker] Polling for jobs every 5 seconds
```

## Part 3: Deploy Edge Functions to Supabase

Supabase Edge Functions are deployed directly from your code.

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Supabase project created

### Steps

1. **Login to Supabase**
   ```bash
   supabase login
   ```

2. **Link your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Deploy functions**
   ```bash
   supabase functions deploy auth-ig-login-init
   supabase functions deploy auth-ig-verify-2fa
   supabase functions deploy sync-profile
   supabase functions deploy export-data
   ```

4. **Verify deployment**
   - Go to Supabase dashboard
   - Navigate to **Edge Functions**
   - You should see your functions listed

## Part 4: Verify Production Setup

### Test Web App
1. Visit your deployed web app URL
2. Sign up with a test email
3. Navigate to "Connect IG"
4. Try connecting your Instagram account
5. Verify data appears in dashboard

### Test Worker
1. Check Railway logs
2. Verify worker is polling for jobs
3. Trigger a manual sync from Settings page
4. Check that job completes in logs

### Test Database
1. Go to Supabase dashboard
2. Check **SQL Editor**
3. Run: `SELECT * FROM profiles WHERE user_id = 'your-user-id';`
4. Verify your profile is there

## Production Checklist

- [ ] Web app deployed and accessible
- [ ] Worker deployed and running
- [ ] Edge Functions deployed
- [ ] All environment variables configured
- [ ] Database schema executed
- [ ] Storage bucket created
- [ ] SSL/HTTPS enabled (automatic on Vercel, Railway, Supabase)
- [ ] Backups configured in Supabase
- [ ] Monitoring and error tracking set up
- [ ] Custom domain configured (optional)

## Monitoring & Maintenance

### Set Up Error Tracking

1. **Sentry** (recommended)
   - Sign up at [sentry.io](https://sentry.io)
   - Create a project for each app
   - Add Sentry SDK to your code
   - Monitor errors in production

2. **Supabase Logs**
   - Go to Supabase dashboard
   - Check **Logs** for database errors
   - Set up alerts for unusual activity

### Monitor Worker Performance

1. **Railway Metrics**
   - Go to Railway dashboard
   - Check CPU, memory, and network usage
   - Set up alerts for high resource usage

2. **Job Logs**
   - Check worker logs regularly
   - Look for failed jobs
   - Monitor sync duration

### Database Maintenance

1. **Backups**
   - Supabase automatically backs up daily
   - Configure additional backups if needed
   - Test restore procedures

2. **Performance**
   - Monitor query performance
   - Check index usage
   - Optimize slow queries

## Scaling Considerations

### When to Scale

1. **Web App**
   - Vercel auto-scales based on traffic
   - No action needed for most use cases

2. **Worker**
   - Monitor CPU and memory usage
   - Scale up if processing many jobs
   - Consider multiple worker instances

3. **Database**
   - Monitor connections and query performance
   - Upgrade plan if needed
   - Archive old data if storage is full

### Optimization Tips

1. **Database**
   - Add indexes on frequently queried columns (already done)
   - Archive old data periodically
   - Optimize RLS policies

2. **Worker**
   - Batch job processing
   - Implement job prioritization
   - Add retry logic for failed jobs

3. **Web App**
   - Enable caching headers
   - Compress assets
   - Optimize images

## Troubleshooting Deployment

### Web App Won't Deploy
- Check build logs in Vercel/Netlify
- Verify all environment variables are set
- Ensure package.json has correct scripts
- Check for TypeScript errors: `pnpm typecheck`

### Worker Won't Start
- Check Railway logs for errors
- Verify environment variables are correct
- Ensure Node.js version is compatible
- Check that Supabase credentials are valid

### Edge Functions Won't Deploy
- Verify Supabase CLI is installed
- Check that you're logged in: `supabase auth list`
- Verify function syntax is correct
- Check Supabase logs for deployment errors

### Database Connection Issues
- Verify connection string is correct
- Check that Supabase project is active
- Ensure IP whitelist allows your app
- Check database logs in Supabase

## Rollback Procedures

### Rollback Web App
1. Go to Vercel/Netlify dashboard
2. Find previous deployment
3. Click "Rollback"
4. Confirm rollback

### Rollback Worker
1. Go to Railway dashboard
2. Find previous deployment
3. Click "Redeploy"
4. Confirm redeployment

### Rollback Database
1. Go to Supabase dashboard
2. Check **Backups**
3. Restore from backup if needed
4. Verify data integrity

## Security in Production

1. **Environment Variables**
   - Never commit `.env` files
   - Use platform-specific secret management
   - Rotate keys periodically

2. **HTTPS**
   - All connections use HTTPS (automatic)
   - Enable HSTS headers
   - Use security headers

3. **Database**
   - RLS policies are enforced
   - Regular backups are taken
   - Monitor access logs

4. **API Keys**
   - Service role key only in worker
   - Anon key only in frontend
   - Rotate keys periodically

## Cost Optimization

### Free Tier Options
- **Vercel**: 100GB bandwidth/month
- **Railway**: $5 credit/month
- **Supabase**: 500MB database, 1GB bandwidth
- **Netlify**: 100GB bandwidth/month

### Cost Estimation
- **Web App**: $0-20/month (Vercel)
- **Worker**: $5-50/month (Railway)
- **Database**: $0-100/month (Supabase)
- **Total**: ~$5-170/month depending on usage

### Cost Reduction Tips
- Use free tiers as much as possible
- Archive old data to reduce storage
- Optimize worker to process fewer jobs
- Cache data on frontend to reduce API calls

## Next Steps

1. Deploy to production following this guide
2. Test all functionality in production
3. Set up monitoring and alerts
4. Configure backups and disaster recovery
5. Plan for scaling and optimization

---

For more information, see the README.md and SETUP.md files.
