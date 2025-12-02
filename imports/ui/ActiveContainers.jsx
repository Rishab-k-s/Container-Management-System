import React, { useState } from 'react';

export const ActiveContainers = ({ 
  containers, 
  onCreateContainer, 
  onConnectToContainer, 
  onStopContainer,
  onStartContainer,
  onRemoveContainer,
  loading 
}) => {
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'stopped'

  // Filter containers by status
  const activeContainers = containers.filter(c => c.status === 'running');
  const stoppedContainers = containers.filter(c => c.status === 'exited' || c.status === 'stopped');

  const displayContainers = activeTab === 'active' ? activeContainers : stoppedContainers;

  return (
    <div className="active-containers-panel normal">
      <div className="active-containers-content">
        {/* Header Section */}
        <div className="containers-header">
          <div className="header-title">
            {/* Tabs */}
            <div className="tab-container">
              <button 
                className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
                Active
                <span className="container-count">{activeContainers.length}</span>
              </button>
              
              <button 
                className={`tab-button ${activeTab === 'stopped' ? 'active' : ''}`}
                onClick={() => setActiveTab('stopped')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <rect x="8" y="8" width="8" height="8" fill="currentColor"/>
                </svg>
                Stopped
                <span className="container-count">{stoppedContainers.length}</span>
              </button>
            </div>
          </div>
          
          <button 
            className="create-container-btn"
            onClick={onCreateContainer}
            disabled={loading}
          >
            {loading ? (
              <>
                <span>Creating...</span>
                <div className="spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></div>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create Container
              </>
            )}
          </button>
        </div>

        {/* Containers Grid */}
        <div className="containers-grid">
          {displayContainers.length === 0 ? (
            <div className="no-containers">
              <div className="no-containers-icon">
                {activeTab === 'active' ? '📦' : '⏸️'}
              </div>
              <h4>
                {activeTab === 'active' 
                  ? 'No Active Containers' 
                  : 'No Stopped Containers'}
              </h4>
              <p>
                {activeTab === 'active'
                  ? 'Click "Create Container" to start a new SSH-enabled Debian container'
                  : 'Stopped containers will appear here. You can restart them anytime.'}
              </p>
            </div>
          ) : (
            displayContainers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onConnect={onConnectToContainer}
                onStop={onStopContainer}
                onStart={onStartContainer}
                onRemove={onRemoveContainer}
                isRunning={container.status === 'running'}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const ContainerCard = ({ container, onConnect, onStop, onStart, onRemove, isRunning }) => {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getShortId = (id) => {
    return id.substring(0, 12);
  };

  const handleToggle = () => {
    if (isRunning) {
      onStop(container.id);
    } else {
      onStart(container.id);
    }
  };

  const handleRemove = () => {
    if (confirm('⚠️ This will permanently delete the container. Are you sure?')) {
      onRemove(container.id);
    }
  };

  return (
    <div className="container-card">
      <div className="container-card-header">
        <div className="container-name">
          <div className="name-text">{container.name || 'Unnamed Container'}</div>
          <div className="container-id">{getShortId(container.id)}</div>
        </div>
        
        <div className="container-actions-top">
          {/* Toggle Button for Start/Stop */}
          <button 
            className={`toggle-btn ${isRunning ? 'running' : 'stopped'}`}
            onClick={handleToggle}
            title={isRunning ? 'Stop container' : 'Start container'}
          >
            {isRunning ? (
              // Stop icon (square)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" fill="currentColor" rx="2"/>
              </svg>
            ) : (
              // Play icon (triangle)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5v14l11-7z" fill="currentColor"/>
              </svg>
            )}
          </button>

          {/* Close Button for Permanent Delete */}
          <button 
            className="close-btn"
            onClick={handleRemove}
            title="Delete container permanently"
          >
            ×
          </button>
        </div>
      </div>

      <div className="container-info">
        <div className="info-row">
          <span className="info-label">Status</span>
          <span className="info-value">
            <span className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </span>
        </div>
        
        <div className="info-row">
          <span className="info-label">Image</span>
          <span className="info-value">{container.image || 'debian-ssh'}</span>
        </div>
        
        <div className="info-row">
          <span className="info-label">SSH Port</span>
          <span className="info-value">
            <span className="port-value">
              {isRunning ? (container.sshPort || 'N/A') : '—'}
            </span>
          </span>
        </div>
        
        <div className="info-row">
          <span className="info-label">Created</span>
          <span className="info-value">{formatDate(container.created)}</span>
        </div>
      </div>

      {/* Connect button - only show when running */}
      {isRunning && (
        <div className="container-actions">
          <button 
            className="action-btn connect-btn"
            onClick={() => onConnect(container)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 8L9 10L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Connect SSH
          </button>
        </div>
      )}
    </div>
  );
};