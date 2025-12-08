import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import { ServiceSelectionPage } from './ServiceSelectionPage.jsx';
import { TerminalComponent } from './TerminalComponent.jsx';
import { VMTerminal } from './VMTerminal.jsx';
import { Login } from './Login.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';

export const App = () => {
  const navigate = useNavigate();
  
  const handleServiceSelect = (service) => {
    if (service === 'vm') {
      navigate('/vmterminal');
    } else if (service === 'containers') {
      navigate('/terminal');
    }
  };

  return (
    <div>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route 
          path="/services" 
          element={
            <ProtectedRoute>
              <ServiceSelectionPage onServiceSelect={handleServiceSelect}/>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/terminal" 
          element={
            <ProtectedRoute>
              <TerminalComponent/>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/vmterminal" 
          element={
            <ProtectedRoute>
              <VMTerminal/>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </div>
  );
};
