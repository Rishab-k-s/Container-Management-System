# Container Management System

A full-stack web application for managing Docker containers with SSH access and terminal interaction, built with Meteor.js and React.

## 🚀 Features

- **User Authentication**: Secure login and registration with role-based access
- **Container Management**: Create, start, stop, and remove Docker containers
- **SSH Terminal**: Interactive SSH terminal access to containers
- **Real-time Updates**: Live container status and monitoring
- **VM Terminal**: Virtual machine terminal interface
- **Service Selection**: Easy navigation between container and VM services

## 🛠️ Tech Stack

- **Frontend**: React 19, CSS3
- **Backend**: Meteor.js, Node.js
- **Container**: Docker Engine API
- **Testing**: Playwright for E2E testing
- **Terminal**: xterm.js for terminal emulation

## 📋 Prerequisites

- Node.js (v14 or higher)
- Docker Desktop installed and running
- MongoDB (included with Meteor)
- Git

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rishab-k-s/Container-Management-System.git
   cd Container-Management-System
   ```

2. **Install Meteor** (if not already installed)
   ```bash
   # Windows (run in PowerShell as Administrator)
   choco install meteor
   
   # macOS/Linux
   curl https://install.meteor.com/ | sh
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

## 🚀 Running the Application

1. **Start the Meteor server**
   ```bash
   meteor npm start
   # or
   meteor
   ```

2. **Access the application**
   - Open your browser and navigate to: `http://localhost:3000`

## 🧪 Testing

The project includes comprehensive E2E tests using Playwright.

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suites
```bash
# Authentication tests
npm run test:e2e:auth

# Service selection tests
npm run test:e2e:services

# Container management tests
npm run test:e2e:containers
```

### Run Tests with UI
```bash
npm run test:e2e:headed
```

### View Test Report
```bash
npx playwright show-report
```

### Test Coverage
- ✅ **55 E2E tests** covering:
  - User authentication and registration
  - Login/logout functionality
  - Service selection navigation
  - Container creation and lifecycle
  - SSH terminal connections
  - Terminal window controls
  - Error handling and edge cases

## 📁 Project Structure

```
Container-Management-System/
├── client/                  # Client-side files
│   ├── main.html           # HTML template
│   ├── main.jsx            # React root component
│   └── main.css            # Global styles
├── imports/
│   ├── api/                # API methods and collections
│   │   └── links.js
│   └── ui/                 # React components
│       ├── App.jsx
│       ├── Login.jsx
│       ├── ProtectedRoute.jsx
│       ├── ServiceSelectionPage.jsx
│       ├── ActiveContainers.jsx
│       ├── ContainerTerminal.jsx
│       ├── TerminalComponent.jsx
│       ├── VMTerminal.jsx
│       └── CreateCustomContainerModal.jsx
├── server/                 # Server-side code
│   ├── main.js            # Server entry point
│   ├── Login.js           # Authentication logic
│   ├── DockerMethods.js   # Docker API methods
│   └── ConnectionSocketHandler.js
├── tests/
│   ├── e2e/               # End-to-end tests
│   │   ├── 01-authentication.spec.js
│   │   ├── 02-service-selection.spec.js
│   │   └── 03-container-management.spec.js
│   └── helpers/
│       └── test-utils.js
├── example-dockerfiles/    # Sample Dockerfiles
└── playwright.config.js    # Playwright configuration
```

## 🐳 Docker Integration

The application uses Docker Engine API to manage containers. Ensure Docker Desktop is running before starting the application.

### Supported Operations
- Create SSH-enabled Debian containers
- Import custom Dockerfiles
- Start/stop containers
- Remove containers
- Real-time container status monitoring

## 🔒 Authentication

- User registration with email and password
- Secure password hashing
- Role-based access (user/admin)
- Protected routes with automatic redirect
- Session management

## 🖥️ Terminal Features

- Interactive SSH terminal using xterm.js
- Command execution in containers
- Copy/paste support
- Window controls (minimize, maximize, close)
- Real-time command output
- Connection status indicators

## 📝 Available NPM Scripts

```json
{
  "start": "meteor run",
  "test:e2e": "playwright test",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:auth": "playwright test tests/e2e/01-authentication.spec.js",
  "test:e2e:services": "playwright test tests/e2e/02-service-selection.spec.js",
  "test:e2e:containers": "playwright test tests/e2e/03-container-management.spec.js"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- Container creation may take up to 90 seconds
- SSH connection requires containers to be fully initialized
- Tests should be run with Docker Desktop running

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **Rishab K S** - [GitHub](https://github.com/Rishab-k-s)

## 🙏 Acknowledgments

- Meteor.js for the full-stack framework
- Docker for container management
- xterm.js for terminal emulation
- Playwright for testing infrastructure