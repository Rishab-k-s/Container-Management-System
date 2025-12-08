import { Meteor } from 'meteor/meteor';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const docker = new Docker();

// Get the project root directory - navigate up from .meteor/local/build/programs/server
const projectRoot = path.resolve(process.cwd(), '../../../../..');

// Store for tracking created containers
const containerStore = new Map();

// Cache for image existence check
let imageExists = null;
let lastImageCheck = 0;
const IMAGE_CHECK_CACHE_MS = 60000; // Cache for 1 minute

Meteor.methods({
  /**
   * Create a new Docker container from the Debian SSH image (OPTIMIZED)
   * @param {string} dockerfilePath - Optional path to Dockerfile directory
   */
  async 'docker.createContainer'(dockerfilePath) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log('Creating new Docker container...');

      // Generate a unique container name with random suffix
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const containerName = `debian-ssh-${timestamp}-${randomSuffix}`;
      
      // Find an available port (optimized - cached check)
      const sshPort = await findAvailablePortFast(2222);
      console.log(`Allocated SSH port: ${sshPort}`);
      
      // OPTIMIZATION: Check image existence with caching
      const now = Date.now();
      if (imageExists === null || (now - lastImageCheck) > IMAGE_CHECK_CACHE_MS) {
        console.log('Checking for Docker image...');
        try {
          const image = docker.getImage('debian-ssh-server');
          await image.inspect();
          imageExists = true;
          lastImageCheck = now;
        } catch (error) {
          imageExists = false;
        }
      }

      if (!imageExists) {
        console.log('Image not found, building...');
        const buildPath = dockerfilePath || process.env.DOCKERFILE_PATH || projectRoot;
        const buildCommand = `docker build -t debian-ssh-server "${buildPath}"`;
        console.log(`Building with command: ${buildCommand}`);
        console.log(`Build path: ${buildPath}`);
        
        await execAsync(buildCommand);
        imageExists = true;
        console.log('✓ Image built successfully');
      } else {
        console.log('✓ Using cached image');
      }

      // Create container using Dockerode
      console.log('Creating container configuration...');
      const container = await docker.createContainer({
        Image: 'debian-ssh-server',
        name: containerName,
        ExposedPorts: {
          '22/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '22/tcp': [{ HostPort: String(sshPort) }]
          }
          // Removed restrictive capabilities (CapDrop/CapAdd) to fix "linux_audit_write_entry failed"
          // and ensure standard tools work correctly inside the container.
        }
        // Removed Healthcheck to avoid potential issues with PID file in non-daemon mode
      });

      console.log('Starting container...');
      await container.start();
      const containerId = container.id;
      const trimmedId = containerId.substring(0, 12);

      console.log(`Container created: ${trimmedId}`);

      // OPTIMIZATION: Faster SSH readiness check
      let sshReady = false;
      const maxAttempts = 20; // 10 seconds max
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          // Use dockerode exec with Tty: true to avoid multiplexing headers
          const exec = await container.exec({
            Cmd: ['bash', '-c', 'ss -tlnH | grep :22'],
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
          });
          
          const stream = await exec.start();
          let output = '';
          
          await new Promise((resolve, reject) => {
            stream.on('data', (chunk) => output += chunk.toString());
            stream.on('end', resolve);
            stream.on('error', reject);
          });

          // Debug output
          // console.log(`SSH Check Output (${i}): ${output.trim()}`);

          // Also check inspect to see if it's running
          const info = await container.inspect();
          if (!info.State.Running) {
             throw new Error('Container is not running');
          }

          if (output.includes('22') || output.includes('LISTEN')) {
            sshReady = true;
            console.log(`✓ SSH ready after ${(i + 1) * 0.5} seconds`);
            break;
          }
        } catch (checkError) {
          if (i % 5 === 0) {
            console.log(`Waiting for SSH... (attempt ${i + 1}/${maxAttempts})`);
          }
        }
      }

      if (!sshReady) {
        console.warn('⚠ SSH may still be starting (returning early)');
      }

      // Store container info
      containerStore.set(trimmedId, {
        id: trimmedId,
        name: containerName,
        sshPort: sshPort,
        created: Math.floor(Date.now() / 1000),
        image: 'debian-ssh-server',
        userId: this.userId,
        sshReady: sshReady
      });

      console.log(`✓ Container created: ${containerName} on port ${sshPort}`);

      return {
        success: true,
        containerId: trimmedId,
        containerName: containerName,
        sshPort: sshPort,
        sshReady: sshReady
      };

    } catch (error) {
      console.error('Error creating container:', error);
      throw new Meteor.Error('container-creation-failed', error.message);
    }
  },

  /**
   * Check if SSH is ready in a container (for frontend to poll)
   */
  async 'docker.checkSSHReady'(containerId) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: ['bash', '-c', 'ss -tlnH | grep :22'],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true
      });
      
      const stream = await exec.start();
      let output = '';
      
      await new Promise((resolve) => {
        stream.on('data', (chunk) => output += chunk.toString());
        stream.on('end', resolve);
      });

      return { ready: output.includes('22') || output.includes('LISTEN') };
    } catch (error) {
      return { ready: false, error: error.message };
    }
  },

  /**
   * List all containers (running and stopped) - OPTIMIZED
   */
  async 'docker.listContainers'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const containers = await docker.listContainers({ all: true });
      
      return containers.map(info => {
        const id = info.Id.substring(0, 12);
        const name = info.Names[0].replace(/^\//, ''); // Remove leading slash
        
        // Find SSH port
        let sshPort = null;
        if (info.Ports) {
          const portMap = info.Ports.find(p => p.PrivatePort === 22);
          if (portMap && portMap.PublicPort) {
            sshPort = portMap.PublicPort;
          }
        }

        // Fallback to stored info if port not in listing (e.g. stopped)
        const storedInfo = containerStore.get(id);
        if (!sshPort && storedInfo) {
          sshPort = storedInfo.sshPort;
        }

        // Auto-populate store
        if (!storedInfo && sshPort) {
          containerStore.set(id, {
            id: id,
            name: name,
            sshPort: sshPort,
            created: info.Created,
            image: info.Image,
            userId: this.userId
          });
        }

        return {
          id: id,
          name: name,
          image: info.Image,
          sshPort: sshPort,
          created: info.Created,
          status: info.State // 'running', 'exited', etc.
        };
      });

    } catch (error) {
      console.error('Error listing containers:', error);
      throw new Meteor.Error('list-containers-failed', error.message);
    }
  },

  /**
   * Stop a running container
   */
  async 'docker.stopContainer'(containerId) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log(`Stopping container: ${containerId}`);
      const container = docker.getContainer(containerId);
      await container.stop();
      console.log(`Container stopped: ${containerId}`);
      return { success: true };
    } catch (error) {
      console.error('Error stopping container:', error);
      throw new Meteor.Error('stop-container-failed', error.message);
    }
  },

  /**
   * Start a stopped container
   */
  async 'docker.startContainer'(containerId) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log(`Starting container: ${containerId}`);
      const container = docker.getContainer(containerId);
      await container.start();
      console.log(`Container started: ${containerId}`);
      
      // Brief wait for SSH
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      console.error('Error starting container:', error);
      throw new Meteor.Error('start-container-failed', error.message);
    }
  },

  /**
   * Remove a container permanently
   */
  async 'docker.removeContainer'(containerId) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log(`Removing container: ${containerId}`);
      const container = docker.getContainer(containerId);
      
      try {
        await container.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      
      await container.remove();
      containerStore.delete(containerId.substring(0, 12));
      
      console.log(`Container removed: ${containerId}`);
      return { success: true };
    } catch (error) {
      console.error('Error removing container:', error);
      throw new Meteor.Error('remove-container-failed', error.message);
    }
  },

  /**
   * Get container logs
   */
  async 'docker.getContainerLogs'(containerId, lines = 100) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: lines
      });
      return logs.toString('utf8'); // logs returns a buffer or stream depending on options, but with simple options it might return buffer
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw new Meteor.Error('get-logs-failed', error.message);
    }
  },

  /**
   * Create container from uploaded Dockerfile content
   * @param {string} dockerfileContent - The content of the Dockerfile
   * @param {string} baseImageName - Optional custom name for the built image
   */
  async 'docker.createContainerFromDockerfile'(dockerfileContent, baseImageName) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log('Creating container from uploaded Dockerfile...');
      
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Generate unique names
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const imageName = baseImageName || `imported-image-${timestamp}-${randomSuffix}`;
      const containerName = `container-${timestamp}-${randomSuffix}`;
      
      // Create temporary directory for build context
      const tempDir = path.join(os.tmpdir(), `docker-build-${timestamp}-${randomSuffix}`);
      fs.mkdirSync(tempDir, { recursive: true });
      
      console.log(`Temporary build directory: ${tempDir}`);
      
      try {
        // Analyze Dockerfile to determine if SSH setup is needed
        const needsSSH = !dockerfileContent.toLowerCase().includes('openssh-server');
        
        // Enhance Dockerfile with SSH if needed
        let enhancedDockerfile = dockerfileContent;
        
        if (needsSSH) {
          console.log('Adding SSH configuration to Dockerfile...');
          
          // Detect base image type (Debian/Ubuntu vs Alpine vs CentOS/RHEL vs others)
          const baseImageMatch = dockerfileContent.match(/^FROM\s+([^\s]+)/im);
          const baseImage = baseImageMatch ? baseImageMatch[1].toLowerCase() : '';
          
          let sshSetupCommands = '';
          let sshStartCommand = '';
          
          if (baseImage.includes('alpine')) {
            // Alpine-based setup
            sshSetupCommands = `
# SSH Setup for Alpine
RUN apk add --no-cache openssh-server openssh bash shadow && \\
    ssh-keygen -A && \\
    echo "root:password" | chpasswd && \\
    passwd -u root && \\
    mkdir -p /run/sshd && \\
    echo 'Port 22' > /etc/ssh/sshd_config && \\
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \\
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'PermitEmptyPasswords no' >> /etc/ssh/sshd_config && \\
    echo 'ChallengeResponseAuthentication no' >> /etc/ssh/sshd_config && \\
    echo 'UsePAM no' >> /etc/ssh/sshd_config && \\
    echo 'PrintMotd no' >> /etc/ssh/sshd_config && \\
    echo 'Subsystem sftp /usr/lib/ssh/sftp-server' >> /etc/ssh/sshd_config

EXPOSE 22`;
            sshStartCommand = '/usr/sbin/sshd -D -e';
          } else if (baseImage.includes('centos') || baseImage.includes('rhel') || baseImage.includes('fedora')) {
            // CentOS/RHEL/Fedora-based setup
            sshSetupCommands = `
# SSH Setup for CentOS/RHEL/Fedora
RUN yum update -y && \\
    yum install -y openssh-server sudo iproute net-tools passwd shadow-utils && \\
    ssh-keygen -A && \\
    echo "root:password" | chpasswd && \\
    passwd -u root && \\
    mkdir -p /var/run/sshd && \\
    echo 'Port 22' > /etc/ssh/sshd_config && \\
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \\
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'ChallengeResponseAuthentication no' >> /etc/ssh/sshd_config && \\
    echo 'UsePAM no' >> /etc/ssh/sshd_config && \\
    echo 'PrintMotd no' >> /etc/ssh/sshd_config && \\
    echo 'Subsystem sftp /usr/libexec/openssh/sftp-server' >> /etc/ssh/sshd_config && \\
    yum clean all

EXPOSE 22`;
            sshStartCommand = '/usr/sbin/sshd -D';
          } else {
            // Debian/Ubuntu-based setup (default)
            sshSetupCommands = `
# SSH Setup for Debian/Ubuntu
RUN apt-get update && \\
    DEBIAN_FRONTEND=noninteractive apt-get install -y openssh-server sudo iproute2 iputils-ping net-tools bash passwd vim && \\
    mkdir -p /var/run/sshd /root && \\
    useradd -m -s /bin/bash sshuser || true && \\
    echo "root:password" | chpasswd && \\
    echo "sshuser:password" | chpasswd && \\
    passwd -u root && \\
    passwd -u sshuser || true && \\
    rm -f /etc/ssh/sshd_config && \\
    echo 'Port 22' >> /etc/ssh/sshd_config && \\
    echo 'Protocol 2' >> /etc/ssh/sshd_config && \\
    echo 'HostKey /etc/ssh/ssh_host_rsa_key' >> /etc/ssh/sshd_config && \\
    echo 'HostKey /etc/ssh/ssh_host_ecdsa_key' >> /etc/ssh/sshd_config && \\
    echo 'HostKey /etc/ssh/ssh_host_ed25519_key' >> /etc/ssh/sshd_config && \\
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \\
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'ChallengeResponseAuthentication no' >> /etc/ssh/sshd_config && \\
    echo 'UsePAM no' >> /etc/ssh/sshd_config && \\
    echo 'X11Forwarding no' >> /etc/ssh/sshd_config && \\
    echo 'PrintMotd no' >> /etc/ssh/sshd_config && \\
    echo 'AcceptEnv LANG LC_*' >> /etc/ssh/sshd_config && \\
    echo 'Subsystem sftp /usr/lib/openssh/sftp-server' >> /etc/ssh/sshd_config && \\
    chmod 755 /root && \\
    chmod 644 /etc/ssh/sshd_config && \\
    apt-get clean && \\
    rm -rf /var/lib/apt/lists/*

EXPOSE 22`;
            sshStartCommand = '/usr/sbin/sshd -D -d';
          }
          
          // Check if Dockerfile has CMD or ENTRYPOINT
          const hasCMD = /^CMD\s+/im.test(dockerfileContent);
          const hasENTRYPOINT = /^ENTRYPOINT\s+/im.test(dockerfileContent);
          
          if (hasCMD || hasENTRYPOINT) {
            // If there's existing CMD/ENTRYPOINT, preserve it and start SSH in background
            // Create a startup script that runs both SSH and the original command
            const startupScript = `
# Create startup script to run SSH and original application
RUN echo '#!/bin/bash' > /start.sh && \\
    echo '${sshStartCommand} &' >> /start.sh && \\
    echo 'exec "$@"' >> /start.sh && \\
    chmod +x /start.sh

ENTRYPOINT ["/start.sh"]`;
            
            // Add SSH setup before CMD/ENTRYPOINT, then modify ENTRYPOINT
            const cmdMatch = dockerfileContent.match(/^(CMD|ENTRYPOINT)\s+/im);
            const cmdIndex = dockerfileContent.search(/^(CMD|ENTRYPOINT)\s+/im);
            
            // Insert SSH setup before CMD/ENTRYPOINT
            enhancedDockerfile = dockerfileContent.slice(0, cmdIndex) + sshSetupCommands + '\n' + startupScript + '\n\n' + dockerfileContent.slice(cmdIndex);
          } else {
            // No CMD/ENTRYPOINT, just add SSH as the main command
            enhancedDockerfile = dockerfileContent + '\n' + sshSetupCommands + `\nCMD ["${sshStartCommand.split(' ')[0]}", "${sshStartCommand.split(' ').slice(1).join('", "')}"]`;
          }
        }
        
        // Write enhanced Dockerfile
        const dockerfilePath = path.join(tempDir, 'Dockerfile');
        fs.writeFileSync(dockerfilePath, enhancedDockerfile);
        console.log('Dockerfile written to temporary directory');
        console.log('Enhanced Dockerfile:\n', enhancedDockerfile);
        
        // Build image using exec for better control
        console.log(`Building Docker image: ${imageName}...`);
        const buildCommand = `docker build -t ${imageName} "${tempDir}"`;
        
        await new Promise((resolve, reject) => {
          exec(buildCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              console.error('Build error:', stderr || error.message);
              reject(new Error(`Docker build failed: ${stderr || error.message}`));
            } else {
              console.log('Build output:', stdout);
              resolve();
            }
          });
        });
        
        console.log('✓ Image built successfully');
        
        // Find available SSH port
        const sshPort = await findAvailablePortFast(2222);
        console.log(`Allocated SSH port: ${sshPort}`);
        
        // Create and start container
        console.log('Creating container...');
        const container = await docker.createContainer({
          Image: imageName,
          name: containerName,
          ExposedPorts: {
            '22/tcp': {}
          },
          HostConfig: {
            PortBindings: {
              '22/tcp': [{ HostPort: String(sshPort) }]
            }
          }
        });
        
        console.log('Starting container...');
        await container.start();
        const containerId = container.id;
        const trimmedId = containerId.substring(0, 12);
        
        console.log(`Container started: ${trimmedId}`);
        
        // Give container extra time to fully initialize before checking SSH
        console.log('Waiting for container to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test if we can exec into container to verify it's running
        try {
          const testExec = await container.exec({
            Cmd: ['bash', '-c', 'echo "Container is responsive"'],
            AttachStdout: true,
            AttachStderr: true
          });
          const testStream = await testExec.start();
          let testOutput = '';
          testStream.on('data', (chunk) => testOutput += chunk.toString());
          await new Promise(resolve => testStream.on('end', resolve));
          console.log('Container exec test:', testOutput);
          
          // Check if password is actually set
          const passwdExec = await container.exec({
            Cmd: ['bash', '-c', 'grep root /etc/shadow | cut -d: -f2'],
            AttachStdout: true,
            AttachStderr: true
          });
          const passwdStream = await passwdExec.start();
          let passwdOutput = '';
          passwdStream.on('data', (chunk) => passwdOutput += chunk.toString());
          await new Promise(resolve => passwdStream.on('end', resolve));
          console.log('Root password hash exists:', passwdOutput.trim().length > 0);
          
          // Check SSH config
          const configExec = await container.exec({
            Cmd: ['bash', '-c', 'cat /etc/ssh/sshd_config | grep -E "(PasswordAuthentication|PermitRootLogin)"'],
            AttachStdout: true,
            AttachStderr: true
          });
          const configStream = await configExec.start();
          let configOutput = '';
          configStream.on('data', (chunk) => configOutput += chunk.toString());
          await new Promise(resolve => configStream.on('end', resolve));
          console.log('SSH Config:', configOutput);
        } catch (execError) {
          console.warn('Could not verify container configuration:', execError.message);
        }
        
        // Wait for SSH to be ready
        let sshReady = false;
        const maxAttempts = 30;
        
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            const exec = await container.exec({
              Cmd: ['sh', '-c', 'netstat -tln 2>/dev/null | grep :22 || ss -tlnH 2>/dev/null | grep :22 || echo "checking"'],
              AttachStdout: true,
              AttachStderr: true,
              Tty: true
            });
            
            const stream = await exec.start();
            let output = '';
            
            await new Promise((resolve, reject) => {
              stream.on('data', (chunk) => output += chunk.toString());
              stream.on('end', resolve);
              stream.on('error', reject);
            });
            
            if (output.includes('22') || output.includes('LISTEN')) {
              sshReady = true;
              console.log(`✓ SSH ready after ${(i + 1) * 0.5} seconds`);
              break;
            }
          } catch (checkError) {
            if (i % 5 === 0) {
              console.log(`Waiting for SSH... (attempt ${i + 1}/${maxAttempts})`);
            }
          }
        }
        
        if (!sshReady) {
          console.warn('⚠ SSH may still be starting');
        }
        
        // Store container info
        containerStore.set(trimmedId, {
          id: trimmedId,
          name: containerName,
          sshPort: sshPort,
          created: Math.floor(Date.now() / 1000),
          image: imageName,
          userId: this.userId,
          sshReady: sshReady,
          fromDockerfile: true
        });
        
        console.log(`✓ Container created from Dockerfile: ${containerName} on port ${sshPort}`);
        
        return {
          success: true,
          containerId: trimmedId,
          containerName: containerName,
          imageName: imageName,
          sshPort: sshPort,
          sshReady: sshReady
        };
        
      } finally {
        // Cleanup temporary directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log('Temporary build directory cleaned up');
        } catch (cleanupError) {
          console.warn('Could not clean up temp directory:', cleanupError.message);
        }
      }
      
    } catch (error) {
      console.error('Error creating container from Dockerfile:', error);
      throw new Meteor.Error('dockerfile-import-failed', error.message);
    }
  }
});

/**
 * OPTIMIZED: Find available port using Dockerode
 */
async function findAvailablePortFast(startPort) {
  let port = startPort;
  const maxAttempts = 100;
  const usedPorts = new Set();
  
  try {
    const containers = await docker.listContainers({ all: true });
    for (const container of containers) {
      if (container.Ports) {
        for (const p of container.Ports) {
          if (p.PublicPort) {
            usedPorts.add(p.PublicPort);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not check Docker ports:', error.message);
  }
  
  // Quick scan for available port
  for (let i = 0; i < maxAttempts; i++) {
    if (!usedPorts.has(port)) {
      return port;
    }
    port++;
  }
  
  throw new Error(`No available ports found after ${maxAttempts} attempts`);
}

// Optional cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('Server shutting down - containers will remain running');
  process.exit(0);
});