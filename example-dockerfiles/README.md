# Example Dockerfiles for Testing Import Functionality

This folder contains various example Dockerfiles you can use to test the "Import Dockerfile" feature.

## Available Examples:

### 1. **Dockerfile.python-simple**
- Base: Python 3.11 slim
- Has a CMD that runs a simple Python loop
- Tests: SSH running alongside a Python application

### 2. **Dockerfile.node-simple**
- Base: Node.js 18 slim
- Has a CMD that runs a simple Node.js script
- Tests: SSH running alongside a Node.js application

### 3. **Dockerfile.ubuntu-basic**
- Base: Ubuntu 22.04
- No CMD/ENTRYPOINT
- Tests: SSH as the main process on Ubuntu

### 4. **Dockerfile.alpine-basic**
- Base: Alpine Linux
- No CMD/ENTRYPOINT
- Tests: SSH as the main process on Alpine (different package manager)

### 5. **Dockerfile.nginx**
- Base: Nginx Alpine
- Has a CMD that runs Nginx
- Tests: SSH running alongside a web server

### 6. **Dockerfile.python-flask**
- Base: Python 3.11 slim
- Has a CMD that runs a Flask web app on port 5000
- Tests: SSH running alongside a Flask application

### 7. **Dockerfile.debian-basic**
- Base: Debian Bullseye
- No CMD/ENTRYPOINT
- Tests: SSH as the main process on Debian

## How to Test:

1. Navigate to the Container Manager page
2. Click "Import Dockerfile" button
3. Select any of these example Dockerfiles
4. Wait for the container to be created
5. Once created, you can:
   - SSH into the container using the displayed port
   - Username: `root`
   - Password: `password`
   - If the Dockerfile had an application (Flask, Node, etc.), it will still be running

## Expected Behavior:

- **Dockerfiles WITH CMD/ENTRYPOINT**: 
  - Original application continues to run
  - SSH server runs in the background
  - You can SSH in while the app is running

- **Dockerfiles WITHOUT CMD/ENTRYPOINT**: 
  - SSH server becomes the main process
  - Container stays running for SSH access

## Testing SSH Connection:

For Windows (cmd):
```
ssh -p <PORT_NUMBER> root@localhost
```

For PowerShell:
```
ssh -p <PORT_NUMBER> root@localhost
```

Default password: `password`
