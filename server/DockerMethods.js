import { Meteor } from 'meteor/meteor';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
          const { stdout: imageCheck } = await execAsync('docker images -q debian-ssh-server');
          imageExists = imageCheck.trim().length > 0;
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

      // OPTIMIZATION: Start container with healthcheck disabled for faster startup
      const dockerCommand = `docker run -d \
        --name ${containerName} \
        -p ${sshPort}:22 \
        --cap-drop=ALL \
        --cap-add=SETUID \
        --cap-add=SETGID \
        --cap-add=CHOWN \
        --cap-add=DAC_OVERRIDE \
        --cap-add=FOWNER \
        --cap-add=KILL \
        --cap-add=NET_BIND_SERVICE \
        --cap-add=SYS_CHROOT \
        --health-cmd="test -f /var/run/sshd.pid || exit 1" \
        --health-interval=1s \
        --health-retries=10 \
        --health-start-period=1s \
        debian-ssh-server`;

      console.log('Starting container...');
      const { stdout: containerId } = await execAsync(dockerCommand);
      const trimmedId = containerId.trim();

      console.log(`Container created: ${trimmedId}`);

      // OPTIMIZATION: Faster SSH readiness check (reduced from 15 to 8 seconds max)
      // Check every 500ms instead of 1s, and use faster detection method
      let sshReady = false;
      const maxAttempts = 16; // 16 * 500ms = 8 seconds max
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms intervals
        
        try {
          // OPTIMIZATION: Single fast check using ss (faster than netstat)
          const { stdout } = await execAsync(
            `docker exec ${trimmedId} ss -tlnH 2>/dev/null | grep -q :22 && echo "ready" || echo "not ready"`,
            { timeout: 1000 } // 1 second timeout for the command
          );
          
          if (stdout.includes('ready')) {
            sshReady = true;
            console.log(`✓ SSH ready after ${(i + 1) * 0.5} seconds`);
            break;
          }
        } catch (checkError) {
          // Continue checking
          if (i === 0 || i === 5 || i === 10 || i === 15) {
            console.log(`Waiting for SSH... (attempt ${i + 1}/${maxAttempts})`);
          }
        }
      }

      // OPTIMIZATION: Don't fail if SSH isn't detected - return immediately
      // The frontend will retry connection if needed
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
      const { stdout } = await execAsync(
        `docker exec ${containerId} ss -tlnH 2>/dev/null | grep -q :22 && echo "ready" || echo "not ready"`,
        { timeout: 1000 }
      );
      return { ready: stdout.includes('ready') };
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
      // OPTIMIZATION: Single command to get all info
      const { stdout } = await execAsync(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.CreatedAt}}|{{.Ports}}|{{.Status}}"',
        { timeout: 5000 }
      );

      if (!stdout.trim()) {
        return [];
      }

      const containers = stdout.trim().split('\n').map(line => {
        const [id, name, image, created, ports, status] = line.split('|');
        
        // Extract SSH port
        const portMatch = ports.match(/0\.0\.0\.0:(\d+)->22/);
        const sshPort = portMatch ? parseInt(portMatch[1]) : null;

        // Determine status
        const isRunning = status.toLowerCase().includes('up');
        const containerStatus = isRunning ? 'running' : 'exited';

        // Get stored info if available
        const storedInfo = containerStore.get(id);

        // Auto-populate store
        if (!storedInfo && sshPort) {
          containerStore.set(id, {
            id: id,
            name: name,
            sshPort: sshPort,
            created: Math.floor(Date.now() / 1000),
            image: image,
            userId: this.userId
          });
        }

        return {
          id: id,
          name: name || storedInfo?.name || 'unnamed',
          image: image,
          sshPort: sshPort || storedInfo?.sshPort,
          created: storedInfo?.created || Math.floor(Date.now() / 1000),
          status: containerStatus
        };
      });

      return containers;

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

    if (!containerId) {
      throw new Meteor.Error('invalid-params', 'Container ID is required');
    }

    try {
      console.log(`Stopping container: ${containerId}`);
      await execAsync(`docker stop ${containerId}`, { timeout: 10000 });
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

    if (!containerId) {
      throw new Meteor.Error('invalid-params', 'Container ID is required');
    }

    try {
      console.log(`Starting container: ${containerId}`);
      await execAsync(`docker start ${containerId}`, { timeout: 5000 });
      console.log(`Container started: ${containerId}`);
      
      // Brief wait for SSH (but don't block)
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

    if (!containerId) {
      throw new Meteor.Error('invalid-params', 'Container ID is required');
    }

    try {
      console.log(`Removing container: ${containerId}`);
      
      // Stop first if running
      try {
        await execAsync(`docker stop ${containerId}`, { timeout: 5000 });
      } catch (stopError) {
        console.log('Container already stopped');
      }
      
      // Remove the container
      await execAsync(`docker rm ${containerId}`, { timeout: 5000 });

      // Remove from store
      containerStore.delete(containerId);

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
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${containerId}`, { timeout: 5000 });
      return stdout;
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw new Meteor.Error('get-logs-failed', error.message);
    }
  }
});

/**
 * OPTIMIZED: Find available port with caching and batch checking
 */
async function findAvailablePortFast(startPort) {
  let port = startPort;
  const maxAttempts = 100;
  const usedPorts = new Set();
  
  try {
    // Get all Docker ports in one go
    const { stdout } = await execAsync('docker ps -a --format "{{.Ports}}"', { timeout: 2000 });
    const portMatches = stdout.matchAll(/0\.0\.0\.0:(\d+)->/g);
    for (const match of portMatches) {
      usedPorts.add(parseInt(match[1]));
    }
  } catch (error) {
    console.warn('Could not check Docker ports:', error.message);
  }
  
  // Quick scan for available port
  for (let i = 0; i < maxAttempts; i++) {
    if (!usedPorts.has(port)) {
      // Quick system port check (optional - skip for speed)
      try {
        const { stdout } = await execAsync(`lsof -i :${port} 2>/dev/null || echo "available"`, { timeout: 500 });
        if (stdout.includes('available') || !stdout.trim()) {
          return port;
        }
      } catch (error) {
        // If lsof fails or times out, assume port is available
        return port;
      }
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