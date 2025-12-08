import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

export const ServiceSelectionPage = ({ onServiceSelect }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    Meteor.logout(() => {
      navigate('/');
    });
  };

  return (
    <div className="service-selection-page">
      <button className="logout-btn service-page-logout" onClick={handleLogout}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Logout
      </button>
      <div className="service-selection-container">
        <div className="header-section">
          <h1 className="main-title">Choose a Service</h1>
          <p className="subtitle">Select the service you want to use</p>
        </div>
        
        <div className="services-grid">
          <div 
            className="service-card vm-card"
            onClick={() => onServiceSelect('vm')}
          >
            <div className="service-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="6" y="8" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="5" cy="6.5" r="0.5" fill="currentColor"/>
                <circle cx="7" cy="6.5" r="0.5" fill="currentColor"/>
                <circle cx="9" cy="6.5" r="0.5" fill="currentColor"/>
              </svg>
            </div>
            <div className="service-content">
              <h3 className="service-title">Virtual Machine (SSH Terminal)</h3>
              <p className="service-description">Access Linux containers via SSH</p>
            </div>
            <div className="service-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <div 
            className="service-card container-card"
            onClick={() => onServiceSelect('containers')}
          >
            <div className="service-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="service-content">
              <h3 className="service-title">Container Manager</h3>
              <p className="service-description">Manage databases and queries</p>
            </div>
            <div className="service-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



