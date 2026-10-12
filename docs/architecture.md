# Opskl Monorepo Architecture Specification

## 1. System Overview
Opskl is a two-sided marketplace designed to connect event organizers with individuals seeking paid, single-day shifts in India (launching in the Mumbai Metropolitan Region).

The platform comprises:
1. **Worker Mobile App (`apps/worker`)**: Native iOS and Android application built for workers.
2. **Organizer Mobile App (`apps/organizer`)**: Native iOS and Android application built for event organizers.
3. **Admin Web Dashboard (`apps/admin`)**: Next.js 15 web application for platform compliance, escrow monitoring, and user verification.
4. **Shared Domain Packages**:
   - `@opskil/shared`: TypeScript domain models, Indian localization formatters (INR ₹, IST timestamps, phone/UPI validators), and safe diagnostic logging.
   - `@opskil/validation`: Zod validation schemas for shifts, worker onboarding, organizer registration, and auth payloads.
   - `@opskil/design-system`: Reusable React Native components (Button, Input, Card, Badge, BottomSheet, Dialog, ErrorBoundary) and design tokens.
5. **Backend Database (`supabase/migrations`)**: Versioned PostgreSQL schemas with strict Row Level Security (RLS) policies.

---

## 2. Monorepo Dependency Graph

```
apps/worker  ───────┐
                    │
apps/organizer ─────┼───► @opskil/design-system ───► @opskil/shared
                    │
apps/admin ─────────┼───► @opskil/validation ───────► @opskil/shared
                    │
                    └────────────────────────────────┘
```

---

## 3. Product Principles & Security Boundaries

### Two-Sided Marketplace Rule Enforcement:
- **Right Swipe = Express Interest**: Workers swiping right on a shift expresses interest; it does **not** create an automatic hire.
- **Organizer Selection**: Organizers must explicitly review candidate credentials and select workers for their roster.
- **Escrow Wage Guarantee**: Wages are funded into escrow before shifts begin, guaranteeing payment upon supervisor attendance approval.
- **Strict Permission Segregation**: Workers cannot view organizer administrative metrics or other workers' UPI details. Organizers cannot access administrative audit logs.

### Mobile Bundle Secret Isolation:
- Only environment variables with prefix `EXPO_PUBLIC_` are allowed in mobile apps.
- Backend service-role secrets (`SUPABASE_SERVICE_ROLE_KEY`) and direct PostgreSQL connection strings (`DATABASE_URL`) are strictly barred from mobile bundles.
