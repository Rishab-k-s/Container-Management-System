import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Service Selection Page
 */

// Create a test user for these tests
const testUser = {
  email: `servicetest_${Date.now()}@test.com`,
  password: 'TestPass123!'
};

test.describe('Service Selection Page', () => {
  
  // Register user once before all tests
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    
    // Register user
    await page.goto('/');
    await page.click('button:has-text("Sign Up")');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[id="password"]', testUser.password);
    await page.fill('input[id="confirmPassword"]', testUser.password);
    await page.selectOption('select[id="role"]', 'user');
    await page.click('button[type="submit"]');
    
    // Wait for success
    await page.waitForSelector('text=Account created successfully', { timeout: 5000 });
    
    await page.close();
    console.log('✓ Test user created for service tests:', testUser.email);
  });
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    
    // Should be on services page
    await page.waitForURL('**/services', { timeout: 10000 });
  });

  test.describe('Page Layout', () => {
    test('should display service selection page correctly', async ({ page }) => {
      // Check header
      await expect(page.locator('h1.main-title')).toContainText('Choose a Service');
      await expect(page.locator('.subtitle')).toContainText('Select the service you want to use');
      
      // Check both service cards are visible
      await expect(page.locator('.vm-card')).toBeVisible();
      await expect(page.locator('.container-card')).toBeVisible();
    });

    test('should display VM service card with correct info', async ({ page }) => {
      const vmCard = page.locator('.vm-card');
      
      await expect(vmCard).toBeVisible();
      await expect(vmCard.locator('.service-title')).toContainText('Virtual Machine');
      await expect(vmCard.locator('.service-description')).toContainText('Access Linux containers via SSH');
      
      // Check icon is present
      await expect(vmCard.locator('.service-icon svg')).toBeVisible();
    });

    test('should display Container Manager card with correct info', async ({ page }) => {
      const containerCard = page.locator('.container-card');
      
      await expect(containerCard).toBeVisible();
      await expect(containerCard.locator('.service-title')).toContainText('Container Manager');
      await expect(containerCard.locator('.service-description')).toContainText('Manage databases and queries');
      
      // Check icon is present
      await expect(containerCard.locator('.service-icon svg')).toBeVisible();
    });

    test('should have arrow icons on service cards', async ({ page }) => {
      const vmArrow = page.locator('.vm-card .service-arrow svg');
      const containerArrow = page.locator('.container-card .service-arrow svg');
      
      await expect(vmArrow).toBeVisible();
      await expect(containerArrow).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to VM Terminal when clicking VM card', async ({ page }) => {
      await page.click('.vm-card');
      
      // Should redirect to VM terminal
      await page.waitForURL('**/vmterminal', { timeout: 5000 });
      
      // Check VM terminal page loaded
      await expect(page.locator('.vm-terminal-container')).toBeVisible();
    });

    test('should navigate to Container Manager when clicking container card', async ({ page }) => {
      await page.click('.container-card');
      
      // Should redirect to terminal/container manager
      await page.waitForURL('**/terminal', { timeout: 5000 });
      
      // Check container manager page loaded
      await expect(page.locator('.active-containers-panel')).toBeVisible();
    });

    test('should navigate back to services from VM Terminal', async ({ page }) => {
      // Go to VM Terminal
      await page.click('.vm-card');
      await page.waitForURL('**/vmterminal', { timeout: 5000 });
      
      // Click back button
      await page.click('.back-to-services-btn');
      
      // Should be back on services page
      await page.waitForURL('**/services', { timeout: 5000 });
      await expect(page.locator('h1.main-title')).toContainText('Choose a Service');
    });

    test('should navigate back to services from Container Manager', async ({ page }) => {
      // Go to Container Manager
      await page.click('.container-card');
      await page.waitForURL('**/terminal', { timeout: 5000 });
      
      // Click back button
      await page.click('.back-to-services-btn');
      
      // Should be back on services page
      await page.waitForURL('**/services', { timeout: 5000 });
      await expect(page.locator('h1.main-title')).toContainText('Choose a Service');
    });
  });

  test.describe('UI Interactions', () => {
    test('should show hover effects on service cards', async ({ page }) => {
      const vmCard = page.locator('.vm-card');
      
      // Hover over card
      await vmCard.hover();
      
      // Visual check - take screenshot
      await page.screenshot({ 
        path: 'test-results/screenshots/service-card-hover.png' 
      });
    });

    test('should be clickable - VM card', async ({ page }) => {
      const vmCard = page.locator('.vm-card');
      
      // Click on the card
      await vmCard.click();
      await page.waitForURL('**/vmterminal', { timeout: 5000 });
      
      // Verify navigation
      await expect(page.locator('.vm-terminal-container')).toBeVisible();
    });

    test('should be clickable - Container card', async ({ page }) => {
      const containerCard = page.locator('.container-card');
      
      // Click on container card
      await containerCard.click();
      await page.waitForURL('**/terminal', { timeout: 5000 });
      
      // Verify navigation
      await expect(page.locator('.active-containers-panel')).toBeVisible();
    });

    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check elements are still visible
      await expect(page.locator('.vm-card')).toBeVisible();
      await expect(page.locator('.container-card')).toBeVisible();
      
      // Cards should still be clickable on mobile
      await page.click('.vm-card');
      await page.waitForURL('**/vmterminal', { timeout: 5000 });
      
      // Take mobile screenshot
      await page.screenshot({ 
        path: 'test-results/screenshots/services-mobile-navigation.png',
        fullPage: true 
      });
    });
  });

  test.describe('Visual Tests', () => {
    test('should capture service selection page', async ({ page }) => {
      // Take full page screenshot
      await page.screenshot({ 
        path: 'test-results/screenshots/service-selection-full.png',
        fullPage: true 
      });
    });
  });

  test.describe('Basic Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for exactly one h1
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('Choose a Service');
      
      // Check for h3 headings in cards
      const h3 = page.locator('h3');
      await expect(h3).toHaveCount(2); // VM and Container titles
    });

    test('should have visible and clickable service cards', async ({ page }) => {
      // Both cards should be visible and clickable
      const vmCard = page.locator('.vm-card');
      const containerCard = page.locator('.container-card');
      
      await expect(vmCard).toBeVisible();
      await expect(containerCard).toBeVisible();
      
      // Verify they respond to clicks
      await vmCard.click();
      await page.waitForURL('**/vmterminal', { timeout: 5000 });
    });
  });
});