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

        // Request a proper PTY with xterm terminal
        ssh.shell({
          term: 'xterm-256color',
          cols: 80,
          rows: 24,
          width: 640,
          height: 480,
          modes: {
            ECHO: 1,      // Enable echo mode
            ECHOCTL: 1    // Echo control characters
          }
        }, (err, stream) => {
          if (err) {
            console.error('SSH shell error:', err);
            socket.emit('container-error', { message: err.message });
            return;
          }

          console.log('SSH shell established with PTY for container:', containerId);

          // Forward SSH output to client
          stream.on('data', (data) => {
            const output = data.toString('utf-8');
            console.log('SSH output:', output.length, 'bytes');
            socket.emit('container-output', output);
          });

          stream.on('close', () => {
            console.log('SSH stream closed');
            socket.emit('container-error', { message: 'SSH session closed' });
            ssh.end();
          });

          stream.stderr.on('data', (data) => {
            console.error('SSH stderr:', data.toString());
          });

          // Handle input from client
          socket.on('container-input', (data) => {
            console.log('Received input from client:', JSON.stringify(data), 'length:', data.length);
            stream.write(data);
          });

          // Handle terminal resize - important for proper display
          socket.on('container-resize', ({ cols, rows }) => {
            console.log('Terminal resize:', cols, 'x', rows);
            try {
              stream.setWindow(rows, cols, 640, 480);
            } catch (e) {
              console.error('Error resizing terminal:', e);
            }
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

      ssh.connect({
        host: host || 'localhost',
        port: sshPort,
        username: username || 'root',
        password: password || 'password123',
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        // Add these for better compatibility
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521']
        },
        debug: (msg) => console.log('SSH Debug:', msg)
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