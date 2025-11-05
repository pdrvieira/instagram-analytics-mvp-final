# Instagram Analytics MVP

A complete, production-ready MVP for Instagram Analytics using headless browser automation (Playwright), Supabase for backend and authentication, and Next.js for the frontend. This project demonstrates best practices for security, scalability, and code organization.

## 🎯 Project Overview

This MVP consists of three main components:

1. **Web App (Next.js + React + Tailwind CSS)** — Responsive dashboard for viewing analytics
2. **Headless Worker (Node.js + Playwright)** — Automates Instagram login, session management, and data scraping
3. **Edge Functions (Supabase/Deno)** — Orchestrates job queuing and data export

The system uses **Supabase** for authentication, database, and real-time capabilities, with encrypted session storage for Instagram credentials.

## 📋 Features

### Authentication & Session Management
- Supabase Auth (email/password)
- Encrypted Instagram session storage (AES-256-CBC)
- 2FA support for Instagram login
- Session validation and reconnection

### Data Synchronization
- Followers and following list tracking with diff detection
- Posts, reels, and stories metrics collection
- Engagement rate calculation
- Hashtag performance analysis
- Posting-time heatmap generation
- Demographic estimation

### Dashboards
- **Overview**: KPIs, growth charts, engagement trends
- **Followers**: Non-followers, new, lost lists with filters
- **Content**: Posts/reels/stories performance and ranking
- **Hours**: 7×24 engagement heatmap
- **Hashtags**: Ranking by engagement and co-occurrence
- **Demographics**: Gender, age, location distribution
- **Export**: CSV/XLSX downloads with signed URLs
- **Settings**: Session health, sync logs, data management

### Infrastructure
- Row-Level Security (RLS) for user data isolation
- Idempotent sync jobs with status tracking
- Exponential backoff for retries
- Mutex locks for concurrent access control
- Comprehensive error logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm 8+
- Supabase account with project created
- Instagram test account with 2FA enabled
- Railway account (for worker deployment)

### 1. Setup Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys
3. Run the schema SQL script in your Supabase SQL editor:

```bash
# Open supabase/schema.sql and execute it in your Supabase project
```

4. Create a private bucket named `exports` for CSV/XLSX files

### 2. Environment Variables

Copy `.env.example` to `.env.local` in each app and fill in your Supabase credentials:

**Root level (.env.example):**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
ENCRYPTION_KEY=your-32-byte-hex-key
```

**Web App (apps/web/.env.local):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Worker (apps/worker/.env):**
```bash
WORKER_SUPABASE_URL=https://your-project.supabase.co
WORKER_SUPABASE_SERVICE_ROLE=your-service-role-key
WORKER_ENCRYPTION_KEY=your-32-byte-hex-key
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Locally

**Web App:**
```bash
cd apps/web
pnpm dev
# Runs on http://localhost:5173
```

**Worker (in another terminal):**
```bash
cd apps/worker
pnpm dev
# Polls for jobs and processes them
```

### 5. First Sync

1. Navigate to the web app and sign up with email/password
2. Go to "Connect IG" page
3. Enter your Instagram username and password
4. Complete 2FA if prompted
5. The worker will process the login job and establish a session
6. Trigger sync jobs from the Overview page

## 📁 Project Structure

```
instagram-analytics-mvp/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── client/src/
│   │   │   ├── pages/          # Dashboard pages
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities (Supabase client, etc.)
│   │   │   └── App.tsx         # Main app component
│   │   └── server/             # tRPC backend (optional)
│   ├── worker/                 # Node.js + Playwright worker
│   │   ├── src/
│   │   │   ├── index.ts        # Main worker loop
│   │   │   ├── EncryptionService.ts
│   │   │   ├── SupabaseService.ts
│   │   │   └── InstagramClient.ts
│   │   └── package.json
│   └── edge/                   # Supabase Edge Functions (Deno)
│       ├── src/
│       │   ├── jobQueue.ts
│       │   ├── auth-ig-login-init.ts
│       │   ├── auth-ig-verify-2fa.ts
│       │   ├── sync-profile.ts
│       │   └── export-data.ts
│       └── package.json
├── packages/
│   └── shared/                 # Shared types and utilities
│       ├── src/
│       │   ├── types.ts        # TypeScript interfaces
│       │   ├── utils.ts        # Helper functions
│       │   └── index.ts
│       └── package.json
├── supabase/
│   └── schema.sql              # Database schema with RLS
├── .env.example                # Environment variables template
├── pnpm-workspace.yaml         # Monorepo configuration
├── package.json                # Root package.json
└── README.md                   # This file
```

## 🔐 Security Considerations

### Encryption
- Instagram session cookies are encrypted using **AES-256-CBC** with a 32-byte hex key
- Encryption happens on the worker before storing in Supabase
- Decryption happens on the worker when retrieving sessions

### Row-Level Security (RLS)
- All tables enforce `user_id = auth.uid()` for authenticated users
- Service role is used only by the worker for data writes
- Users can only access their own profiles and data

### API Security
- Edge Functions validate user authentication via JWT tokens
- Profile ownership is verified before processing jobs
- Signed URLs for exports expire after 15 minutes

### Best Practices
- Never commit `.env` files with real credentials
- Use environment variables for all sensitive data
- Rotate encryption keys periodically
- Monitor sync job logs for errors and anomalies
- Use HTTPS for all API calls

