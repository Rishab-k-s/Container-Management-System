import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import { ServiceSelectionPage } from './ServiceSelectionPage.jsx';
import { TerminalComponent } from './TerminalComponent.jsx';
import { VMTerminal } from './VMTerminal.jsx';
import { Login } from './Login.jsx';

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
        <Route path="/services" element={<ServiceSelectionPage onServiceSelect={handleServiceSelect}/>} />
        <Route path="/terminal" element={<TerminalComponent/>} />
        <Route path="/vmterminal" element={<VMTerminal/>} />
      </Routes>
    </div>
  );
};
