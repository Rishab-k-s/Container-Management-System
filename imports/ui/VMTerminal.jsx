import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VMTerminalInstance } from './VMTerminalInstance';
import 'xterm/css/xterm.css';

/**
 * VMTerminal Component
 * 
 * Manages multiple terminal instances with a tabbed interface.
 * Features:
 * - Create multiple terminal tabs
 * - Switch between active terminals
 * - Close individual tabs (minimum 1 tab required)
 * - Navigate back to services
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onBack - Optional callback when navigating back
 */
export const VMTerminal = ({ onBack }) => {
  const navigate = useNavigate();
  
  // State management
  const [terminals, setTerminals] = useState([{ id: 1, title: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState(1);

  /**
   * Creates a new terminal tab
   * Uses timestamp as unique ID to avoid collisions
   */
  const createNewTerminalTab = useCallback(() => {
    const id = Date.now();
    const newTab = {
      id,
      title: `Terminal ${terminals.length + 1}`
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
  }, [terminals.length]);

  /**
   * Closes a terminal tab
   * Prevents closing the last tab and handles active tab switching
   * 
   * @param {number} id - ID of the tab to close
   */
  const closeTab = useCallback((id) => {
    // Prevent closing the last tab
    if (terminals.length <= 1) return;
    
    setTerminals(prev => prev.filter(tab => tab.id !== id));
    
    // If closing the active tab, switch to the last remaining tab
    if (activeTab === id) {
      const remainingTerminals = terminals.filter(tab => tab.id !== id);
      if (remainingTerminals.length > 0) {
        setActiveTab(remainingTerminals[remainingTerminals.length - 1].id);
      }
    }
  }, [terminals, activeTab]);

  /**
   * Handles navigation back to services
   */
  const handleBackToServices = useCallback(() => {
    if (onBack) {
      onBack();
    }
    navigate('/services');
  }, [navigate, onBack]);

  // Memoized styles for better performance
  const terminalContentStyle = useMemo(() => ({
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  }), []);

  return (
    <div className="vm-terminal-container">
      {/* Navigation Header */}
      <header className="back-to-services-header">
        <button 
          className="back-to-services-btn" 
          onClick={handleBackToServices}
          aria-label="Navigate back to services"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path 
              d="M19 12H5M12 19l-7-7 7-7" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          Back to Services
        </button>
      </header>

      {/* Terminal Tab Bar */}
      <nav className="tab-bar" role="tablist" aria-label="Terminal tabs">
        {terminals.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`terminal-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
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
                aria-label={`Close ${tab.title}`}
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
          aria-label="Add new terminal"
          title="Add new terminal"
        >
          +
        </button>
      </nav>

      {/* Terminal Content Area */}
      <main 
        className="terminal-content-area" 
        style={terminalContentStyle}
        role="region"
        aria-label="Terminal content"
      >
        {terminals.map(tab => (
          <VMTerminalInstance 
            key={tab.id} 
            id={`terminal-panel-${tab.id}`}
            isActive={activeTab === tab.id}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
          />
        ))}
      </main>
    </div>
  );
};

