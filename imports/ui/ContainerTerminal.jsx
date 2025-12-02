import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
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
  
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);

  // Initialize terminal
  const initializeTerminal = () => {
    if (isInitialized.current || !terminalRef.current) return;

    try {
      term.current = new Terminal({
        fontSize: 14,
        cursorBlink: true,
        disableStdin: false,
        scrollback: 5000,
        theme: { 
          background: '#1e1e1e', 
          foreground: '#ffffff',
          cursor: '#ffffff',
          selection: '#4d4d4d'
        },
        scrollOnUserInput: true,
        fastScrollSensitivity: 5,
        scrollSensitivity: 1,
        convertEol: true,
        allowTransparency: false,
        cols: 80,
        rows: 24
      });

      term.current.loadAddon(fitAddon.current);
      term.current.open(terminalRef.current);
      term.current.focus();
      
      term.current.writeln(`Connecting to container: ${container.name || container.id.substring(0, 12)}`);
      term.current.writeln(`SSH Port: ${container.sshPort}`);
      term.current.writeln('');

      isInitialized.current = true;

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

    inputHandlerRef.current = (data) => {
      if (socket.current && socket.current.connected && isConnectedRef.current) {
        socket.current.emit('container-input', data);
      }
    };

    term.current.onData(inputHandlerRef.current);
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
          console.log('Connected to WebSocket server');
          if (term.current && isInitialized.current) {
            term.current.writeln('\x1b[32mConnected to server\x1b[0m');
          }
          
          // Initiate SSH connection to container
          socket.current.emit('container-connect', {
            containerId: container.id,
            sshPort: container.sshPort,
            host: 'localhost',
            username: 'root',
            password: 'password123'
          });
        });

        socket.current.on('container-output', data => {
          if (term.current && isInitialized.current) {
            term.current.write(data);
          }
        });

        socket.current.on('container-connected', () => {
          console.log('Container SSH connected');
          setConnectionStatus('Connected');
          setIsConnected(true);
          isConnectedRef.current = true;
          
          if (term.current && isInitialized.current) {
            term.current.writeln('\r\n\x1b[32m✓ SSH Connection established\x1b[0m\r\n');
            setTimeout(() => {
              setupInputHandler();
              term.current.focus();
            }, 200);
          }
        });

        socket.current.on('container-error', (error) => {
          console.error('Container connection error:', error);
          setConnectionStatus('Connection Error');
          if (term.current && isInitialized.current) {
            term.current.writeln(`\r\n\x1b[31mConnection error: ${error.message || error}\x1b[0m\r\n`);
          }
        });

        socket.current.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnectionStatus('Disconnected');
          setIsConnected(false);
          isConnectedRef.current = false;
          if (term.current && isInitialized.current) {
            term.current.writeln('\r\n\x1b[31m✗ Disconnected from server\x1b[0m');
          }
        });

      } catch (socketError) {
        console.error('Socket initialization error:', socketError);
      }
    };

    setTimeout(initSocket, 500);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      
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

  const getStatusColor = () => {
    if (connectionStatus === 'Connecting...') return '#f39c12';
    if (isConnected) return '#2ecc71';
    return '#e74c3c';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Container Terminal - {container.name || container.id.substring(0, 12)}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="terminal-status-bar" style={{
          padding: '12px 24px',
          backgroundColor: '#34495e',
          borderBottom: '1px solid #4a5f7a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            boxShadow: isConnected ? `0 0 10px ${getStatusColor()}` : 'none'
          }}></div>
          <span style={{ color: '#ecf0f1', fontSize: '14px', fontWeight: '500' }}>
            {connectionStatus}
          </span>
        </div>

        <div 
          ref={terminalRef}
          className="terminal-instance"
          onClick={handleTerminalClick}
          style={{ 
            height: '500px',
            padding: '10px',
            backgroundColor: '#1e1e1e',
            cursor: 'text'
          }}
        />
      </div>
    </div>
  );
};