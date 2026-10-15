# Opskl — Two-Sided Single-Day Shift Marketplace

Opskl connects event organizers and corporate hosts with individuals seeking paid, single-day shifts across India (launching in Mumbai).

The product architecture comprises three client applications and shared packages:
1. **Opskl Worker (`apps/worker`)** — Native iOS and Android mobile app built for on-the-go shift workers (transparent daily wages, rapid discovery, swipe interest).
2. **Opskl Organizer (`apps/organizer`)** — Native iOS and Android mobile app built for event managers (shift posting, explicit crew vetting, real-time on-site attendance).
3. **Opskl Admin (`apps/admin`)** — Next.js 15+ web dashboard for platform governance, KYC review, audit trails, and escrow settlement monitoring.
4. **Shared Packages (`packages/`)** — `@opskil/shared` (domain types, Zod validation schemas, INR/IST formatters) and `@opskil/design-system` (theme tokens, mobile UI components).
Aryan add +1

---

## 📁 Monorepo Architecture

```
opskil/
├── apps/
│   ├── worker/                 # Opskl Worker Mobile App (React Native, Expo, Expo Router)
│   │   ├── app/                # File-based routes ((tabs), shift/[id], profile, earnings)
│   │   ├── assets/images/      # Worker branding (icon.png, splash-icon.png, adaptive icons)
│   │   ├── app.json            # com.opskil.worker, scheme: opskil-worker
│   │   ├── eas.json            # EAS Build configurations (dev, preview, prod)
│   │   ├── metro.config.js     # Monorepo workspace resolver
│   │   └── package.json
│   ├── organizer/              # Opskl Organizer Mobile App (React Native, Expo, Expo Router)
│   │   ├── app/                # File-based routes ((tabs), create, roster, shift/[id])
│   │   ├── assets/images/      # Organizer branding (icon.png, splash-icon.png, adaptive icons)
│   │   ├── app.json            # com.opskil.organizer, scheme: opskil-organizer
│   │   ├── eas.json            # EAS Build configurations (dev, preview, prod)
│   │   ├── metro.config.js     # Monorepo workspace resolver
│   │   └── package.json
│   └── admin/                  # Opskl Admin Dashboard (Next.js, TypeScript)
│       ├── src/app/            # App Router pages, layout, and audit logs
│       └── package.json
├── packages/
│   ├── design-system/          # Tokens (colors, spacing, typography) and Native UI components
│   │   ├── src/components/     # Button, Card, Badge, Input, Typography, ErrorBoundary
│   │   ├── src/tokens/         # Emerald/Obsidian palettes, INR typography, elevation
│   │   └── package.json
│   └── shared/                 # Business logic, validation schemas, localization
│       ├── src/types/          # Shift, WorkerProfile, OrganizerProfile, ApplicationStatus
│       ├── src/schemas/        # Zod ShiftCreateSchema, MobilePublicEnvSchema
│       ├── src/formatters/     # formatINR (₹), formatTimeRange, formatISTDate
│       └── package.json
├── .env.example                # Safe client vs server environment documentation
├── tsconfig.base.json          # Root TypeScript configuration
└── package.json                # Workspaces root and monorepo scripts
```

---

## 📱 Application Identifiers & Build Configurations

| App | Platform | Identifier / Package Name | URL Scheme | EAS Project ID |
| :--- | :--- | :--- | :--- | :--- |
| **Opskl Worker** | iOS (App Store) | `com.opskil.worker` | `opskil-worker://` | `placeholder-worker-project-id` |
| **Opskl Worker** | Android (Play Store) | `com.opskil.worker` | `opskil-worker://` | `placeholder-worker-project-id` |
| **Opskl Organizer** | iOS (App Store) | `com.opskil.organizer` | `opskil-organizer://` | `placeholder-organizer-project-id` |
| **Opskl Organizer** | Android (Play Store) | `com.opskil.organizer` | `opskil-organizer://` | `placeholder-organizer-project-id` |

