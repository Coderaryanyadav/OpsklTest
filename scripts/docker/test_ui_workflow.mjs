#!/usr/bin/env node
/**
 * Real Chromium UI workflows for the three separately addressable web targets.
 *
 * Admin is Next.js. Worker and Organizer are Expo web static exports; this is
 * explicitly not an iOS/Android device test. The runner image uses a loopback
 * proxy because the Expo bundles are built with http://127.0.0.1:54321.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ADMIN = process.env.APP_ADMIN_URL || 'http://admin:3000';
const WORKER = process.env.APP_WORKER_URL || 'http://worker:8080';
const ORGANIZER = process.env.APP_ORGANIZER_URL || 'http://organizer:8080';
const REPORT_DIR = process.env.REPORT_DIR || '/reports';
fs.mkdirSync(REPORT_DIR, { recursive: true });

const creds = {
  admin: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  worker: { email: process.env.WORKER_EMAIL, password: process.env.WORKER_PASSWORD },
  organizer: { email: process.env.ORGANIZER_EMAIL, password: process.env.ORGANIZER_PASSWORD },
};

let passed = 0;
let failed = 0;
const checks = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    checks.push({ name, status: 'PASS' });
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    checks.push({ name, status: 'FAIL', detail });
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function screenshot(page, name) {
  const file = path.join(REPORT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

async function bodyText(page) {
  return (await page.locator('body').innerText().catch(() => '')) || '';
}

async function runAdmin(browser) {
  console.log('\n[UI] Admin (Next.js)');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`${ADMIN}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 30000 }).catch(() => {});
  check('unauthenticated admin route redirects to /login', new URL(page.url()).pathname === '/login', page.url());

  // A valid worker account must not be accepted by the admin portal.
  await page.fill('#admin-email', creds.worker.email);
  await page.fill('#admin-password', creds.worker.password);
  await page.click('button[type="submit"]');
  await page.getByText(/Access denied: Active administrator credentials/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  const deniedText = await bodyText(page);
  check(
    'worker credentials are denied by the admin portal',
    /Access denied: Active administrator credentials required/i.test(deniedText) && new URL(page.url()).pathname === '/login',
    deniedText.slice(0, 400)
  );

  await page.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#admin-email', creds.admin.email);
  await page.fill('#admin-password', creds.admin.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 40000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.getByText('LEDGER METRICS · LIVE QUEUES', { exact: false }).first().waitFor({ timeout: 40000 }).catch(() => {});
  check('admin password login reaches the dashboard', new URL(page.url()).pathname === '/', page.url());
  const adminBody = await bodyText(page);
  check('admin dashboard renders operational queues', /OPSKL/.test(adminBody) && /LEDGER METRICS/.test(adminBody), adminBody.slice(0, 300));
  await screenshot(page, 'admin-dashboard');

  await page.getByText('Verifications', { exact: true }).first().click();
  await page.getByText('PRIORITIZED INTAKE ROSTER', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  const verificationBody = await bodyText(page);
  check('admin verification queue is reachable', /PRIORITIZED INTAKE ROSTER/.test(verificationBody), verificationBody.slice(0, 300));
  check('seeded KYC case is visible to the admin', /Docker Test Worker|Docker Test Events/.test(verificationBody), verificationBody.slice(0, 500));
  await screenshot(page, 'admin-verifications');

  await page.getByText('Disputes', { exact: true }).first().click();
  await page.getByText('Disputes & Incident Escalation Center', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  check('admin disputes center is reachable', /Disputes & Incident Escalation Center/.test(await bodyText(page)), 'missing disputes heading');

  await page.getByText('Audit logs', { exact: true }).first().click();
  await page.getByText('Timestamp (IST)', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  check('admin audit log is reachable', /Timestamp \(IST\)/.test(await bodyText(page)), 'missing audit table heading');

  check('no uncaught admin page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 500));
  await context.close();
}

async function runWorker(browser) {
  console.log('\n[UI] Worker (Expo web target)');
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`${WORKER}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText('Email / Password', { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.getByText('Email / Password', { exact: true }).first().click();
  await page.locator('input[placeholder="name@example.com"]').fill(creds.worker.email);
  await page.locator('input[placeholder="At least 6 characters"]').fill(creds.worker.password);
  await page.getByText('Sign In with Password', { exact: true }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 40000 }).catch(() => {});
  await page.getByText('Shift Discovery', { exact: false }).first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.getByText('Docker Test Open Discovery Shift', { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  const workerBody = await bodyText(page);
  check('worker password login leaves the login route', !new URL(page.url()).pathname.startsWith('/auth/login'), page.url());
  check('worker feed renders', /Shift Discovery|Available Shifts/.test(workerBody), workerBody.slice(0, 400));
  check('worker feed shows an available seeded shift', /Docker Test Open Discovery Shift/.test(workerBody), workerBody.slice(0, 800));
  await screenshot(page, 'worker-feed');

  check('no uncaught worker page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 500));
  await context.close();
}

async function runOrganizer(browser) {
  console.log('\n[UI] Organizer (Expo web target)');
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`${ORGANIZER}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText('Password', { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.getByText('Password', { exact: true }).first().click();
  await page.locator('input[placeholder="organizer@agency.com"]').fill(creds.organizer.email);
  await page.locator('input[placeholder="Enter secure password"]').fill(creds.organizer.password);
  await page.getByText('Sign In to Organizer Portal', { exact: true }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 40000 }).catch(() => {});
  await page.getByText('Docker Test Events Pvt Ltd', { exact: false }).first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.getByText('Docker Test Hospitality Shift', { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  const organizerBody = await bodyText(page);
  check('organizer password login leaves the login route', !new URL(page.url()).pathname.startsWith('/auth/login'), page.url());
  check('organizer dashboard renders the verified business', /Docker Test Events Pvt Ltd/.test(organizerBody), organizerBody.slice(0, 500));
  check('organizer dashboard shows the seeded shift', /Docker Test Hospitality Shift/.test(organizerBody), organizerBody.slice(0, 700));
  await screenshot(page, 'organizer-dashboard');

  await page.goto(`${ORGANIZER}/roster`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const rosterBody = await bodyText(page);
  check('organizer roster route renders', /roster|crew|Docker Test Hospitality Shift/i.test(rosterBody), rosterBody.slice(0, 500));
  await screenshot(page, 'organizer-roster');

  check('no uncaught organizer page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 500));
  await context.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    await runAdmin(browser);
    await runWorker(browser);
    await runOrganizer(browser);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(REPORT_DIR, 'ui-checks.json'),
    JSON.stringify({ passed, failed, checks }, null, 2)
  );
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('UI WORKFLOW ERROR:', err?.stack || err?.message || err);
  fs.writeFileSync(
    path.join(REPORT_DIR, 'ui-checks.json'),
    JSON.stringify({ passed, failed, checks, fatal: err?.message || String(err) }, null, 2)
  );
  process.exit(1);
});
