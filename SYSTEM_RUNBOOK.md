# Opskl Platform — System Runbook & Launch Guide

This document contains every credential, endpoint, environment variable, architecture invariant, and terminal command needed to start, run, and administer the entire Opskl marketplace (Worker App, Organizer App, and Admin Dashboard).

---

## 1. Live Endpoints & Port Allocation

| Component | Port / Host | Description |
|---|---|---|
| **Admin Dashboard (Vercel)** | `https://admin-blue-beta-41.vercel.app` | Production Admin Operations Console |
| **Admin Dashboard (Local)** | `http://localhost:3000` | Local Next.js 15 dev server |
| **Worker Mobile App (Metro)** | `http://localhost:8081` | Expo Metro Bundler for Worker App |
| **Organizer Mobile App (Metro)**| `http://localhost:8082` | Expo Metro Bundler for Organizer App |
| **Remote Database** | `lericvniqdbvacgegrbp.supabase.co` | Supabase PostgreSQL + Auth + Realtime |

---

## 2. Master Credentials

### Administrator (Trust & Operations Console)
- **Portal URL**: `https://admin-blue-beta-41.vercel.app/login` (or `http://localhost:3000/login`)
- **Email**: `admin@opskil.com`
- **Password**: `OpsklAdmin#2026!`
- **Role**: `admin`
- **Capabilities**:
  - Worker KYC Document Approvals (Aadhaar / PAN)
  - Organizer GSTIN / Business Verification
  - Attendance Dispute Arbitration & Escrow Release
  - Living Wage Floor Moderation
  - Emergency Market Killswitch (Pause / Resume Bookings)

### Test Accounts (Provisioned for Quick Testing)
- **Worker**: Create via phone OTP in the Worker app, or log in after admin approves KYC.
- **Organizer**: Create via phone OTP in the Organizer app, or log in after admin approves business profile.

---

## 3. How to Start All Applications

From the repository root (`/Users/aryan/Desktop/PROJECTS/OPSKIL`):

### Start All Services Simultaneously
```bash
# Terminal 1: Admin Console
npm run dev:admin

# Terminal 2: Worker App (Port 8081)
npm run start:worker

# Terminal 3: Organizer App (Port 8082)
npm run start:organizer
```

### Launch on Mobile Emulators / Physical Devices
```bash
# Worker App:
npm run android:worker   # Android Emulator / Device
npm run ios:worker       # iOS Simulator
npm run web:worker       # Web Browser preview (if configured)

# Organizer App:
npm run android:organizer # Android Emulator / Device
npm run ios:organizer     # iOS Simulator
npm run web:organizer     # Web Browser preview (if configured)
```

---

## 4. End-to-End Workflow & Governance Rules

The application strictly enforces the following end-to-end operational invariants:

```
[WORKER]
1. Signs up with Phone / Email
2. Fills Profile & Submits KYC Document (Aadhaar / PAN)
3. Status = 'pending' -> Discovery feed shows [KYC PENDING]
   * Applying for shifts is HARD-BLOCKED with KYC_NOT_VERIFIED
4. Admin opens Admin Portal (https://admin-blue-beta-41.vercel.app)
   * Navigates to Verification Queue
   * Reviews document and clicks [Approve]
5. Worker status becomes 'verified'
6. Worker swipes right on open shift -> Application succeeds (status: 'applied')
   * Application instantly streams to Organizer's live roster in real time.

[ORGANIZER]
1. Registers event management company / agency
2. Fills business details & GSTIN/license
3. Status = 'pending' -> Shift creation is HARD-BLOCKED with FORBIDDEN_ROLE
4. Admin reviews Organizer in Verification Queue and clicks [Approve]
5. Organizer status becomes 'verified' -> Shift posting unlocks
6. Organizer posts shift in BKC, NESCO, or South Mumbai with living wage floor (>= ₹100/hr)
7. Worker applications stream into the roster console in real time
8. Organizer confirms worker -> Atomic booking created (status: 'confirmed')
   * Worker receives authoritative 60-second CSPRNG check-in code (OP-XXXXXXXXXX)
9. On shift day, worker checks in on-site within 300m GPS geofence
10. Fiscal year sequential invoice is generated (OPS/YY-YY/XXXXX) with 10% platform fee and 18% GST.
```

---

## 5. Automated Verification Checklist

Run these commands at any time to guarantee 0 errors across all layers:

```bash
# 1. Run all 11 monorepo test suites & compilation checks:
npm run check:all

# 2. Run deep live end-to-end database simulation:
node scripts/e2e_platform_simulation.mjs

# 3. Deploy/verify database migrations:
node --env-file=.env scripts/deploy_migrations.mjs

# 4. Monorepo TypeScript check across all 6 workspaces:
npm run typecheck
```

---

## 6. Environment Variables Reference

Stored securely in `.env` and `.env.local`:

```ini
EXPO_PUBLIC_SUPABASE_URL="https://lericvniqdbvacgegrbp.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.lericvniqdbvacgegrbp.supabase.co:5432/postgres"

# Next.js Admin
NEXT_PUBLIC_SUPABASE_URL="https://lericvniqdbvacgegrbp.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
NEXT_PUBLIC_APP_ENV="production"
```
