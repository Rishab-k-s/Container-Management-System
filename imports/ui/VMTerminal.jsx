import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import 'xterm/css/xterm.css';

export const VMTerminal = ({ onBack }) => {
  const navigate = useNavigate();
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(new FitAddon());
  const socket = useRef(null);
  const isInitialized = useRef(false);
  const inputHandlerRef = useRef(null);
  
  const [terminals, setTerminals] = useState([{ id: 1, title: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState(1);
  
  const [serverInfo, setServerInfo] = useState({
    host: 'localhost',
    port: 22,
    username: 'root',
    password: '',
    useKeyAuth: false,
    privateKey: '',
    passphrase: ''
  });
  
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logData, setLogData] = useState('');
  
  // Use ref for immediate access to connection state
  const isConnectedRef = useRef(false);

  // Setup terminal input handler
  const setupInputHandler = () => {
    if (!term.current || !socket.current) {
      console.log('Cannot setup input handler - missing terminal or socket');
      return;
    }

    // Remove existing handler if any
    if (inputHandlerRef.current) {
      // XTerm doesn't have an 'off' method, we just replace the handler
      inputHandlerRef.current = null;
    }

    // Create new input handler
    inputHandlerRef.current = (data) => {
      console.log('Terminal input received:', data, 'Connected:', isConnectedRef.current);
      if (socket.current && socket.current.connected && isConnectedRef.current) {
        console.log('Sending input to SSH:', data);
        socket.current.emit('input', data);
        setLogData(prev => prev + data);
      } else {
        console.log('Input ignored - not connected. Socket connected:', socket.current?.connected, 'SSH connected:', isConnectedRef.current);
      }
    };

    // Attach input handler to terminal
    term.current.onData(inputHandlerRef.current);
    console.log('Terminal input handler setup complete');
  };

  // Initialize terminal
  const initializeTerminal = () => {
    if (isInitialized.current || !terminalRef.current) return;

    try {
      // Create terminal instance
      term.current = new Terminal({
        fontSize: 14,
        cursorBlink: true,
        disableStdin: false, // Ensure input is enabled
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

      // Load fit addon
      term.current.loadAddon(fitAddon.current);
      
      // Open terminal in the DOM element
      term.current.open(terminalRef.current);
      
      // Focus the terminal
      term.current.focus();
      
      // Welcome message
      term.current.writeln('New Terminal Instance');

      // Mark as initialized
      isInitialized.current = true;

      // Setup initial input handler
      setupInputHandler();

      // Fit terminal after a short delay to ensure DOM is ready
      setTimeout(() => {
        try {
          if (fitAddon.current && term.current && terminalRef.current) {
            // Check if the terminal container has dimensions
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddon.current.fit();
              term.current.focus(); // Refocus after fit
              console.log('Terminal fitted successfully');
            } else {
              console.warn('Terminal container has no dimensions, retrying...');
              // Retry after another delay
              setTimeout(() => {
                try {
                  if (fitAddon.current && term.current) {
                    fitAddon.current.fit();
                    term.current.focus();
                    console.log('Terminal fitted on retry');
                  }
                } catch (retryError) {
                  console.warn('Retry fit also failed:', retryError);
                }
              }, 1000);
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

  useEffect(() => {
    // Initialize terminal first
    initializeTerminal();

    // Handle window resize with debouncing
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          if (fitAddon.current && term.current && isInitialized.current && terminalRef.current) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              fitAddon.current.fit();
              term.current.focus(); // Refocus after resize
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
            term.current.writeln('\x1b[32mConnected to WebSocket server\x1b[0m');
          }
        });

        socket.current.on('output', data => {
          if (term.current && isInitialized.current) {
            term.current.write(data);
            setLogData(prev => prev + data);
          }
        });

        socket.current.on('sshConnected', (data) => {
          console.log('SSH Connected received', data);
          console.log('Setting isConnected to true');
          setConnectionStatus('SSH Connected');
          setIsConnected(true);
          isConnectedRef.current = true; // Update ref immediately
          setIsConnecting(false);
          
          if (term.current && isInitialized.current) {
            term.current.writeln('\r\n\x1b[32mSSH Connection established\x1b[0m');
            // Re-setup input handler after SSH connection
            setTimeout(() => {
              console.log('Re-setting up input handler with connection state');
              setupInputHandler();
              term.current.focus(); // Ensure terminal has focus
              console.log('Terminal ready for input after SSH connection');
            }, 200);
          }
        });

        socket.current.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnectionStatus('Disconnected');
          setIsConnected(false);
          isConnectedRef.current = false; // Update ref immediately
          setIsConnecting(false);
          if (term.current && isInitialized.current) {
            term.current.writeln('\r\n\x1b[31m✗ Disconnected from server\x1b[0m');
          }
        });

        socket.current.on('error', (error) => {
          console.error('Socket error:', error);
          setIsConnecting(false);
          setConnectionStatus('Connection Error');
          if (term.current && isInitialized.current) {
            term.current.writeln(`\r\n\x1b[31mConnection error: ${error.message || error}\x1b[0m\r\n`);
          }
        });

      } catch (socketError) {
        console.error('Socket initialization error:', socketError);
      }
    };

    // Initialize socket after terminal is ready
    setTimeout(initSocket, 500);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      
      if (socket.current) {
        socket.current.emit('endSession');
        socket.current.disconnect();
      }
      
      if (term.current) {
        term.current.dispose();
      }
      
      isInitialized.current = false;
    };
  }, []); // Empty dependency array for mount only

  // Add click handler to ensure terminal focus
  const handleTerminalClick = () => {
    console.log('Terminal clicked, focusing...');
    if (term.current && isInitialized.current) {
      term.current.focus();
      console.log('Terminal focused, ready for input');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServerInfo(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const validateForm = () => {
    const { host, username, password, privateKey, useKeyAuth, port } = serverInfo;
    
    if (!host.trim() || !username.trim()) {
      return { valid: false, message: 'Host and username are required' };
    }

    if (!port || port.toString().trim() === '') {
      return { valid: false, message: 'Port is required' };
    }

    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return { valid: false, message: 'Port must be between 1 and 65535' };
    }
    
    if (useKeyAuth && !privateKey.trim()) {
      return { valid: false, message: 'Private key is required for key authentication' };
    }
    
    if (!useKeyAuth && !password.trim()) {
      return { valid: false, message: 'Password is required for password authentication' };
    }
    
    return { valid: true };
  };

  const connectSSH = () => {
    const validation = validateForm();
    
    if (!validation.valid) {
      if (term.current && isInitialized.current) {
        term.current.writeln(`\r\n\x1b[31mError: ${validation.message}\x1b[0m\r\n`);
      }
      return;
    }

    if (!socket.current || !socket.current.connected) {
      if (term.current && isInitialized.current) {
        term.current.writeln('\r\n\x1b[31mError: Not connected to server. Please refresh the page.\x1b[0m\r\n');
      }
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Connecting...');

    const port = parseInt(serverInfo.port) || 22;
    
    if (term.current && isInitialized.current) {
      term.current.writeln(`\r\n\x1b[33m→ Connecting to ${serverInfo.host}:${port} as ${serverInfo.username}...\x1b[0m`);
    }

    const connectionData = {
      host: serverInfo.host.trim(),
      port: port,
      username: serverInfo.username.trim(),
      useKeyAuth: serverInfo.useKeyAuth,
      userAgent: navigator.userAgent,
      userId: `vm-user-${Date.now()}`
    };

    if (serverInfo.useKeyAuth) {
      connectionData.privateKey = serverInfo.privateKey;
      if (serverInfo.passphrase) {
        connectionData.passphrase = serverInfo.passphrase;
      }
    } else {
      connectionData.password = serverInfo.password;
    }

    // Set a timeout for connection attempt
    const connectionTimeout = setTimeout(() => {
      if (isConnecting) {
        setIsConnecting(false);
        setConnectionStatus('Connection Timeout');
        if (term.current && isInitialized.current) {
          term.current.writeln('\r\n\x1b[31mConnection timeout. Please check your details and try again.\x1b[0m\r\n');
        }
      }
    }, 30000); // 30 second timeout

    socket.current.emit('startSession', connectionData);

    // Clear timeout when connection succeeds or fails
    socket.current.once('sshConnected', () => {
      clearTimeout(connectionTimeout);
    });

    socket.current.once('error', () => {
      clearTimeout(connectionTimeout);
    });
  };

  const disconnectSSH = () => {
    if (socket.current) {
      socket.current.emit('endSession');
      setConnectionStatus('Disconnected');
      setIsConnected(false);
      isConnectedRef.current = false; // Update ref immediately
      setIsConnecting(false);
      
      if (term.current && isInitialized.current) {
        term.current.writeln('\r\n\x1b[33m✗ SSH session terminated by user\x1b[0m\r\n');
      }
    }
  };

  const clearTerminal = () => {
    if (term.current && isInitialized.current) {
      term.current.clear();
      setLogData('');
      term.current.focus(); // Refocus after clear
    }
  };

  const downloadLog = () => {
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vm-session-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createNewTerminalTab = () => {
    const id = Date.now();
    const newTab = {
      id,
      title: `Terminal ${terminals.length + 1}`
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
  };

  const closeTab = (id) => {
    if (terminals.length <= 1) return; // Don't close last tab
    
    setTerminals(prev => {
      const newTerminals = prev.filter(tab => tab.id !== id);
      return newTerminals;
    });
    
    if (activeTab === id) {
      const remainingTerminals = terminals.filter(tab => tab.id !== id);
      if (remainingTerminals.length > 0) {
        const fallback = remainingTerminals[remainingTerminals.length - 1];
        setActiveTab(fallback.id);
      }
    }
  };

  const getStatusColor = () => {
    if (isConnecting) return '#f39c12';
    if (isConnected) return '#2ecc71';
    return '#e74c3c';
  };

  return (
    <div className="vm-terminal-container">
      {/* Back to Services Button */}
      <div className="back-to-services-header">
        <button className="back-to-services-btn" onClick={() => navigate('/services')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Services
        </button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {terminals.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span title={tab.title}>
              {tab.title}
            </span>
            {terminals.length > 1 && (
              <button 
                className="close-btn" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  closeTab(tab.id); 
                }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button 
          className="add-tab" 
          onClick={createNewTerminalTab}
          title="Add new terminal"
        >
          +
        </button>
      </div>

      {/* Terminal Header with Connection Form */}
      <div className="terminal-header">
        <div className="connection-status" style={{ color: getStatusColor() }}>
          ● {connectionStatus}
        </div>
        <input 
          type="text" 
          name="host" 
          placeholder="Host" 
          value={serverInfo.host} 
          onChange={handleInputChange}
          disabled={isConnected || isConnecting}
        />
        <input 
          type="number" 
          name="port" 
          placeholder="Port" 
          value={serverInfo.port} 
          onChange={handleInputChange}
          disabled={isConnected || isConnecting}
          min="1"
          max="65535"
        />
        <input 
          type="text" 
          name="username" 
          placeholder="Username" 
          value={serverInfo.username} 
          onChange={handleInputChange}
          disabled={isConnected || isConnecting}
        />
        <label>
          <input 
            type="checkbox" 
            name="useKeyAuth" 
            checked={serverInfo.useKeyAuth} 
            onChange={handleInputChange}
            disabled={isConnected || isConnecting}
          /> 
          SSH Key
        </label>
        {!serverInfo.useKeyAuth ? (
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            value={serverInfo.password} 
            onChange={handleInputChange}
            disabled={isConnected || isConnecting}
          />
        ) : (
          <>
            <textarea 
              name="privateKey" 
              placeholder="Private Key" 
              value={serverInfo.privateKey} 
              onChange={handleInputChange}
              disabled={isConnected || isConnecting}
              style={{ display: 'none' }}
            />
            <input 
              type="password" 
              name="passphrase" 
              placeholder="Passphrase" 
              value={serverInfo.passphrase} 
              onChange={handleInputChange}
              disabled={isConnected || isConnecting}
            />
          </>
        )}
        {isConnected ? (
          <>
            <button onClick={disconnectSSH} className="disconnect-button">
              Disconnect
            </button>
            <button onClick={downloadLog} className="history-button">
              Download Log
            </button>
            <button onClick={clearTerminal} className="clear-history-button">
              Clear
            </button>
          </>
        ) : (
          <button 
            onClick={connectSSH} 
            disabled={!validateForm().valid || isConnecting}
            className="connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {/* Terminal Instance */}
      <div
        className="terminal-instance"
        ref={terminalRef}
        onClick={handleTerminalClick}
        style={{ cursor: 'text' }}
      />

    </div>
  );
};

 