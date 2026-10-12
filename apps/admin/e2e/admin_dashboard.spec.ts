/**
 * Playwright End-to-End Test Suite for Opskl Trust & Operations Dashboard
 */
import { test, expect } from '@playwright/test';

test.describe('Opskl Admin Web Dashboard E2E Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard root
    await page.goto('/');
  });

  test('renders platform overview and key operational metrics', async ({ page }) => {
    // Verify brand title and environment banner
    await expect(page.locator('text=OPSKL')).toBeVisible();
    await expect(page.locator('text=TRUST & OPS CONSOLE')).toBeVisible();

    // Verify key metrics panels
    await expect(page.locator('text=Gross Marketplace Volume (GMV)')).toBeVisible();
    await expect(page.locator('text=Total Shifts Completed')).toBeVisible();
    await expect(page.locator('text=Active Worker Roster')).toBeVisible();
  });

  test('navigates to verification queue and opens review modal', async ({ page }) => {
    // Click on Verification Queue
    await page.click('text=Verification Queue');
    await expect(page.locator('h1:has-text("Identity & Business Verification Queue")')).toBeVisible();

    // Verify KYC table has action button
    const reviewButton = page.locator('button:has-text("Review Documents")').first();
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    // Verify modal appears
    await expect(page.locator('text=Adjudicate Verification Case')).toBeVisible();
    await expect(page.locator('button:has-text("Approve & Grant Badge")')).toBeVisible();

    // Dismiss modal cleanly
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Adjudicate Verification Case')).not.toBeVisible();
  });

  test('navigates to attendance disputes and verifies adjudication controls', async ({ page }) => {
    await page.click('text=Attendance Disputes');
    await expect(page.locator('h1:has-text("Attendance & Wage Disputes")')).toBeVisible();

    const investigateBtn = page.locator('button:has-text("Investigate")').first();
    await expect(investigateBtn).toBeVisible();
    await investigateBtn.click();

    await expect(page.locator('text=Adjudicate Attendance & Wage Dispute')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Adjudicate Attendance & Wage Dispute')).not.toBeVisible();
  });

  test('navigates to shift moderation and checks living wage compliance table', async ({ page }) => {
    await page.click('text=Shift Moderation');
    await expect(page.locator('h1:has-text("Shift Moderation & Minimum Wage Floor")')).toBeVisible();

    // Verify moderation action buttons exist in table
    await expect(page.locator('button:has-text("Approve")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Pause")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")').first()).toBeVisible();
  });

  test('inspects immutable administrative audit trail', async ({ page }) => {
    await page.click('text=Audit Logs');
    await expect(page.locator('h1:has-text("Immutable Administrative Audit Trail")')).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp (IST)")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("Admin User")')).toBeVisible();
  });
});
