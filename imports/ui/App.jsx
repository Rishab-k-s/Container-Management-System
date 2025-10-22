import React from 'react';
import { Link, Routes, Route } from 'react-router-dom';

import { ServiceSelectionPage } from './ServiceSelectionPage.jsx';
import { TerminalComponent } from './TerminalComponent.jsx';
import { VMTerminal } from './VMTerminal.jsx';
import { Login } from './Login.jsx';


export const App = () => (
  <div>

    <Routes>
      <Route path="/" element={<Login/>} />
      <Route path="/services" element={<ServiceSelectionPage/>} />
      <Route path="/terminal" element={<TerminalComponent/>} />
      <Route path="/vmterminal" element={<VMTerminal/>} />
    </Routes>
  </div>
);


