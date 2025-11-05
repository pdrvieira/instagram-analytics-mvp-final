# Instagram Analytics MVP - Project Structure

This document describes the folder organization and best practices used in this project.

## 📁 Directory Structure

```
instagram-analytics-mvp/
├── apps/                           # Monorepo applications
│   ├── web/                        # Next.js frontend application
│   │   ├── client/                 # React frontend code
│   │   │   ├── public/             # Static assets
│   │   │   ├── src/
│   │   │   │   ├── components/     # Reusable React components
│   │   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── pages/          # Page components (route-based)
│   │   │   │   │   ├── Home.tsx
│   │   │   │   │   ├── Overview.tsx
│   │   │   │   │   ├── ConnectIG.tsx
│   │   │   │   │   ├── Followers.tsx
│   │   │   │   │   ├── Content.tsx
│   │   │   │   │   ├── Hours.tsx
│   │   │   │   │   ├── Hashtags.tsx
│   │   │   │   │   ├── Demographics.tsx
│   │   │   │   │   ├── Export.tsx
│   │   │   │   │   ├── Settings.tsx
│   │   │   │   │   └── NotFound.tsx
│   │   │   │   ├── hooks/          # Custom React hooks
│   │   │   │   │   ├── useSupabaseAuth.ts
│   │   │   │   │   └── useProfile.ts
│   │   │   │   ├── contexts/       # React contexts
│   │   │   │   │   └── ThemeContext.tsx
│   │   │   │   ├── lib/            # Utility libraries
│   │   │   │   │   ├── supabase.ts
│   │   │   │   │   └── trpc.ts
│   │   │   │   ├── App.tsx         # Root component with routing
│   │   │   │   ├── main.tsx        # Entry point
│   │   │   │   └── index.css       # Global styles
│   │   │   └── index.html          # HTML template
│   │   ├── server/                 # Express backend
│   │   │   ├── _core/              # Core framework files
│   │   │   │   ├── context.ts
│   │   │   │   ├── cookies.ts
│   │   │   │   ├── env.ts
│   │   │   │   ├── llm.ts
│   │   │   │   ├── map.ts
│   │   │   │   ├── notification.ts
│   │   │   │   ├── trpc.ts
│   │   │   │   └── voiceTranscription.ts
│   │   │   ├── db.ts               # Database query helpers
│   │   │   ├── routers.ts          # tRPC procedure definitions
│   │   │   └── index.ts            # Server entry point
│   │   ├── drizzle/                # Database schema and migrations
│   │   │   └── schema.ts
│   │   ├── shared/                 # Shared utilities
│   │   ├── package.json            # Web app dependencies
│   │   ├── tsconfig.json           # TypeScript configuration
│   │   └── vite.config.ts          # Vite build configuration
│   │
│   ├── worker/                     # Node.js headless worker
│   │   ├── src/
│   │   │   ├── EncryptionService.ts    # Session encryption/decryption
│   │   │   ├── SupabaseService.ts      # Database operations
│   │   │   ├── InstagramClient.ts      # Playwright automation
│   │   │   └── index.ts                # Main job processing loop
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── edge/                       # Supabase Edge Functions
│       ├── src/
│       │   ├── jobQueue.ts             # Job enqueueing utilities
│       │   ├── auth-ig-login-init.ts   # Login initiation endpoint
│       │   ├── auth-ig-verify-2fa.ts   # 2FA verification endpoint
│       │   ├── sync-profile.ts         # Sync job enqueueing
│       │   └── export-data.ts          # Data export endpoint
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                       # Shared packages
│   └── shared/                     # Shared types and utilities
│       ├── src/
│       │   ├── types.ts            # TypeScript type definitions
│       │   ├── utils.ts            # Utility functions
│       │   └── index.ts            # Package exports
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                       # Database schema
│   └── schema.sql                  # Complete database schema with RLS
│
├── docs/                           # Documentation
│   ├── SETUP.md                    # Setup instructions
│   ├── DEPLOYMENT.md               # Deployment guide
│   └── API.md                      # API documentation
│
├── package.json                    # Root package.json (monorepo)
├── pnpm-workspace.yaml             # pnpm workspace configuration
├── tsconfig.json                   # Root TypeScript configuration
├── .gitignore                      # Git ignore rules
├── README.md                       # Project README
└── PROJECT_STRUCTURE.md            # This file
```

## 🏗️ Architecture Overview

### Web App (`apps/web`)
- **Framework**: Next.js with React 19
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Data Fetching**: TanStack Query
- **Visualization**: Recharts
- **Authentication**: Supabase Auth
- **Backend**: Express + tRPC

**Frontend Structure:**
- `components/` — Reusable UI components
- `pages/` — Route-based page components
- `hooks/` — Custom React hooks for data fetching and auth
- `contexts/` — React context providers
- `lib/` — Utility functions and client initialization

**Backend Structure:**
- `server/routers.ts` — tRPC procedure definitions
- `server/db.ts` — Database query helpers
- `server/_core/` — Framework core (auth, context, etc.)

### Worker (`apps/worker`)
- **Runtime**: Node.js
- **Browser Automation**: Playwright
- **Database**: Supabase (service role)
- **Encryption**: AES-256-CBC for session storage

