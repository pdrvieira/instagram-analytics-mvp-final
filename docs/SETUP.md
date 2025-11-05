# Setup Guide - Instagram Analytics MVP

This guide will walk you through setting up the Instagram Analytics MVP locally.

## Prerequisites

- **Node.js** 18+ (download from [nodejs.org](https://nodejs.org))
- **pnpm** 8+ (install with `npm install -g pnpm`)
- **Supabase Account** (free tier available at [supabase.com](https://supabase.com))
- **Instagram Business or Creator Account** with 2FA enabled
- **Railway Account** (for worker deployment, optional for local testing)

## Step 1: Clone or Extract the Project

```bash
# If you have a zip file
unzip instagram-analytics-mvp.zip
cd instagram-analytics-mvp

# Or if cloning from Git
git clone <repository-url>
cd instagram-analytics-mvp
```

## Step 2: Install Dependencies

```bash
# Install all dependencies for the monorepo
pnpm install

# This will install dependencies for:
# - Root workspace
# - apps/web
# - apps/worker
# - apps/edge
# - packages/shared
```

## Step 3: Setup Supabase Project

### 3.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: `instagram-analytics-mvp` (or your choice)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to you
5. Click "Create new project" and wait for it to initialize

### 3.2 Get Your Credentials

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public key** (under "Project API keys")
   - **service_role key** (under "Project API keys")

### 3.3 Execute Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click **Run**
6. Wait for the schema to be created (you'll see success messages)

### 3.4 Create Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **Create a new bucket**
3. Name it: `exports`
4. Uncheck "Public bucket" (keep it private)
5. Click **Create bucket**

## Step 4: Generate Encryption Key

The worker needs a 32-byte hex encryption key for session storage.

```bash
# Generate a random 32-byte hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output - you'll need it in the next step
```

## Step 5: Configure Environment Variables

### 5.1 Root Level (`.env.local`)

Create a file named `.env.local` in the project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE=your-service-role-key-here

# Encryption (generated in Step 4)
ENCRYPTION_KEY=your-32-byte-hex-key-here
```

### 5.2 Web App (`apps/web/.env.local`)

Create a file named `.env.local` in `apps/web/`:

```bash
# Supabase (frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# App Configuration
VITE_APP_TITLE=Instagram Analytics MVP
VITE_APP_LOGO=https://your-logo-url.png
```

### 5.3 Worker (`apps/worker/.env`)

Create a file named `.env` in `apps/worker/`:

```bash
# Supabase (backend)
WORKER_SUPABASE_URL=https://your-project.supabase.co
WORKER_SUPABASE_SERVICE_ROLE=your-service-role-key-here

# Encryption
WORKER_ENCRYPTION_KEY=your-32-byte-hex-key-here

# Logging
LOG_LEVEL=info
```

## Step 6: Run Locally

### 6.1 Start the Web App

```bash
cd apps/web
pnpm dev
```

The web app will be available at `http://localhost:3000`

### 6.2 Start the Worker (in a new terminal)

```bash
cd apps/worker
pnpm start
```

The worker will start polling for jobs every 5 seconds.

### 6.3 Test the Application

1. Open `http://localhost:3000` in your browser
2. Sign up with an email address
3. You should be redirected to the dashboard
4. Navigate to **Connect IG** page
5. Enter your Instagram username and password
6. Complete 2FA if prompted
7. The worker will process the login job and save your session
8. Once connected, you can trigger syncs from the **Settings** page

## Step 7: Verify Everything Works

### Web App
- [ ] Sign up and login works
- [ ] Dashboard pages load
- [ ] Can navigate between pages
- [ ] Charts and data display correctly

### Worker
- [ ] Worker starts without errors
- [ ] Worker logs show job polling
- [ ] Login job completes successfully
- [ ] Session is saved in Supabase

### Database
- [ ] Check `profiles` table for your profile
- [ ] Check `ig_sessions` table for encrypted session
- [ ] Check `sync_jobs` table for job history

## Troubleshooting

### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Supabase connection errors
- Verify your credentials in `.env` files
- Check that your Supabase project is active
- Ensure the schema was executed successfully

### Worker not processing jobs
- Check that `WORKER_SUPABASE_SERVICE_ROLE` is correct
- Verify the encryption key matches between web app and worker
- Check worker logs for error messages

### Login fails with 2FA
- Ensure 2FA is enabled on your Instagram account
- Try disabling 2FA temporarily to test basic login
- Check worker logs for specific error messages

### "RLS policy violation" errors
- Verify the schema was executed completely
- Check that you're logged in with the correct user
- Ensure the service role key is correct in worker

## Next Steps

1. **Test the full workflow**:
   - Connect Instagram account
   - Trigger a manual sync
   - Verify data appears in dashboard

2. **Customize the application**:
   - Update branding in `VITE_APP_TITLE` and `VITE_APP_LOGO`
   - Modify dashboard colors in `apps/web/client/src/index.css`
   - Add custom features as needed

3. **Deploy to production**:
   - See `docs/DEPLOYMENT.md` for deployment instructions
   - Configure production environment variables
   - Set up monitoring and error tracking

4. **Set up automated syncs**:
   - Configure cron jobs for regular syncs
   - Set up notifications for important events
   - Create custom dashboards and reports

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the README.md for overview
3. Check Supabase documentation at [supabase.com/docs](https://supabase.com/docs)
4. Review the code comments and JSDoc documentation

## Security Notes

- Never commit `.env` files to version control
- Keep your Supabase credentials secret
- Use strong passwords for your Instagram account
- Enable 2FA on your Instagram account
- Rotate your encryption key periodically
- Use service role key only in backend (worker)

---

Once setup is complete, you're ready to use the Instagram Analytics MVP!
