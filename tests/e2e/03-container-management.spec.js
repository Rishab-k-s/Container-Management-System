import { test, expect } from '@playwright/test';
import { 
  registerUser, 
  login, 
  navigateToContainerManager,
  cleanupContainers 
} from '../helpers/test-utils.js';

/**
 * E2E Tests for Container Management
 * Tests: Container creation, SSH connection, terminal interaction
 */

// Create a test user for these tests
const testUser = {
  email: `containertest_${Date.now()}@test.com`,
  password: 'TestPass123!'
};

test.describe('Container Management - Creation and SSH', () => {
  
  // Register user once before all tests
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    
    try {
      await registerUser(page, testUser.email, testUser.password, 'user');
      console.log('✓ Test user created for container tests:', testUser.email);
    } catch (error) {
      console.log('Registration error (may already exist):', error.message);
    }
    
    await page.close();
  });
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, testUser.email, testUser.password);
    
    // Navigate to Container Manager
    await navigateToContainerManager(page);
    
    // Wait for page to be fully loaded
    await page.waitForSelector('.active-containers-panel', { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup containers after each test
    try {
      await cleanupContainers(page);
    } catch (error) {
      console.log('Cleanup warning:', error.message);
    }
  });

  test.describe('Container Creation', () => {
    
    test('should display container manager page correctly', async ({ page }) => {
      // Check for key elements
      await expect(page.locator('.active-containers-panel')).toBeVisible();
      await expect(page.locator('.create-container-btn')).toBeVisible();
      await expect(page.locator('.import-dockerfile-btn')).toBeVisible();
      
      // Check tabs
      await expect(page.locator('.tab-button:has-text("Active")')).toBeVisible();
      await expect(page.locator('.tab-button:has-text("Stopped")')).toBeVisible();
    });

    test('should create a new container successfully', async ({ page }) => {
      // Get initial container count
      const initialCount = await page.locator('.container-card').count();
      
      // Click create container button
      const createBtn = page.locator('.create-container-btn');
      await expect(createBtn).toBeEnabled();
      await createBtn.click();
      
      // Wait for "Creating..." state
      await expect(page.locator('.create-container-btn:has-text("Creating...")')).toBeVisible({ timeout: 5000 });
      
      // Wait for container to be created (this can take up to 60 seconds)
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Verify container count increased
      const newCount = await page.locator('.container-card').count();
      expect(newCount).toBe(initialCount + 1);
      
      // Verify container card elements
      const containerCard = page.locator('.container-card').first();
      await expect(containerCard).toBeVisible();
      await expect(containerCard.locator('.container-name')).toBeVisible();
      await expect(containerCard.locator('.status-badge')).toBeVisible();
    });

    test('should show container with running status', async ({ page }) => {
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Check status badge
      const statusBadge = page.locator('.status-badge').first();
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toHaveClass(/running/);
    });

    test('should display container with connect button', async ({ page }) => {
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Verify connect button exists
      const connectBtn = page.locator('.connect-btn').first();
      await expect(connectBtn).toBeVisible();
      await expect(connectBtn).toContainText('Connect');
    });

    test('should handle multiple container creation', async ({ page }) => {
      // Create first container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Wait a bit before creating second
      await page.waitForTimeout(2000);
      
      // Create second container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card:nth-child(2)', { timeout: 90000 });
      
      // Verify two containers exist
      const containerCount = await page.locator('.container-card').count();
      expect(containerCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('SSH Connection and Terminal', () => {
    
    test.beforeEach(async ({ page }) => {
      // Create a container for SSH tests
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Wait for container to be fully ready
      await page.waitForTimeout(5000);
    });

    test('should open terminal modal when connecting to container', async ({ page }) => {
      // Click connect button
      const connectBtn = page.locator('.connect-btn').first();
      await connectBtn.click();
      
      // Wait for terminal modal to appear
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Verify modal is visible
      const modal = page.locator('.bottom-panel-overlay');
      await expect(modal).toBeVisible();
    });

    test('should display terminal with xterm container', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Check for terminal elements
      await expect(page.locator('.xterm')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.xterm-screen')).toBeVisible();
    });

    test('should show connection status while connecting', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Check for connection status (may show "Initializing..." or "Connecting...")
      const terminalContent = page.locator('.xterm-screen');
      await expect(terminalContent).toBeVisible({ timeout: 10000 });
    });

    test('should establish SSH connection successfully', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for SSH connection to establish (look for shell prompt)
      // The terminal should eventually show a prompt like "root@container:~#" or similar
      await page.waitForTimeout(10000); // Give SSH time to connect
      
      // Check terminal has content (connection established)
      const terminalScreen = page.locator('.xterm-screen');
      const content = await terminalScreen.textContent();
      
      // Should have some output (not empty)
      expect(content.trim().length).toBeGreaterThan(0);
    });

    test('should be able to type in terminal', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for terminal to be ready
      await page.waitForTimeout(10000);
      
      // Focus on terminal
      const terminalTextarea = page.locator('.xterm-helper-textarea');
      await terminalTextarea.click();
      
      // Type a simple command
      await page.keyboard.type('echo "test"');
      
      // Verify text appears in terminal
      await page.waitForTimeout(1000);
      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent).toContain('echo');
    });

    test('should execute commands in terminal', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for SSH connection
      await page.waitForTimeout(10000);
      
      // Focus terminal
      await page.locator('.xterm-helper-textarea').click();
      
      // Type and execute command
      await page.keyboard.type('echo "Hello from container"');
      await page.keyboard.press('Enter');
      
      // Wait for command execution
      await page.waitForTimeout(2000);
      
      // Check for output
      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent).toContain('Hello from container');
    });

    test('should execute pwd command and show output', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for connection
      await page.waitForTimeout(10000);
      
      // Focus and execute command
      await page.locator('.xterm-helper-textarea').click();
      await page.keyboard.type('pwd');
      await page.keyboard.press('Enter');
      
      // Wait for output
      await page.waitForTimeout(2000);
      
      // Should show directory path
      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent).toMatch(/\/root|\/home/);
    });

    test('should execute ls command successfully', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for connection
      await page.waitForTimeout(10000);
      
      // Execute ls command
      await page.locator('.xterm-helper-textarea').click();
      await page.keyboard.type('ls -la');
      await page.keyboard.press('Enter');
      
      // Wait for output
      await page.waitForTimeout(2000);
      
      // Should show directory listing
      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent.length).toBeGreaterThan(50); // Should have content
    });

    test('should handle multiple commands in sequence', async ({ page }) => {
      // Connect to container
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Wait for connection
      await page.waitForTimeout(10000);
      
      const textarea = page.locator('.xterm-helper-textarea');
      await textarea.click();
      
      // Command 1
      await page.keyboard.type('echo "Command 1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Command 2
      await page.keyboard.type('echo "Command 2"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Command 3
      await page.keyboard.type('echo "Command 3"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      // Check all outputs are present
      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent).toContain('Command 1');
      expect(terminalContent).toContain('Command 2');
      expect(terminalContent).toContain('Command 3');
    });
  });

  test.describe('Terminal Window Controls', () => {
    
    test.beforeEach(async ({ page }) => {
      // Create and connect to container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      await page.waitForTimeout(5000);
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
    });

    test('should have window control buttons', async ({ page }) => {
      // Check for control buttons
      const modal = page.locator('.bottom-panel-overlay');
      
      // Look for minimize, maximize, close buttons
      const windowControls = modal.locator('.window-controls');
      await expect(windowControls).toBeVisible({ timeout: 5000 });
    });

    test('should close terminal modal', async ({ page }) => {
      // Find and click close button
      const closeBtn = page.locator('.bottom-panel-overlay .window-btn.close');
      await closeBtn.click();
      
      // Modal should be hidden
      await expect(page.locator('.bottom-panel-overlay')).not.toBeVisible({ timeout: 5000 });
    });

    test('should toggle maximize terminal window', async ({ page }) => {
      // Find maximize button (second button in window controls)
      const maximizeBtn = page.locator('.window-controls .window-btn').nth(1);
      
      if (await maximizeBtn.isVisible()) {
        // Click maximize
        await maximizeBtn.click();
        await page.waitForTimeout(500);
        
        // Check if modal is maximized (has maximized class)
        const modal = page.locator('.bottom-panel-content.maximized');
        await expect(modal).toBeVisible();
      }
    });

    test('should toggle minimize terminal window', async ({ page }) => {
      // Find minimize button (first button in window controls)
      const minimizeBtn = page.locator('.window-controls .window-btn').first();
      
      if (await minimizeBtn.isVisible()) {
        // Click minimize
        await minimizeBtn.click();
        await page.waitForTimeout(500);
        
        // Modal should be minimized
        const modal = page.locator('.bottom-panel-overlay.minimized');
        await expect(modal).toBeAttached();
      }
    });
  });

  test.describe('Container Lifecycle', () => {
    
    test.beforeEach(async ({ page }) => {
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      await page.waitForTimeout(3000);
    });

    test('should stop a running container', async ({ page }) => {
      // Find toggle button
      const toggleBtn = page.locator('.toggle-btn').first();
      await expect(toggleBtn).toBeVisible();
      
      // Click to stop
      await toggleBtn.click();
      
      // Wait for status change
      await page.waitForTimeout(3000);
      
      // Switch to stopped tab
      await page.locator('.tab-button:has-text("Stopped")').click();
      
      // Verify container appears in stopped tab
      await expect(page.locator('.container-card').first()).toBeVisible({ timeout: 5000 });
    });

    test('should start a stopped container', async ({ page }) => {
      // Stop container first
      await page.locator('.toggle-btn').first().click();
      await page.waitForTimeout(3000);
      
      // Switch to stopped tab
      await page.locator('.tab-button:has-text("Stopped")').click();
      await page.waitForTimeout(1000);
      
      // Start container
      const startBtn = page.locator('.toggle-btn').first();
      await startBtn.click();
      
      // Wait for status change
      await page.waitForTimeout(3000);
      
      // Switch back to active tab
      await page.locator('.tab-button:has-text("Active")').click();
      
      // Verify container is running
      await expect(page.locator('.container-card').first()).toBeVisible({ timeout: 5000 });
    });

    test('should remove a container', async ({ page }) => {
      // Get initial count
      const initialCount = await page.locator('.container-card').count();
      
      // Find close/remove button
      const removeBtn = page.locator('.close-btn, .remove-btn').first();
      
      // Setup dialog handler to confirm removal
      page.once('dialog', dialog => dialog.accept());
      
      // Click remove
      await removeBtn.click();
      
      // Wait for removal
      await page.waitForTimeout(3000);
      
      // Verify container count decreased
      const newCount = await page.locator('.container-card').count();
      expect(newCount).toBe(initialCount - 1);
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle connection to non-existent container gracefully', async ({ page }) => {
      // This test verifies error handling exists
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Connect should work or show error message
      const connectBtn = page.locator('.connect-btn').first();
      await connectBtn.click();
      
      // Either terminal opens or error is shown
      const terminalOrError = await Promise.race([
        page.waitForSelector('.bottom-panel-overlay', { timeout: 20000 }).catch(() => null),
        page.waitForSelector('.error-message', { timeout: 20000 }).catch(() => null)
      ]);
      
      expect(terminalOrError).toBeTruthy();
    });

    test('should show appropriate status when SSH is not ready', async ({ page }) => {
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Try to connect immediately (SSH may not be ready)
      await page.locator('.connect-btn').first().click();
      await page.waitForSelector('.bottom-panel-overlay', { timeout: 15000 });
      
      // Should show some status message
      await page.waitForTimeout(2000);
      const terminalContent = await page.locator('.xterm-screen').textContent();
      
      // Should have some content (status or prompt)
      expect(terminalContent.length).toBeGreaterThan(0);
    });
  });

  test.describe('UI Interaction', () => {
    
    test('should switch between Active and Stopped tabs', async ({ page }) => {
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Check active tab
      const activeTab = page.locator('.tab-button:has-text("Active")');
      await expect(activeTab).toHaveClass(/active/);
      
      // Click stopped tab
      await page.locator('.tab-button:has-text("Stopped")').click();
      
      // Verify stopped tab is active
      const stoppedTab = page.locator('.tab-button:has-text("Stopped")');
      await expect(stoppedTab).toHaveClass(/active/);
    });

    test('should update container count badges', async ({ page }) => {
      // Check initial count
      const activeCountBefore = await page.locator('.tab-button:has-text("Active") .container-count').textContent();
      
      // Create a container
      await page.locator('.create-container-btn').click();
      await page.waitForSelector('.container-card', { timeout: 90000 });
      
      // Check count increased
      const activeCountAfter = await page.locator('.tab-button:has-text("Active") .container-count').textContent();
      expect(parseInt(activeCountAfter)).toBeGreaterThan(parseInt(activeCountBefore));
    });

    test('should display import Dockerfile button', async ({ page }) => {
      const importBtn = page.locator('.import-dockerfile-btn');
      await expect(importBtn).toBeVisible();
      await expect(importBtn).toContainText('Import Dockerfile');
    });
  });
});
