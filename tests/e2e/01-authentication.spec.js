import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Authentication Flow
 */

// Create unique test user for this test run
const testUser = {
  email: `testuser_${Date.now()}@test.com`,
  password: 'TestPass123!',
  role: 'user'
};

test.describe('Authentication - Step by Step', () => {
  
  test.describe('Step 1: UI - Login Page Display', () => {
    test('1.1 - should load login page successfully', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });
    });

    test('1.2 - should display all login form elements', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h2')).toContainText('Container Management System');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
  });

  test.describe('Step 2: Registration - Create New User', () => {
    test('2.1 - should switch to registration form', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Sign Up")');
      await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
      await expect(page.locator('select[id="role"]')).toBeVisible();
    });

    test('2.2 - should validate password match', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Sign Up")');
      
      const timestamp = Date.now();
      await page.fill('input[type="email"]', `temp${timestamp}@test.com`);
      await page.fill('input[id="password"]', 'password123');
      await page.fill('input[id="confirmPassword"]', 'differentpassword');
      await page.selectOption('select[id="role"]', 'user');
      
      await page.click('button[type="submit"]');
      await expect(page.getByText('Passwords do not match')).toBeVisible();
    });

    test('2.3 - should successfully register new user', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Sign Up")');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[id="password"]', testUser.password);
      await page.fill('input[id="confirmPassword"]', testUser.password);
      await page.selectOption('select[id="role"]', 'user');
      
      await page.click('button[type="submit"]');
      
      await expect(page.getByText('Account created successfully')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
      
      console.log('✓ Test user created:', testUser.email);
    });
  });

  test.describe('Step 3: Login - Authenticate User', () => {
    test('3.1 - should show error for empty fields', async ({ page }) => {
      await page.goto('/');
      await page.click('button[type="submit"]');
      
      const emailInput = page.locator('input[type="email"]');
      const isValid = await emailInput.evaluate((el) => el.checkValidity());
      expect(isValid).toBe(false);
    });

    test('3.2 - should successfully login with registered user', async ({ page }) => {
      await page.goto('/');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/services', { timeout: 15000 });
      await expect(page.locator('h1, .main-title')).toBeVisible();
      
      console.log('✓ Successfully logged in as:', testUser.email);
    });
  });
});