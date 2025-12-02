import { Meteor } from 'meteor/meteor';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store for tracking created containers
const containerStore = new Map();

Meteor.methods({
  /**
   * Create a new Docker container from the Debian SSH image
   * @param {string} dockerfilePath - Optional path to Dockerfile directory
   */
  async 'docker.createContainer'(dockerfilePath) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log('Creating new Docker container...');

      // Generate a unique container name with random suffix to avoid collisions
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const containerName = `debian-ssh-${timestamp}-${randomSuffix}`;
      
      // Find an available port (starting from 2222)
      const sshPort = await findAvailablePort(2222);
      console.log(`Allocated SSH port: ${sshPort}`);
      
      // Build the Docker image first (if not already built)
      console.log('Checking/Building Docker image...');
      try {
        // Check if image exists
        const { stdout: imageCheck } = await execAsync('docker images -q debian-ssh-server');
        
        if (!imageCheck.trim()) {
          console.log('Image not found, building...');
          
          // Use provided path or environment variable or default
          const buildPath = dockerfilePath || process.env.DOCKERFILE_PATH || './docker';
          
          // Build with proper error handling
          const buildCommand = `docker build -t debian-ssh-server "${buildPath}"`;
          console.log(`Building with command: ${buildCommand}`);
          
          const { stdout: buildOutput, stderr: buildError } = await execAsync(buildCommand);
          console.log('Build output:', buildOutput);
          if (buildError) console.log('Build warnings:', buildError);
          
          console.log('✓ Image built successfully');
        } else {
          console.log('✓ Image already exists');
        }
      } catch (buildError) {
        console.error('Error building image:', buildError);
        throw new Meteor.Error('image-build-failed', 
          `Failed to build Docker image. Make sure Dockerfile exists at the specified path. Error: ${buildError.message}`);
      }

      // Create and start the container with unique name
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
        debian-ssh-server`;

      console.log('Starting container...');
      const { stdout: containerId } = await execAsync(dockerCommand);
      const trimmedId = containerId.trim();

      console.log(`Container created: ${trimmedId}`);

      // Wait for SSH server to be ready (up to 15 seconds)
      let sshReady = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // Check if container is still running
          const { stdout: statusCheck } = await execAsync(`docker inspect -f '{{.State.Running}}' ${trimmedId}`);
          if (!statusCheck.trim().includes('true')) {
            throw new Error('Container stopped unexpectedly');
          }

          // Check if SSH port is listening inside container (try multiple methods)
          const { stdout } = await execAsync(`docker exec ${trimmedId} bash -c "ss -tuln | grep :22 || netstat -tuln 2>/dev/null | grep :22 || echo 'not ready'"`);
          if (stdout.includes(':22') || stdout.includes('0.0.0.0:22') || stdout.includes(':::22')) {
            sshReady = true;
            console.log(`✓ SSH server ready after ${i + 1} seconds`);
            break;
          }
        } catch (checkError) {
          console.log(`Waiting for SSH... (${i + 1}/15) - ${checkError.message}`);
        }
      }

      if (!sshReady) {
        console.warn('⚠ SSH server may not be ready yet, but continuing...');
        // Don't fail - let the connection attempt handle it
      }

      // Store container info
      containerStore.set(trimmedId, {
        id: trimmedId,
        name: containerName,
        sshPort: sshPort,
        created: Math.floor(Date.now() / 1000),
        image: 'debian-ssh-server',
        userId: this.userId
      });

      console.log(`✓ Container ready: ${containerName} on port ${sshPort}`);

      return {
        success: true,
        containerId: trimmedId,
        containerName: containerName,
        sshPort: sshPort
      };

    } catch (error) {
      console.error('Error creating container:', error);
      throw new Meteor.Error('container-creation-failed', error.message);
    }
  },

  /**
   * List all containers (running and stopped)
   */
  async 'docker.listContainers'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      // Get list of ALL containers (running and stopped) with -a flag
      const { stdout } = await execAsync(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.CreatedAt}}|{{.Ports}}|{{.Status}}"'
      );

      if (!stdout.trim()) {
        return [];
      }

      const containers = stdout.trim().split('\n').map(line => {
        const [id, name, image, created, ports, status] = line.split('|');
        
        // Extract SSH port from ports string (e.g., "0.0.0.0:2222->22/tcp")
        const portMatch = ports.match(/0\.0\.0\.0:(\d+)->22/);
        const sshPort = portMatch ? parseInt(portMatch[1]) : null;

        // Determine if container is running
        const isRunning = status.toLowerCase().includes('up');
        const containerStatus = isRunning ? 'running' : 'exited';

        // Get stored info if available
        const storedInfo = containerStore.get(id);

        // If container is not in store, add it
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
   * Stop a running container (but keep it for restarting)
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
      
      // Stop the container (but DON'T remove it)
      await execAsync(`docker stop ${containerId}`);

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
      
      // Start the container
      await execAsync(`docker start ${containerId}`);

      console.log(`Container started: ${containerId}`);
      
      // Wait a bit for SSH to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        await execAsync(`docker stop ${containerId}`);
      } catch (stopError) {
        // Container might already be stopped
        console.log('Container already stopped or error stopping:', stopError.message);
      }
      
      // Remove the container
      await execAsync(`docker rm ${containerId}`);

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
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${containerId}`);
      return stdout;
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw new Meteor.Error('get-logs-failed', error.message);
    }
  }
});

/**
 * Helper function to find an available port
 * Checks both Docker containers and system ports
 */
async function findAvailablePort(startPort) {
  let port = startPort;
  const maxAttempts = 100;
  const usedPorts = new Set();
  
  try {
    // Get all ports used by Docker containers
    const { stdout } = await execAsync('docker ps -a --format "{{.Ports}}"');
    const portMatches = stdout.matchAll(/0\.0\.0\.0:(\d+)->/g);
    for (const match of portMatches) {
      usedPorts.add(parseInt(match[1]));
    }
  } catch (error) {
    console.warn('Could not check Docker ports:', error.message);
  }
  
  for (let i = 0; i < maxAttempts; i++) {
    // Check if port is in use by Docker
    if (usedPorts.has(port)) {
      port++;
      continue;
    }
    
    // Check if port is in use by system
    try {
      const { stdout: lsofCheck } = await execAsync(`lsof -i :${port} || echo "available"`);
      if (lsofCheck.includes('available') || !lsofCheck.trim()) {
        return port; // Port is available
      }
      port++;
    } catch (error) {
      // lsof not available or port is free
      return port;
    }
  }
  
  throw new Error(`No available ports found after ${maxAttempts} attempts`);
}

// Cleanup on server shutdown (optional - removes all containers)
process.on('SIGINT', async () => {
  console.log('Server shutting down - cleaning up containers...');
  for (const [containerId, info] of containerStore.entries()) {
    try {
      console.log(`Stopping container: ${info.name}`);
      await execAsync(`docker stop ${containerId}`);
      // Optionally remove: await execAsync(`docker rm ${containerId}`);
    } catch (error) {
      console.error(`Error cleaning up container ${containerId}:`, error);
    }
  }
  process.exit(0);
});