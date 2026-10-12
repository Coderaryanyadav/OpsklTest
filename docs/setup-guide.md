# Opskl Local Setup & Environment Guide

## Prerequisites
- **Node.js**: `v20.x` or higher (verified on Node `v26.11.1`).
- **npm**: `v11.x` or higher.
- **Git**: Installed and configured.

---

## 1. Initial Installation
Clone the repository and install all dependencies from the root directory:
```bash
git clone <repo-url> opskil
cd opskil
npm install
```

---

## 2. Environment Configuration
Copy `.env.example` to create your local environment:
```bash
cp .env.example .env
```

Ensure client-safe keys are configured:
```ini
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
EXPO_PUBLIC_APP_ENV="development"
EXPO_PUBLIC_DEFAULT_CITY="Mumbai"
```

---

## 3. Running Applications

### Start the Worker App
```bash
npm run start:worker
```
- Press `i` to launch on the iOS simulator.
- Press `a` to launch on the Android emulator.
- Scan the QR code with **Expo Go** to run on a physical device.

### Start the Organizer App
```bash
npm run start:organizer
```
- Press `i` to launch on the iOS simulator.
- Press `a` to launch on the Android emulator.

### Start the Admin Dashboard
```bash
npm run dev:admin
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Verification & Testing
Run strict type checking across all packages:
```bash
npm run typecheck
```

Run unit test suites across all workspaces:
```bash
npm test
```

Build the admin production application:
```bash
npm run build:admin
```
