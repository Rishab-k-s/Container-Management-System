import { Meteor } from 'meteor/meteor';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store for tracking created containers
const containerStore = new Map();

Meteor.methods({
  /**
   * Create a new Docker container from the Debian SSH image
   */
  async 'docker.createContainer'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      console.log('Creating new Docker container...');

      // Generate a unique container name
      const timestamp = Date.now();
      const containerName = `debian-ssh-${timestamp}`;
      
      // Find an available port (starting from 2222)
      const sshPort = await findAvailablePort(2222);
      
      // Build the Docker image first (if not already built)
      console.log('Building Docker image...');
      try {
        await execAsync('docker build -t debian-ssh-server /path/to/dockerfile/directory');
      } catch (buildError) {
        console.log('Image might already exist or build path issue:', buildError.message);
        // Continue anyway as image might already exist
      }

      // Create and start the container
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
        debian-ssh-server`;

      const { stdout: containerId } = await execAsync(dockerCommand);
      const trimmedId = containerId.trim();

      console.log(`Container created: ${trimmedId}`);

      // Wait a moment for SSH to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Store container info
      containerStore.set(trimmedId, {
        id: trimmedId,
        name: containerName,
        sshPort: sshPort,
        created: Math.floor(Date.now() / 1000),
        image: 'debian-ssh-server',
        userId: this.userId
      });

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
 */
async function findAvailablePort(startPort) {
  let port = startPort;
  const maxAttempts = 100;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Check if port is in use
      const { stdout } = await execAsync(`docker ps --format "{{.Ports}}" | grep ${port}`);
      if (!stdout.trim()) {
        return port; // Port is available
      }
      port++; // Try next port
    } catch (error) {
      // If grep returns nothing (exit code 1), port is available
      return port;
    }
  }
  
  throw new Error('No available ports found');
}

// Cleanup on server shutdown
process.on('SIGINT', async () => {
  console.log('Cleaning up containers...');
  for (const containerId of containerStore.keys()) {
    try {
      await execAsync(`docker stop ${containerId}`);
      await execAsync(`docker rm ${containerId}`);
    } catch (error) {
      console.error(`Error cleaning up container ${containerId}:`, error);
    }
  }
  process.exit(0);
});