import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { ActiveContainers } from './ActiveContainers';
import { ContainerTerminal } from './ContainerTerminal';

export const TerminalComponent = () => {
  const navigate = useNavigate();
  const [activeContainers, setActiveContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);
    setError('');

    Meteor.call('docker.createContainer', (err, result) => {
      setLoading(false);
      
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
    setLoading(true);
    setError('');

    Meteor.call('docker.startContainer', containerId, (err) => {
      setLoading(false);
      
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
        loading={loading}
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