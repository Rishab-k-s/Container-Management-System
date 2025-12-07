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

    // Close any existing connection for this socket
    const existingConnection = sshConnections.get(socket.id);
    if (existingConnection) {
      console.log('Closing existing connection for socket:', socket.id);
      existingConnection.ssh.end();
      sshConnections.delete(socket.id);
    }

    const { containerId, sshPort, host, username, password } = connectionData;
    
    const actualUsername = username || 'root';
    const actualPassword = password || 'password';
    
    console.log(`Attempting SSH connection to ${host || 'localhost'}:${sshPort} with username: ${actualUsername}`);

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

          // Automatically switch to root directory to avoid user confusion
          stream.write('cd /\n');

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
          socket.removeAllListeners('container-input');
          socket.on('container-input', (data) => {
            console.log('Received input from client:', JSON.stringify(data), 'length:', data.length);
            stream.write(data);
          });

          // Handle terminal resize - important for proper display
          socket.removeAllListeners('container-resize');
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
        // Only delete if this is the current connection for this socket
        const current = sshConnections.get(socket.id);
        if (current && current.ssh === ssh) {
          sshConnections.delete(socket.id);
        }
      });

      ssh.on('close', () => {
        console.log('SSH connection closed');
        // Only delete if this is the current connection for this socket
        const current = sshConnections.get(socket.id);
        if (current && current.ssh === ssh) {
          sshConnections.delete(socket.id);
        }
      });

      ssh.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        console.log('SSH keyboard-interactive auth');
        finish([actualPassword]);
      });

      ssh.connect({
        host: host || 'localhost',
        port: sshPort,
        username: actualUsername,
        password: actualPassword,
        tryKeyboard: true,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        // Add these for better compatibility
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519']
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

  // ==========================================
  // VM Terminal Handlers (Generic SSH)
  // ==========================================

  socket.on('startSession', (data) => {
    console.log('Starting VM SSH session:', data.host);
    
    // Close any existing connection for this socket
    const existingConnection = sshConnections.get(socket.id);
    if (existingConnection) {
      console.log('Closing existing VM connection for socket:', socket.id);
      existingConnection.ssh.end();
      sshConnections.delete(socket.id);
    }

    const ssh = new Client();
    sshConnections.set(socket.id, { ssh, type: 'vm' });

    ssh.on('ready', () => {
      console.log('VM SSH Client :: ready');
      socket.emit('sshConnected', { message: 'Connected successfully' });

      ssh.shell({
        term: 'xterm-256color',
        cols: 80,
        rows: 24
      }, (err, stream) => {
        if (err) {
          console.error('VM SSH Shell Error:', err);
          socket.emit('error', { message: 'Failed to start shell: ' + err.message });
          return;
        }

        // Handle output from SSH
        stream.on('data', (chunk) => {
          socket.emit('output', chunk.toString('utf-8'));
        });

        stream.on('close', () => {
          console.log('VM SSH Stream :: close');
          socket.emit('ssh-session-ended');
          ssh.end();
        });

        stream.stderr.on('data', (data) => {
          socket.emit('output', data.toString('utf-8'));
        });

        // Handle input from client
        socket.removeAllListeners('input');
        socket.on('input', (inputData) => {
          stream.write(inputData);
        });

        // Handle resize
        socket.removeAllListeners('resize');
        socket.on('resize', (size) => {
          if (size && size.cols && size.rows) {
            stream.setWindow(size.rows, size.cols, 0, 0);
          }
        });
      });
    });

    ssh.on('error', (err) => {
      console.error('VM SSH Client Error:', err);
      socket.emit('error', { message: err.message });
      const current = sshConnections.get(socket.id);
      if (current && current.ssh === ssh) {
        sshConnections.delete(socket.id);
      }
    });

    ssh.on('close', () => {
      console.log('VM SSH Client :: close');
      socket.emit('ssh-session-ended');
      const current = sshConnections.get(socket.id);
      if (current && current.ssh === ssh) {
        sshConnections.delete(socket.id);
      }
    });

    try {
      const connectConfig = {
        host: data.host,
        port: parseInt(data.port),
        username: data.username,
        readyTimeout: 20000,
        keepaliveInterval: 10000
      };

      if (data.useKeyAuth) {
        connectConfig.privateKey = data.privateKey;
        if (data.passphrase) {
          connectConfig.passphrase = data.passphrase;
        }
      } else {
        connectConfig.password = data.password;
      }

      ssh.connect(connectConfig);
    } catch (err) {
      console.error('VM SSH Connect Exception:', err);
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('endSession', () => {
    console.log('Ending VM SSH session');
    const connection = sshConnections.get(socket.id);
    if (connection && connection.ssh) {
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