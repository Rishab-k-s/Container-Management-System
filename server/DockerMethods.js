import { Meteor } from 'meteor/meteor';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const docker = new Docker();

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
        const buildPath = dockerfilePath || process.env.DOCKERFILE_PATH || './docker';
        const buildCommand = `docker build -t debian-ssh-server "${buildPath}"`;
        console.log(`Building with command: ${buildCommand}`);
        
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
          },
          CapDrop: ['ALL'],
          CapAdd: [
            'SETUID', 'SETGID', 'CHOWN', 'DAC_OVERRIDE', 'FOWNER', 
            'KILL', 'NET_BIND_SERVICE', 'SYS_CHROOT'
          ]
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