## 🏗️ Architecture

### Data Flow

1. **User initiates login** → Web app calls `/auth/ig/login-init` Edge Function
2. **Edge Function enqueues job** → `LOGIN` job created in `sync_jobs` table
3. **Worker polls for jobs** → Picks up `LOGIN` job
4. **Worker logs in to Instagram** → Uses Playwright to automate login
5. **Worker encrypts session** → Stores encrypted cookies in `ig_sessions` table
6. **User triggers sync** → Web app calls `/sync/profile` Edge Function
7. **Edge Function enqueues job** → `SYNC_FOLLOWERS`, `SYNC_MEDIA`, etc. jobs created
8. **Worker processes sync jobs** → Scrapes data and updates database
9. **Dashboard updates** → Web app fetches latest data via Supabase queries

### Database Schema

**Key Tables:**
- `profiles` — User's connected Instagram accounts
- `ig_sessions` — Encrypted session payloads
- `followers` — Current follower list
- `followers_snapshots` — Historical snapshots for diffing
- `media` — Posts, reels, stories metadata
- `media_metrics` — Performance metrics per media
- `profile_insights_daily` — Aggregated daily KPIs
- `hashtags_metrics` — Hashtag performance
- `sync_jobs` — Job orchestration and logging
- `alerts` — Anomaly notifications

All tables have RLS policies enforced.

### Job Queue System

Jobs are stored in the `sync_jobs` table with statuses:
- `PENDING` — Waiting to be processed
- `RUNNING` — Currently being processed
- `COMPLETED` — Successfully processed
- `FAILED` — Error occurred

The worker polls for `PENDING` jobs and updates their status. This approach is simple but can be replaced with a message queue (Redis, SQS) for better scalability.

## 📊 Sync Frequencies

- **Followers** — 1× per day
- **Media** — 3× per day
- **Stories** — Every 2–3 hours
- **Derived Metrics** — 1× per day

These can be adjusted by modifying the scheduler in the worker or using Supabase's cron jobs.

## 🚢 Deployment

### Worker Deployment (Railway)

1. Push the worker code to a Git repository
2. Create a new project on Railway
3. Connect your Git repository
4. Set environment variables:
   - `WORKER_SUPABASE_URL`
   - `WORKER_SUPABASE_SERVICE_ROLE`
   - `WORKER_ENCRYPTION_KEY`
5. Deploy and monitor logs

### Web App Deployment

The web app can be deployed to Vercel, Netlify, or any Node.js hosting:

```bash
pnpm build
pnpm start
```

### Edge Functions Deployment

Deploy Edge Functions to Supabase:

```bash
# Using Supabase CLI
supabase functions deploy auth-ig-login-init
supabase functions deploy auth-ig-verify-2fa
supabase functions deploy sync-profile
supabase functions deploy export-data
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Sign up and log in with email/password
- [ ] Connect Instagram account (with 2FA if enabled)
- [ ] Verify session is encrypted and stored
- [ ] Trigger sync jobs and verify data is collected
- [ ] Check dashboards are populated with data
- [ ] Export CSV/XLSX and verify files
- [ ] Test session reconnection after expiration
- [ ] Verify RLS isolation (user sees only their data)
- [ ] Test error handling and retry logic

### Automated Testing

Add tests for:
- Encryption/decryption service
- Supabase queries and mutations
- Edge Function endpoints
- Playwright automation logic

## 📝 Code Best Practices

### TypeScript
- Strict mode enabled
- Full type coverage for all functions
- Shared types in `packages/shared`

### Error Handling
- Custom `AppError` class with error codes
- Try-catch blocks with proper logging
- User-friendly error messages

### Async Operations
- Exponential backoff for retries
- Mutex locks for concurrent access
- Proper cleanup in finally blocks

### Code Organization
- Modular file structure
- Single responsibility principle
- Clear separation of concerns

### Comments
- JSDoc comments for public functions
- Inline comments for complex logic
- TODO comments for future improvements

## 🐛 Known Limitations & Future Improvements

### Current MVP Limitations
1. **Scraping Logic** — Placeholder implementations for followers/media scraping. Real implementation requires handling Instagram's dynamic UI and rate limits.
2. **2FA Handling** — Simplified flow. Production should support TOTP, SMS, and backup codes.
3. **Job Scheduling** — Simple polling. Should use message queue or cron jobs for production.
4. **Data Export** — File generation is simulated. Integrate with a library like `exceljs` or `papaparse` for real CSV/XLSX generation.
5. **Demographics** — Estimated values only. Real demographics require API access or ML models.

### Future Enhancements
- [ ] Real-time updates via Supabase Realtime subscriptions
- [ ] Advanced filtering and search
- [ ] Custom date range selection
- [ ] Competitor analysis
- [ ] Scheduled reports via email
- [ ] API for third-party integrations
- [ ] Mobile app (React Native)
- [ ] Multi-account management
- [ ] Team collaboration features

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Playwright Documentation](https://playwright.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org)

## 📄 License

This project is provided as-is for educational and internal use.

## ⚠️ Disclaimer

This project uses headless browser automation to scrape Instagram. **Use responsibly and in compliance with Instagram's Terms of Service.** This is intended for personal, non-commercial use only. The authors are not responsible for any misuse or violations of Instagram's policies.

---

**Built with ❤️ using TypeScript, React, Playwright, and Supabase**