**Key Files:**
- `InstagramClient.ts` — Playwright-based Instagram automation
- `EncryptionService.ts` — Session encryption/decryption
- `SupabaseService.ts` — Database operations
- `index.ts` — Main job processing loop

### Edge Functions (`apps/edge`)
- **Runtime**: Deno
- **Framework**: Supabase Edge Functions
- **Authentication**: JWT validation
- **Purpose**: Job orchestration and data export

**Endpoints:**
- `/auth/ig/login-init` — Initiate Instagram login
- `/auth/ig/verify-2fa` — Handle 2FA verification
- `/sync/*` — Sync job enqueueing
- `/export/data` — Generate signed URLs for exports

### Shared Package (`packages/shared`)
- **Purpose**: Shared types and utilities across all apps
- **Contents**: TypeScript interfaces, error codes, logging utilities

## 📋 Best Practices Implemented

### React Best Practices
1. **Component Organization**
   - Functional components with hooks
   - Proper separation of concerns
   - Reusable component library (shadcn/ui)
   - Clear naming conventions

2. **State Management**
   - TanStack Query for server state
   - React Context for UI state
   - Proper hook dependencies
   - No prop drilling

3. **Performance**
   - Code splitting with dynamic imports
   - Lazy loading of components
   - Optimized re-renders
   - Memoization where needed

4. **Styling**
   - Utility-first CSS (Tailwind)
   - Consistent design tokens
   - Responsive design (mobile-first)
   - Dark/light theme support

### Node.js Best Practices
1. **Project Structure**
   - Clear separation of concerns
   - Modular architecture
   - Single responsibility principle
   - Proper error handling

2. **Security**
   - Environment variable management
   - Encrypted session storage
   - Input validation
   - SQL injection prevention (Supabase)

3. **Error Handling**
   - Custom error classes
   - Proper HTTP status codes
   - Comprehensive logging
   - Graceful degradation

4. **Testing Ready**
   - Modular functions
   - Dependency injection
   - Clear interfaces
   - Mockable dependencies

### TypeScript Best Practices
1. **Type Safety**
   - Strict mode enabled
   - Proper type definitions
   - No `any` types
   - Shared types across apps

2. **Code Quality**
   - JSDoc comments
   - Clear function signatures
   - Proper error typing
   - Generic types for reusability

### Database Best Practices
1. **Schema Design**
   - Normalized tables
   - Proper foreign keys
   - Indexes on frequently queried columns
   - Timestamp tracking (created_at, updated_at)

2. **Security**
   - Row-Level Security (RLS) on all tables
   - User data isolation
   - Service role for worker operations
   - Encrypted sensitive data

3. **Performance**
   - Strategic indexes
   - Query optimization
   - Pagination ready
   - Materialized view candidates

## 🔄 Data Flow

### Authentication Flow
```
User → Web App → Supabase Auth → JWT Token → Protected Routes
```

### Instagram Sync Flow
```
Web App → Edge Function → Supabase (sync_jobs) → Worker → Instagram API → Supabase (data tables)
```

### Data Display Flow
```
Supabase (RLS) → TanStack Query → React Components → UI Rendering
```

## 📦 Dependencies

### Web App
- `next` — React framework
- `react` — UI library
- `tailwindcss` — Styling
- `@tanstack/react-query` — Data fetching
- `recharts` — Charting
- `@supabase/supabase-js` — Database client
- `lucide-react` — Icons
- `shadcn/ui` — UI components

### Worker
- `playwright` — Browser automation
- `@supabase/supabase-js` — Database client
- `crypto` — Encryption

### Edge Functions
- `deno` — Runtime

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Setup Environment Variables**
   - Copy `.env.example` files
   - Fill in your Supabase credentials
   - Set encryption key for worker

3. **Setup Supabase**
   - Execute `supabase/schema.sql` in your Supabase project
   - Create `exports` bucket for CSV/XLSX files

4. **Run Locally**
   ```bash
   # Web app
   cd apps/web && pnpm dev

   # Worker
   cd apps/worker && pnpm start
   ```

5. **Deploy**
   - Web app: Deploy to Vercel or similar
   - Worker: Deploy to Railway
   - Edge Functions: Deploy to Supabase

## 📚 Documentation Files

- **README.md** — Project overview and quick start
- **PROJECT_STRUCTURE.md** — This file
- **docs/SETUP.md** — Detailed setup instructions
- **docs/DEPLOYMENT.md** — Deployment guide
- **docs/API.md** — API documentation

## 🔐 Security Considerations

1. **Environment Variables** — Never commit `.env` files
2. **Session Encryption** — Instagram credentials are AES-256-CBC encrypted
3. **RLS Policies** — All tables have proper row-level security
4. **API Keys** — Service role key only used in worker
5. **User Isolation** — Complete data isolation per user

## 🎯 Next Steps

1. Review the README.md for quick start
2. Check docs/SETUP.md for detailed setup
3. Review docs/DEPLOYMENT.md for deployment
4. Execute supabase/schema.sql in your project
5. Configure environment variables
6. Run locally to test
7. Deploy to production

---

For more information, see the README.md and documentation files.
