import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { VMTerminalInstance } from './VMTerminalInstance';
import 'xterm/css/xterm.css';

export const VMTerminal = ({ onBack }) => {
  const navigate = useNavigate();
  
  const [terminals, setTerminals] = useState([{ id: 1, title: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState(1);

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

  const handleLogout = () => {
    Meteor.logout(() => {
      navigate('/');
    });
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
        <button className="logout-btn vm-page-logout" onClick={handleLogout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Logout
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

      {/* Terminal Instances */}
      <div className="terminal-content-area" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {terminals.map(tab => (
          <VMTerminalInstance 
            key={tab.id} 
            isActive={activeTab === tab.id} 
          />
        ))}
      </div>

    </div>
  );
};

