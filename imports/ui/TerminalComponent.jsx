import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { ActiveContainers } from './ActiveContainers';
import { ContainerTerminal } from './ContainerTerminal';

export const TerminalComponent = () => {
  const navigate = useNavigate();
  const [activeContainers, setActiveContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);

  // Fetch active containers on mount
  useEffect(() => {
    loadContainers();
    
    // Refresh containers every 5 seconds
    const interval = setInterval(loadContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadContainers = () => {
    Meteor.call('docker.listContainers', (err, containers) => {
      if (err) {
        console.error('Error loading containers:', err);
        return;
      }
      setActiveContainers(containers || []);
    });
  };

  const handleCreateContainer = () => {
    setCreateLoading(true);
    setError('');

    Meteor.call('docker.createContainer', (err, result) => {
      setCreateLoading(false);
      
      if (err) {
        setError(err.reason || 'Failed to create container');
        console.error('Error creating container:', err);
        return;
      }

      console.log('Container created:', result);
      loadContainers();
    });
  };

  const handleConnectToContainer = (container) => {
    setSelectedContainer(container);
  };

  const handleStopContainer = (containerId) => {
    if (!confirm('Are you sure you want to stop this container?')) {
      return;
    }

    Meteor.call('docker.stopContainer', containerId, (err) => {
      if (err) {
        console.error('Error stopping container:', err);
        alert('Failed to stop container: ' + err.reason);
        return;
      }
      
      loadContainers();
      if (selectedContainer?.id === containerId) {
        setSelectedContainer(null);
      }
    });
  };

  const handleStartContainer = (containerId) => {
    setCreateLoading(true);
    setError('');

    Meteor.call('docker.startContainer', containerId, (err) => {
      setCreateLoading(false);
      
      if (err) {
        setError(err.reason || 'Failed to start container');
        console.error('Error starting container:', err);
        return;
      }
      
      loadContainers();
    });
  };

  const handleRemoveContainer = (containerId) => {
    Meteor.call('docker.removeContainer', containerId, (err) => {
      if (err) {
        console.error('Error removing container:', err);
        alert('Failed to remove container: ' + err.reason);
        return;
      }
      
      loadContainers();
      if (selectedContainer?.id === containerId) {
        setSelectedContainer(null);
      }
    });
  };

  const handleCloseTerminal = () => {
    setSelectedContainer(null);
  };

  const handleImportDockerfile = () => {
    // Trigger file input click
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    if (file.name !== 'Dockerfile' && !file.name.startsWith('Dockerfile.')) {
      setError('Please select a valid Dockerfile');
      return;
    }

    setImportLoading(true);
    setError('');

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const dockerfileContent = e.target.result;

      // Call Meteor method to create container from Dockerfile
      Meteor.call('docker.createContainerFromDockerfile', dockerfileContent, null, (err, result) => {
        setImportLoading(false);
        
        if (err) {
          setError(err.reason || 'Failed to import Dockerfile and create container');
          console.error('Error importing Dockerfile:', err);
          return;
        }

        console.log('Container created from Dockerfile:', result);
        loadContainers();
        
        // Show success message
        alert(`✓ Container created successfully!\nName: ${result.containerName}\nSSH Port: ${result.sshPort}`);
      });
    };

    reader.onerror = () => {
      setImportLoading(false);
      setError('Failed to read Dockerfile');
    };

    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleLogout = () => {
    Meteor.logout(() => {
      sessionStorage.clear();
      navigate('/', { replace: true });
    });
  };

  return (
    <div className="terminal-page">
      {/* Header with Back Button */}
      <div className="page-header">
        <button className="back-to-services-btn" onClick={() => navigate('/services')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Services
        </button>
        <h1>Container Manager</h1>
        <button className="logout-btn" onClick={handleLogout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Logout
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#c33'
        }}>
          {error}
        </div>
      )}

      {/* Active Containers Panel */}
      <ActiveContainers
        containers={activeContainers}
        onCreateContainer={handleCreateContainer}
        onConnectToContainer={handleConnectToContainer}
        onStopContainer={handleStopContainer}
        onStartContainer={handleStartContainer}
        onRemoveContainer={handleRemoveContainer}
        onImportDockerfile={handleImportDockerfile}
        createLoading={createLoading}
        importLoading={importLoading}
      />

      {/* Hidden file input for Dockerfile upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Container Terminal Modal */}
      {selectedContainer && (
        <ContainerTerminal
          container={selectedContainer}
          onClose={handleCloseTerminal}
        />
      )}
    </div>
  );
};