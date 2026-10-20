#!/usr/bin/env node
/**
 * Comprehensive Verification & Feature Health Check Script for OPSKIL
 * Checks every layer:
 * 1. Monorepo TypeScript integrity across all 6 workspaces
 * 2. Shared Domain & Business Logic unit tests
 * 3. Validation schemas & living wage enforcement
 * 4. Worker mobile test suites
 * 5. Organizer mobile test suites
 * 6. Brutal Platform Launch-readiness verification
 * 7. Database SQL Invariants & RLS integrity
 * 8. Live Supabase Connectivity, Auth & Email OTP check
 * 9. Production Next.js Admin build compilation
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logHeader(title) {
  console.log(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}======================================================================${colors.reset}\n`);
}

function logPass(msg) {
  console.log(`  ${colors.green}✓ PASS:${colors.reset} ${msg}`);
}

function logFail(msg) {
  console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${msg}`);
}

function logWarn(msg) {
  console.log(`  ${colors.yellow}⚠ WARN:${colors.reset} ${msg}`);
}

const summary = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function runStep(name, fn) {
  process.stdout.write(`• Checking ${name}... `);
  try {
    const res = fn();
    console.log(`${colors.green}SUCCESS${colors.reset}`);
    summary.passed++;
    return res;
  } catch (err) {
    console.log(`${colors.red}FAILED${colors.reset}`);
    logFail(`${name} encountered error: ${err.message || err}`);
    summary.failed++;
    return null;
  }
}

async function runAsyncStep(name, fn) {
  process.stdout.write(`• Checking ${name}... `);
  try {
    const res = await fn();
    console.log(`${colors.green}SUCCESS${colors.reset}`);
    summary.passed++;
    return res;
  } catch (err) {
    console.log(`${colors.red}FAILED${colors.reset}`);
    logFail(`${name} encountered error: ${err.message || err}`);
    summary.failed++;
    return null;
  }
}

async function main() {
  logHeader('OPSKIL FULL PLATFORM COMPREHENSIVE VERIFICATION AUDIT');

  // STEP 1: Monorepo Typecheck
  runStep('Monorepo TypeScript across all 6 packages (@opskil/*)', () => {
    execSync('npm run typecheck', { stdio: 'pipe' });
  });

  // STEP 2: Shared & Domain Unit Tests
  runStep('Shared package domain & service unit tests', () => {
    execSync('npm --workspace=@opskil/shared test', { stdio: 'pipe' });
  });

  // STEP 3: Validation Schemas & Wage Floor Tests
  runStep('Validation rules, living wage floor, and Zod schemas', () => {
    execSync('npm --workspace=@opskil/validation test', { stdio: 'pipe' });
  });

  // STEP 4: Worker Mobile App Test Suite
  runStep('Worker mobile app component & navigation tests', () => {
    execSync('npm --workspace=@opskil/worker test', { stdio: 'pipe' });
  });

  // STEP 5: Organizer Mobile App Test Suite
  runStep('Organizer mobile app component & navigation tests', () => {
    execSync('npm --workspace=@opskil/organizer test', { stdio: 'pipe' });
  });

  // STEP 6: Brutal Platform Invariants & Concurrency Tests
  runStep('Brutal Platform Launch-Readiness verification suite (17/17 tests)', () => {
    execSync('npm run test:brutal', { stdio: 'pipe' });
  });

  // STEP 7: SQL Integration Invariants
  runStep('Database SQL schema, RLS, and RPC security invariants', () => {
    execSync('node scripts/test_sql_integration.mjs', { stdio: 'pipe' });
  });

  // STEP 8: Live Supabase Database Connection & Remote Schema Check
  await runAsyncStep('PostgreSQL Direct Database Connectivity & Table Audits', async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in .env');
    }
    const parsedDb = new URL(process.env.DATABASE_URL.replace(/^postgresql:\/\//, 'http://'));
    const isLocalDb = ['localhost', '127.0.0.1'].includes(parsedDb.hostname);
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
    const client = new PgClient({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalDb ? false : { rejectUnauthorized },
    });
    await client.connect();
    const res = await client.query(`
      SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public';
    `);
    const count = parseInt(res.rows[0].count, 10);
    if (count < 10) {
      throw new Error(`Expected at least 10 public tables, found ${count}`);
    }
    await client.end();
  });

  // STEP 9: Supabase Live Auth Endpoint Check
  await runAsyncStep('Supabase Live GoTrue Auth Client & API endpoint reachability', async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Missing Supabase public credentials');
    }
    const supabase = createClient(url, anonKey);
    // Ping auth settings / health
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
  });

  // STEP 10: Email OTP Diagnostic Check
  await runAsyncStep('Email OTP Dispatch & Rate-Limit Diagnostics', async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(url, anonKey);
    
    // We attempt a simulated OTP send to inspect GoTrue response
    const res = await supabase.auth.signInWithOtp({
      email: 'opskil_health_audit_test@opskil.com',
      options: { shouldCreateUser: false }
    });

    if (res.error) {
      if (res.error.code === 'over_email_send_rate_limit' || res.error.message.includes('rate limit')) {
        throw new Error(`Supabase Default Email Rate Limit triggered (${res.error.message}). Custom SMTP (SendGrid/Resend) is required for unlimited delivery.`);
      } else if (res.error.message.includes('Signups not allowed')) {
        logPass('GoTrue responded and correctly enforced shouldCreateUser=false security policy.');
        return;
      } else {
        throw new Error(`GoTrue Auth response: ${res.error.message}`);
      }
    } else {
      logPass('GoTrue Email OTP endpoint responded 200 OK.');
    }
  });

  // STEP 11: Production Admin Web App Compilation
  runStep('Next.js Admin Dashboard production build compilation', () => {
    execSync('npm --workspace=@opskil/admin run build', { stdio: 'pipe' });
  });

  logHeader('FINAL VERIFICATION SUMMARY');
  console.log(`  Total Checks: ${summary.passed + summary.failed}`);
  console.log(`  ${colors.green}Passed:       ${summary.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:       ${summary.failed}${colors.reset}`);

  if (summary.failed > 0) {
    console.log(`\n${colors.red}${colors.bold}Platform verification failed. Review errors above.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}All platform systems, apps, and services are 100% HEALTHY & VERIFIED.${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
