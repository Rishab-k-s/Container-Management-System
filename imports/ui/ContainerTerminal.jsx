// ContainerTerminal.jsx - OPTIMIZED with SSH polling
// Connects immediately and polls for SSH readiness

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Meteor } from 'meteor/meteor';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

export const ContainerTerminal = ({ container, onClose }) => {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);
  const isInitialized = useRef(false);
  const inputHandlerRef = useRef(null);
  const isConnectedRef = useRef(false);
  const sshPollInterval = useRef(null);
  
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // Initialize terminal
  const initializeTerminal = () => {
    if (isInitialized.current || !terminalRef.current) return;

    try {
      term.current = new Terminal({
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        disableStdin: false,
        scrollback: 1000,
        theme: { 
          background: '#1e1e1e',
          foreground: '#f8f8f2',
          cursor: '#f8f8f2',
          selection: '#44475a',
          black: '#21222c',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#bd93f9',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
          brightBlack: '#6272a4',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff'
        },
        scrollOnUserInput: true,
        convertEol: false,
        allowTransparency: false,
        cols: 80,
        rows: 24
      });

      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalRef.current);
      
      term.current.writeln(`\x1b[1;36m┌─────────────────────────────────────┐\x1b[0m`);
      term.current.writeln(`\x1b[1;36m│  Connecting to Container...         │\x1b[0m`);
      term.current.writeln(`\x1b[1;36m└─────────────────────────────────────┘\x1b[0m`);
      term.current.writeln('');
      term.current.writeln(`Container: ${container.name || container.id.substring(0, 12)}`);
      term.current.writeln(`SSH Port: ${container.sshPort}`);
      term.current.writeln('');

      isInitialized.current = true;

      // Fit terminal to container
      setTimeout(() => {
        try {
          if (fitAddon.current && term.current && terminalRef.current) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddon.current.fit();
              term.current.focus();
            }
          }
        } catch (fitError) {
          console.warn('Initial fit failed:', fitError);
        }
      }, 200);

    } catch (error) {
      console.error('Terminal initialization error:', error);
      isInitialized.current = false;
    }
  };

  // Setup input handler
  const setupInputHandler = () => {
    if (!term.current || !socket.current) return;

    if (inputHandlerRef.current) {
      inputHandlerRef.current.dispose?.();
    }

    inputHandlerRef.current = term.current.onData((data) => {
      if (socket.current && socket.current.connected) {
        socket.current.emit('container-input', data);
      }
    });

    sendTerminalSize();
  };

  // Send terminal dimensions
  const sendTerminalSize = () => {
    if (!fitAddon.current || !socket.current || !socket.current.connected) return;
    
    try {
      const dims = fitAddon.current.proposeDimensions();
      if (dims) {
        socket.current.emit('container-resize', {
          cols: dims.cols || 80,
          rows: dims.rows || 24
        });
      }
    } catch (e) {
      console.warn('Failed to send terminal size:', e);
    }
  };

  // OPTIMIZATION: Poll for SSH readiness
  const checkSSHReady = () => {
    Meteor.call('docker.checkSSHReady', container.id, (err, result) => {
      if (err) {
        console.error('SSH check error:', err);
        return;
      }

      if (result && result.ready) {
        console.log('SSH is ready, attempting connection...');
        if (sshPollInterval.current) {
          clearInterval(sshPollInterval.current);
          sshPollInterval.current = null;
        }
        attemptConnection();
      }
    });
  };

  // Attempt SSH connection
  const attemptConnection = () => {
    if (!socket.current || !socket.current.connected) {
      console.warn('Socket not connected, cannot attempt SSH connection');
      return;
    }

    setConnectionStatus('Connecting to SSH...');
    
    if (term.current && isInitialized.current) {
      term.current.writeln('\x1b[36mConnecting to SSH server...\x1b[0m');
    }

    socket.current.emit('container-connect', {
      containerId: container.id,
      sshPort: container.sshPort,
      host: 'localhost',
      username: 'root',
      password: 'password123'
    });
  };

  useEffect(() => {
    initializeTerminal();

    // Handle window resize
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          if (fitAddon.current && term.current && isInitialized.current && terminalRef.current) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddon.current.fit();
              term.current.focus();
              sendTerminalSize();
            }
          }
        } catch (error) {
          console.warn('Resize fit failed:', error);
        }
      }, 250);
    };

    window.addEventListener('resize', handleResize);

    // Initialize socket connection
    const initSocket = () => {
      try {
        socket.current = io(window.location.origin, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        });

        socket.current.on('connect', () => {
          console.log('WebSocket connected');
          if (term.current && isInitialized.current) {
            term.current.writeln('\x1b[32m✓ WebSocket connected\x1b[0m');
          }
          
          // OPTIMIZATION: Start polling for SSH immediately
          if (container.sshReady) {
            // Container reported SSH as ready, connect immediately
            if (term.current && isInitialized.current) {
              term.current.writeln('\x1b[32m✓ SSH server ready\x1b[0m');
            }
            setTimeout(() => attemptConnection(), 500);
          } else {
            // Poll for SSH readiness
            if (term.current && isInitialized.current) {
              term.current.writeln('\x1b[33m⏳ Waiting for SSH server...\x1b[0m');
            }
            setConnectionStatus('Waiting for SSH...');
            
            // Check immediately and then every 500ms
            checkSSHReady();
            sshPollInterval.current = setInterval(checkSSHReady, 500);
            
            // Timeout after 10 seconds
            setTimeout(() => {
              if (sshPollInterval.current) {
                clearInterval(sshPollInterval.current);
                sshPollInterval.current = null;
                attemptConnection(); // Try anyway
              }
            }, 10000);
          }
        });

        socket.current.on('container-output', data => {
          if (term.current && isInitialized.current) {
            term.current.write(data);
          }
        });

        socket.current.on('container-connected', () => {
          console.log('SSH PTY connected');
          setConnectionStatus('Connected');
          setIsConnected(true);
          isConnectedRef.current = true;
          
          if (term.current && isInitialized.current) {
            term.current.writeln('\x1b[32m✓ SSH connection established\x1b[0m');
            term.current.writeln('\x1b[33m⚡ PTY mode - Full Linux shell active\x1b[0m');
            term.current.writeln('');
            
            setTimeout(() => {
              setupInputHandler();
              term.current.focus();
            }, 100);
          }
        });

        socket.current.on('container-error', (error) => {
          console.error('Container connection error:', error);
          
          // Retry logic
          if (error.message && error.message.includes('ECONNRESET') && retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setConnectionStatus(`Retrying... (${retryCount + 1}/${maxRetries})`);
            
            if (term.current && isInitialized.current) {
              term.current.writeln(`\r\n\x1b[33m⚠ Connection reset, retrying in 1 second...\x1b[0m`);
            }
            
            setTimeout(() => {
              if (socket.current && socket.current.connected) {
                attemptConnection();
              }
            }, 1000);
          } else {
            setConnectionStatus('Connection Error');
            if (term.current && isInitialized.current) {
              term.current.writeln(`\r\n\x1b[31m✗ Connection error: ${error.message || error}\x1b[0m`);
              if (retryCount >= maxRetries) {
                term.current.writeln(`\x1b[31m✗ Max retries (${maxRetries}) reached\x1b[0m`);
              }
            }
          }
        });

        socket.current.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnectionStatus('Disconnected');
          setIsConnected(false);
          isConnectedRef.current = false;
          if (term.current && isInitialized.current) {
            term.current.writeln('\r\n\x1b[31m✗ Disconnected\x1b[0m');
          }
        });

      } catch (socketError) {
        console.error('Socket initialization error:', socketError);
      }
    };

    setTimeout(initSocket, 300); // Reduced from 500ms

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      
      if (sshPollInterval.current) {
        clearInterval(sshPollInterval.current);
      }
      
      if (inputHandlerRef.current) {
        inputHandlerRef.current.dispose?.();
      }
      
      if (socket.current) {
        socket.current.emit('container-disconnect');
        socket.current.disconnect();
      }
      
      if (term.current) {
        term.current.dispose();
      }
      
      isInitialized.current = false;
    };
  }, [container]);

  const handleTerminalClick = () => {
    if (term.current && isInitialized.current) {
      term.current.focus();
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
    handleTerminalClick();
  };

  const getStatusColor = () => {
    if (connectionStatus.includes('Waiting') || connectionStatus.includes('Initializing')) return '#f39c12';
    if (isConnected) return '#2ecc71';
    return '#e74c3c';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <h3>SSH Terminal - {container.name || container.id.substring(0, 12)}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="terminal-status-bar" style={{
          padding: '12px 24px',
          backgroundColor: '#34495e',
          borderBottom: '1px solid #4a5f7a',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            boxShadow: isConnected ? `0 0 10px ${getStatusColor()}` : 'none',
            transition: 'all 0.3s ease'
          }}></div>
          <span style={{ color: '#ecf0f1', fontSize: '14px', fontWeight: '500' }}>
            {connectionStatus}
          </span>
          {isConnected && (
            <span style={{ 
              color: '#95a5a6', 
              fontSize: '12px', 
              marginLeft: 'auto',
              fontStyle: 'italic'
            }}>
              PTY Mode • Full Shell
            </span>
          )}
        </div>

        <div 
          ref={terminalRef}
          className="terminal-instance"
          onClick={handleTerminalClick}
          style={{ 
            height: '500px',
            padding: '10px',
            backgroundColor: '#1e1e1e',
            cursor: 'text',
            outline: 'none'
          }}
        />
      </div>
    </div>
  );
};