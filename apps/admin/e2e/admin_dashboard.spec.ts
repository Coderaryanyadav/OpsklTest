/**
 * Playwright End-to-End Test Suite for Opskl Admin Portal
 */
import { test, expect } from '@playwright/test';

test.describe('Opskl Admin Web Dashboard E2E Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(process.env.ADMIN_EMAIL || 'admin@opskil.com');
      await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'TestOpskilPassword2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/', { timeout: 10000 });
    }
  });

  test('renders platform overview and key operational metrics', async ({ page }) => {
    await expect(page.locator('text=OPSKL')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /LIVE|PAUSED/ })).toBeVisible();

    await expect(page.locator('text=Marketplace volume')).toBeVisible();
    await expect(page.locator('text=Active shifts')).toBeVisible();
    await expect(page.locator('text=Verified workers')).toBeVisible();
    await expect(page.locator('text=Active organizers')).toBeVisible();
  });

  test('navigates to verification queue and verifies compliance view', async ({ page }) => {
    await page.click('text=Verifications');
    await expect(page.locator('h1:has-text("Verifications")')).toBeVisible();

    await expect(page.locator('th:has-text("Applicant")')).toBeVisible();
    await expect(page.locator('th:has-text("Document")')).toBeVisible();
    await expect(page.locator('th:has-text("Masked ID")')).toBeVisible();

    const reviewButton = page.locator('button:has-text("Review")').first();
    const emptyState = page.locator('text=No verification cases match the current filters.');
    await expect(reviewButton.or(emptyState)).toBeVisible();

    if (await reviewButton.isVisible().catch(() => false)) {
      await reviewButton.click();
      await expect(page.locator('text=Review verification case')).toBeVisible();
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('text=Review verification case')).not.toBeVisible();
    }
  });

  test('navigates to attendance disputes and verifies adjudication controls', async ({ page }) => {
    await page.click('text=Disputes');
    await expect(page.locator('h1:has-text("Disputes")')).toBeVisible();

    await expect(page.locator('th:has-text("Shift & booking")')).toBeVisible();
    await expect(page.locator('th:has-text("Raised by")')).toBeVisible();

    const investigateBtn = page.locator('button:has-text("Investigate")').first();
    const emptyState = page.locator('text=No attendance or wage disputes reported.');
    await expect(investigateBtn.or(emptyState)).toBeVisible();

    if (await investigateBtn.isVisible().catch(() => false)) {
      await investigateBtn.click();
      await expect(page.locator('text=Adjudicate dispute')).toBeVisible();
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('text=Adjudicate dispute')).not.toBeVisible();
    }
  });

  test('navigates to shift moderation and checks living wage compliance table', async ({ page }) => {
    await page.click('text=Shifts');
    await expect(page.locator('h1:has-text("Shift moderation")')).toBeVisible();

    await expect(page.locator('th:has-text("Shift & host")')).toBeVisible();
    await expect(page.locator('th:has-text("Wage")')).toBeVisible();

    const approveBtn = page.locator('button:has-text("Approve")').first();
    const emptyState = page.locator('text=No shifts currently in the moderation queue.');
    await expect(approveBtn.or(emptyState)).toBeVisible();
  });

  test('inspects administrative audit trail', async ({ page }) => {
    await page.click('text=Audit logs');
    await expect(page.locator('h1:has-text("Audit logs")')).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp (IST)")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("Admin")')).toBeVisible();
  });
});
