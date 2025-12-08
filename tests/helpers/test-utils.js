import { expect } from '@playwright/test';

/**
 * Test utilities for Container Management System E2E tests
 */

// Test user credentials
export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin'
  },
  user: {
    email: 'user@test.com',
    password: 'password123',
    role: 'user'
  }
};

/**
 * Login helper function
 */
export async function login(page, email, password) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]');
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to services page
  await page.waitForURL('**/services', { timeout: 10000 });
}

/**
 * Register a new user
 */
export async function registerUser(page, email, password, role = 'user') {
  await page.goto('/');
  
  // Click on Sign Up button
  const signUpBtn = page.locator('button:has-text("Sign Up")');
  await signUpBtn.click();
  
  // Fill registration form
  await page.fill('input[type="email"]', email);
  await page.fill('input[id="password"]', password);
  await page.fill('input[id="confirmPassword"]', password);
  await page.selectOption('select[id="role"]', role);
  
  // Submit registration
  await page.click('button[type="submit"]:has-text("Create Account")');
  
  // Wait for success message
  await page.waitForSelector('text=Account created successfully', { timeout: 5000 });
}

/**
 * Logout helper
 */
export async function logout(page) {
  // Add logout functionality if implemented
  await page.evaluate(() => {
    Meteor.logout();
  });
  await page.waitForURL('**/');
}

/**
 * Navigate to container manager
 */
export async function navigateToContainerManager(page) {
  await page.click('.container-card:has-text("Container Manager")');
  await page.waitForURL('**/terminal');
  await page.waitForSelector('.active-containers-panel');
}

/**
 * Navigate to VM terminal
 */
export async function navigateToVMTerminal(page) {
  await page.click('.vm-card:has-text("Virtual Machine")');
  await page.waitForURL('**/vmterminal');
  await page.waitForSelector('.vm-terminal-container');
}

/**
 * Create a container
 */
export async function createContainer(page) {
  const createBtn = page.locator('button:has-text("Create Container")');
  await createBtn.click();
  
  // Wait for container to be created (may take a while)
  await page.waitForSelector('.container-card', { timeout: 60000 });
}

/**
 * Wait for container to be running
 */
export async function waitForContainerRunning(page, containerName) {
  await page.waitForSelector(
    `.container-card:has-text("${containerName}") .status-badge.running`,
    { timeout: 30000 }
  );
}

/**
 * Connect to a container
 */
export async function connectToContainer(page, containerIndex = 0) {
  const connectBtn = page.locator('.connect-btn').nth(containerIndex);
  await connectBtn.click();
  
  // Wait for terminal modal to appear
  await page.waitForSelector('.terminal-modal', { timeout: 10000 });
}

/**
 * Stop a container
 */
export async function stopContainer(page, containerIndex = 0) {
  const stopBtn = page.locator('.toggle-btn.running').nth(containerIndex);
  await stopBtn.click();
  
  // Wait for status to change
  await page.waitForSelector('.status-badge.stopped', { timeout: 10000 });
}

/**
 * Start a container
 */
export async function startContainer(page, containerIndex = 0) {
  const startBtn = page.locator('.toggle-btn.stopped').nth(containerIndex);
  await startBtn.click();
  
  // Wait for status to change
  await page.waitForSelector('.status-badge.running', { timeout: 10000 });
}

/**
 * Remove a container
 */
export async function removeContainer(page, containerIndex = 0) {
  const removeBtn = page.locator('.close-btn').nth(containerIndex);
  
  // Setup dialog handler
  page.once('dialog', dialog => dialog.accept());
  
  await removeBtn.click();
  
  // Wait for container to be removed
  await page.waitForTimeout(2000);
}

/**
 * Send command to terminal
 */
export async function sendTerminalCommand(page, command) {
  const terminal = page.locator('.xterm-helper-textarea');
  await terminal.fill(command);
  await terminal.press('Enter');
  await page.waitForTimeout(1000); // Wait for command execution
}

/**
 * Check terminal output contains text
 */
export async function checkTerminalOutput(page, expectedText) {
  const terminalContent = page.locator('.xterm-screen');
  await expect(terminalContent).toContainText(expectedText, { timeout: 10000 });
}

/**
 * Take screenshot with name
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({ 
    path: `test-results/screenshots/${name}.png`,
    fullPage: true 
  });
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(page) {
  await page.waitForSelector('.spinner', { state: 'hidden', timeout: 30000 });
}

/**
 * Check if element is visible
 */
export async function isVisible(page, selector) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container count
 */
export async function getContainerCount(page, tab = 'active') {
  const countBadge = page.locator(`.tab-button.${tab === 'active' ? 'active' : ''} .container-count`);
  const text = await countBadge.textContent();
  return parseInt(text || '0');
}

/**
 * Clean up all test containers
 */
export async function cleanupContainers(page) {
  // Navigate to container manager if not already there
  try {
    await page.goto('/terminal', { waitUntil: 'networkidle' });
  } catch {
    return;
  }
  
  // Remove all containers
  const closeBtns = page.locator('.close-btn');
  const count = await closeBtns.count();
  
  for (let i = 0; i < count; i++) {
    page.once('dialog', dialog => dialog.accept());
    await closeBtns.first().click();
    await page.waitForTimeout(1000);
  }
}