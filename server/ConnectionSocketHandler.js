import { WebApp } from 'meteor/webapp';
import { Server } from 'socket.io';
import { Client } from 'ssh2';

// Create Socket.IO server
const io = new Server(WebApp.httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store active SSH connections
const sshConnections = new Map();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle container SSH connection
  socket.on('container-connect', async (connectionData) => {
    console.log('Container connect request:', connectionData);

    const { containerId, sshPort, host, username, password } = connectionData;

    if (!sshPort) {
      socket.emit('container-error', { message: 'SSH port not available' });
      return;
    }

    try {
      const ssh = new Client();
      
      // Store SSH client
      sshConnections.set(socket.id, { ssh, containerId });

      ssh.on('ready', () => {
        console.log(`SSH connection ready for container ${containerId}`);
        socket.emit('container-connected');

        ssh.shell((err, stream) => {
          if (err) {
            console.error('SSH shell error:', err);
            socket.emit('container-error', { message: err.message });
            return;
          }

          // Forward SSH output to client
          stream.on('data', (data) => {
            socket.emit('container-output', data.toString('utf-8'));
          });

          stream.on('close', () => {
            console.log('SSH stream closed');
            socket.emit('container-error', { message: 'SSH session closed' });
            ssh.end();
          });

          // Handle input from client
          socket.on('container-input', (data) => {
            stream.write(data);
          });

          // Handle terminal resize
          socket.on('container-resize', ({ cols, rows }) => {
            stream.setWindow(rows, cols);
          });
        });
      });

      ssh.on('error', (err) => {
        console.error('SSH connection error:', err);
        socket.emit('container-error', { message: err.message });
        sshConnections.delete(socket.id);
      });

      ssh.on('close', () => {
        console.log('SSH connection closed');
        sshConnections.delete(socket.id);
      });

      // Connect to SSH server
      ssh.connect({
        host: host || 'localhost',
        port: sshPort,
        username: username || 'root',
        password: password || 'password123',
        readyTimeout: 20000
      });

    } catch (error) {
      console.error('Error establishing SSH connection:', error);
      socket.emit('container-error', { message: error.message });
    }
  });

  // Handle container disconnect
  socket.on('container-disconnect', () => {
    console.log(`Disconnecting container SSH for ${socket.id}`);
    const connection = sshConnections.get(socket.id);
    
    if (connection) {
      connection.ssh.end();
      sshConnections.delete(socket.id);
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const connection = sshConnections.get(socket.id);
    
    if (connection) {
      connection.ssh.end();
      sshConnections.delete(socket.id);
    }
  });
});

console.log('Socket.IO server initialized for container management');

export { io };