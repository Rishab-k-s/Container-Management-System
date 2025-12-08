# E2E Test Suite Documentation

## Overview
This directory contains end-to-end tests for the Container Management System using Playwright.

## Test Files

### 01-authentication.spec.js
Tests for user authentication flow:
- Login page display
- User registration
- Login functionality
- Password validation

### 02-service-selection.spec.js
Tests for service selection page:
- Page layout and navigation
- Service card display
- Navigation to different services
- Logout functionality

### 03-container-management.spec.js
**NEW** - Comprehensive tests for container management:
- **Container Creation**: Tests for creating containers, displaying status, and managing multiple containers
- **SSH Connection**: Tests for connecting to containers via SSH and establishing terminal connections
- **Terminal Interaction**: Tests for typing commands, executing commands, and viewing output
- **Container Lifecycle**: Tests for starting, stopping, and removing containers
- **Window Controls**: Tests for terminal window controls (minimize, maximize, close)
- **Error Handling**: Tests for graceful error handling
- **UI Interaction**: Tests for tab switching and UI updates

## Running Tests

### Prerequisites
1. Ensure Docker is running
2. MongoDB should be running
3. Meteor application should be started (or set `reuseExistingServer: false` in playwright.config.js)

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
# Run only container management tests
npx playwright test tests/e2e/03-container-management.spec.js

# Run only authentication tests
npx playwright test tests/e2e/01-authentication.spec.js
```

### Run Tests in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run Tests in Debug Mode
```bash
npx playwright test --debug
```

### Run Specific Test by Name
```bash
npx playwright test -g "should create a new container"
npx playwright test -g "should execute commands in terminal"
```

### View Test Report
```bash
npx playwright show-report
```

## Test Categories

### Container Creation Tests
- `should display container manager page correctly` - Verifies UI elements
- `should create a new container successfully` - Tests container creation flow
- `should show container with running status` - Validates container status
- `should handle multiple container creation` - Tests creating multiple containers

### SSH Connection Tests
- `should open terminal modal when connecting` - Tests modal opening
- `should display terminal with xterm container` - Verifies terminal rendering
- `should establish SSH connection successfully` - Tests SSH connectivity
- `should show connection status while connecting` - Tests status messages

### Terminal Interaction Tests
- `should be able to type in terminal` - Tests keyboard input
- `should execute commands in terminal` - Tests command execution
- `should execute pwd command and show output` - Tests specific command
- `should execute ls command successfully` - Tests directory listing
- `should handle multiple commands in sequence` - Tests multiple commands

### Container Lifecycle Tests
- `should stop a running container` - Tests stopping containers
- `should start a stopped container` - Tests starting containers
- `should remove a container` - Tests container removal

### Window Controls Tests
- `should have window control buttons` - Verifies control buttons exist
- `should close terminal modal` - Tests closing terminal
- `should toggle maximize terminal window` - Tests maximize functionality
- `should toggle minimize terminal window` - Tests minimize functionality

## Test Timeouts

The tests include appropriate timeouts for operations:
- Container creation: 90 seconds (containers can take time to build)
- SSH connection: 15 seconds
- Terminal commands: 2-10 seconds
- UI interactions: 5 seconds

## Known Issues & Considerations

1. **Container Creation Time**: Creating containers can take 60-90 seconds. Tests account for this with appropriate timeouts.

2. **SSH Readiness**: After container creation, SSH service needs time to start. Tests include waiting periods for SSH to be ready.

3. **Terminal Input**: Terminal input uses `.xterm-helper-textarea` which is the actual input element for xterm.js.

4. **Cleanup**: Tests include `afterEach` cleanup to remove containers and prevent resource buildup.

5. **Dialog Handling**: Container removal requires accepting a confirmation dialog. Tests use `page.once('dialog', dialog => dialog.accept())`.

## Helper Functions

Located in `tests/helpers/test-utils.js`:

- `login(page, email, password)` - Login helper
- `registerUser(page, email, password, role)` - User registration
- `navigateToContainerManager(page)` - Navigate to container manager
- `createContainer(page)` - Create a container
- `connectToContainer(page, index)` - Connect to container terminal
- `sendTerminalCommand(page, command)` - Send command to terminal
- `cleanupContainers(page)` - Remove all test containers

## Troubleshooting

### Tests Timing Out
- Increase timeout in `playwright.config.js`
- Ensure Docker daemon is running
- Check system resources (Docker containers can be resource-intensive)

### SSH Connection Failures
- Containers may need more time for SSH to start
- Check Docker logs for the container
- Verify SSH is installed in the container image

### Terminal Not Responding
- Ensure xterm.js is properly loaded
- Check browser console for JavaScript errors
- Verify WebSocket connections are working

### Cleanup Issues
- Manually remove test containers: `docker ps -a | grep test`
- Clear Docker resources: `docker system prune`

## CI/CD Integration

To run tests in CI:
```yaml
- name: Run E2E Tests
  run: |
    npx playwright install --with-deps
    npx playwright test
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources (containers) after tests
3. **Timeouts**: Use appropriate timeouts for Docker operations
4. **Assertions**: Use descriptive assertions that clearly indicate what failed
5. **Parallelization**: Container tests run sequentially (`workers: 1`) to avoid resource conflicts

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use helper functions from test-utils.js
3. Add appropriate timeouts for Docker operations
4. Include cleanup in `afterEach` hooks
5. Document new test categories in this README
