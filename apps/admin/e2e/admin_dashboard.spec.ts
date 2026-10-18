/**
 * Playwright End-to-End Test Suite for Opskl Trust & Operations Dashboard
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
    // Verify brand title and environment banner
    await expect(page.locator('text=OPSKL')).toBeVisible();
    await expect(page.locator('text=TRUST & OPS CONSOLE')).toBeVisible();

    // Verify key metrics panels
    await expect(page.locator('text=Gross Marketplace Volume (GMV)')).toBeVisible();
    await expect(page.locator('text=Active Event Shifts')).toBeVisible();
    await expect(page.locator('text=Verified Worker Roster')).toBeVisible();
    await expect(page.locator('text=Active Event Organizers')).toBeVisible();
  });

  test('navigates to verification queue and verifies compliance view', async ({ page }) => {
    // Click on Verification Queue
    await page.click('text=Verification Queue');
    await expect(page.locator('h1:has-text("Identity & Business Verification Queue")')).toBeVisible();

    // Verify KYC table headers
    await expect(page.locator('th:has-text("Applicant Profile")')).toBeVisible();
    await expect(page.locator('th:has-text("Document Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Masked ID Number")')).toBeVisible();

    // Verify either cases exist or clean state message is displayed
    const reviewButton = page.locator('button:has-text("Review Documents")').first();
    const emptyState = page.locator('text=No verification cases found matching current filters.');
    await expect(reviewButton.or(emptyState)).toBeVisible();

    if (await reviewButton.isVisible().catch(() => false)) {
      await reviewButton.click();
      await expect(page.locator('text=Adjudicate Verification Case')).toBeVisible();
      await expect(page.locator('button:has-text("Approve & Grant Badge")')).toBeVisible();
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('text=Adjudicate Verification Case')).not.toBeVisible();
    }
  });

  test('navigates to attendance disputes and verifies adjudication controls', async ({ page }) => {
    await page.click('text=Attendance Disputes');
    await expect(page.locator('h1:has-text("Attendance & Wage Disputes")')).toBeVisible();

    await expect(page.locator('th:has-text("Shift & Booking")')).toBeVisible();
    await expect(page.locator('th:has-text("Raised By")')).toBeVisible();

    const investigateBtn = page.locator('button:has-text("Investigate")').first();
    const emptyState = page.locator('text=No active attendance or wage disputes reported.');
    await expect(investigateBtn.or(emptyState)).toBeVisible();

    if (await investigateBtn.isVisible().catch(() => false)) {
      await investigateBtn.click();
      await expect(page.locator('text=Adjudicate Attendance & Wage Dispute')).toBeVisible();
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('text=Adjudicate Attendance & Wage Dispute')).not.toBeVisible();
    }
  });

  test('navigates to shift moderation and checks living wage compliance table', async ({ page }) => {
    await page.click('text=Shift Moderation');
    await expect(page.locator('h1:has-text("Shift Moderation & Minimum Wage Floor")')).toBeVisible();

    await expect(page.locator('th:has-text("Shift Title & Host")')).toBeVisible();
    await expect(page.locator('th:has-text("Wage / Rate")')).toBeVisible();

    const approveBtn = page.locator('button:has-text("Approve")').first();
    const emptyState = page.locator('text=No shifts currently in moderation queue.');
    await expect(approveBtn.or(emptyState)).toBeVisible();
  });

  test('inspects immutable administrative audit trail', async ({ page }) => {
    await page.click('text=Audit Logs');
    await expect(page.locator('h1:has-text("Immutable Administrative Audit Trail")')).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp (IST)")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("Admin User")')).toBeVisible();
  });
});
