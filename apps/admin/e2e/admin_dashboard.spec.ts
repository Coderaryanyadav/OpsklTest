/**
 * Playwright End-to-End Test Suite for Opskl Admin Portal
 * Assertions match the current desk UI (AdminOverviewDesk / queue components), not MetricCards.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function loadE2eEnv() {
  const candidates = ['.env.e2e.local', '.env.local', '.env'];
  for (const name of candidates) {
    const full = path.join(__dirname, '..', name);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadE2eEnv();

test.describe('Opskl Admin readiness probes', () => {
  test('GET /api/health reports configuration readiness', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.service).toBe('opskil-admin');
    expect(body.status).toMatch(/ok|degraded/);
    expect(body.checks).toBeDefined();
  });
});

test.describe('Opskl Admin Web Dashboard E2E Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(process.env.ADMIN_EMAIL || 'admin@opskil.com');
      await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'TestOpskilPassword2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });
    }
  });

  test('renders platform overview and key operational metrics', async ({ page }) => {
    await expect(page.locator('text=OPSKL').first()).toBeVisible();
    await expect(page.getByText('LEDGER METRICS · LIVE QUEUES')).toBeVisible();
    await expect(page.getByText('ACTIVE LIVE SHIFTS')).toBeVisible();
    await expect(page.getByText(/MARKETPLACE PAUSE|RESUME MARKETPLACE/)).toBeVisible();
    await expect(page.getByText('REVIEW WORKLOAD (LIVE)')).toBeVisible();
  });

  test('navigates to verification queue and verifies compliance view', async ({ page }) => {
    await page.getByRole('button', { name: /Verifications/i }).or(page.getByText('Verifications')).first().click();
    await expect(page.getByText('Verifications').first()).toBeVisible();
    await expect(page.getByText(/Worker Identity Verification/i)).toBeVisible();
    await expect(page.getByText(/OCR engine: not connected/i)).toBeVisible();
    await expect(page.getByText(/Pending Review/i).first()).toBeVisible();

    const reviewControl = page.getByRole('button', { name: /Review|Approve Worker KYC/i }).first();
    const emptyState = page.getByText(/No verification cases match/i);
    await expect(reviewControl.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('navigates to attendance disputes and verifies adjudication controls', async ({ page }) => {
    await page.getByText('Disputes', { exact: true }).first().click();
    await expect(page.getByText('Disputes').first()).toBeVisible();
    await expect(page.getByText(/Disputes & Incident Escalation Center/i)).toBeVisible();
    await expect(page.getByText(/OPEN DISPUTES/i)).toBeVisible();
    await expect(page.getByText(/LEGAL AUDIT ACTIVE/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Active Investigation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All \(/i })).toBeVisible();
  });

  test('navigates to shift moderation and checks living wage compliance table', async ({ page }) => {
    await page.getByText('Shifts', { exact: true }).first().click();
    await expect(page.getByText('Shift moderation').first()).toBeVisible();
    await expect(page.getByText(/Event Shift Moderation|Fair Wage/i).first()).toBeVisible();
    await expect(page.getByText('SHIFT REF / ORGANIZER')).toBeVisible();
    await expect(page.getByText('WAGE RATE')).toBeVisible();
    await expect(page.getByText('STATUS')).toBeVisible();
    await expect(page.getByRole('button', { name: /Flagged for Wage Review/i })).toBeVisible();
  });

  test('inspects administrative audit trail', async ({ page }) => {
    await page.getByText('Audit logs').first().click();
    await expect(page.getByText('Audit logs').first()).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp (IST)")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("Admin")')).toBeVisible();
  });
});