*Note: Replace `placeholder-*-project-id` in `apps/worker/app.json` and `apps/organizer/app.json` with your real EAS project IDs via `eas init` when connecting to Expo Application Services.*

---

## 🎨 Opskl Design System

- **Palette**: Signature Opskl Deep Emerald (`#0F766E`) with Electric Teal (`#14B8A6`) accents and High-Contrast Slate Obsidian surfaces.
- **Indian Market Typography**: Large bold INR display (`WageText` / `₹1,850`), clear time ranges in IST, and high-visibility status badges (`LIVE`, `CONFIRMED`, `AWAITING SELECTION`).
- **Native Ergonomics**: Minimum 48dp touch targets, safe area inset adaptation, keyboard avoiding views, and custom `OpsklErrorBoundary` with recovery fallback.

---

## 🔐 Environment Variables & Security Rules

Opskl enforces strict separation between client-safe variables and server-side secrets:

1. **Client Mobile Apps (`EXPO_PUBLIC_*`)**:
   - `EXPO_PUBLIC_SUPABASE_URL`: Public Supabase REST URL.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Public Anon API key.
   - `EXPO_PUBLIC_APP_ENV`: `development` | `preview` | `production`.
   - `EXPO_PUBLIC_DEFAULT_CITY`: `Mumbai`.
2. **Server-Only Secrets (NEVER bundled into mobile apps)**:
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (used exclusively in secure Supabase Edge Functions and Admin Server Actions).
   - `DATABASE_URL`: Direct PostgreSQL connection string.

Copy `.env.example` to `.env` or set variables in your CI/EAS environment:
```bash
cp .env.example .env
```

---

## 🚀 Running the Apps Locally

### 1. Prerequisites
- **Node.js**: v20+ (tested on Node v26)
- **Package Manager**: npm v11+
- **macOS (for iOS simulator)**: Xcode installed from Mac App Store and Command Line Tools configured (`xcode-select --install`).
- **Android (for Android emulator)**: Android Studio with Android SDK Platform 34/35 and an active AVD emulator.

Install all workspace dependencies from root:
```bash
npm install
```

---

### 2. Opskl Worker App

#### Running on iOS Simulator:
```bash
npm run ios:worker
```
*Or:*
```bash
cd apps/worker
npx expo run:ios
```
*Press `i` in the Expo terminal to launch or switch simulators.*

#### Running on Android Emulator:
```bash
npm run android:worker
```
*Or:*
```bash
cd apps/worker
npx expo run:android
```
*Press `a` in the Expo terminal to open the running Android emulator.*

#### Running on a Physical Device:
1. Install **Expo Go** from the iOS App Store or Google Play Store.
2. Run:
   ```bash
   npm run start:worker
   ```
3. Scan the QR code displayed in your terminal using the Camera app (iOS) or Expo Go app (Android).
4. Both devices must be on the same local Wi-Fi network (or pass `--tunnel` via `npx expo start --tunnel`).

---

### 3. Opskl Organizer App

#### Running on iOS Simulator:
```bash
npm run ios:organizer
```

#### Running on Android Emulator:
```bash
npm run android:organizer
```

#### Running on a Physical Device:
```bash
npm run start:organizer
```
Scan the QR code in Expo Go to open the Organizer console.

---

### 4. Opskl Admin Dashboard

To start the Next.js admin dashboard locally on `http://localhost:3000`:
```bash
npm run dev:admin
```

To build the optimized production web bundle:
```bash
npm run build:admin
```

---

## 🧪 Testing & Code Quality

Run tests across all workspaces:
```bash
npm test
```

Run TypeScript strict type checking across all workspaces:
```bash
npm run typecheck
```

---

## 📦 Cloud Mobile Builds (Expo EAS Build)

Each app is equipped with `eas.json` containing `development`, `preview`, and `production` profiles.

### 1. Setup EAS CLI
```bash
npm install -g eas-cli
eas login
```

### 2. Build Worker App
```bash
cd apps/worker
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

### 3. Build Organizer App
```bash
cd apps/organizer
eas build --platform ios --profile preview
eas build --platform android --profile preview
```
