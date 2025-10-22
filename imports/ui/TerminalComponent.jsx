import React, { useState } from 'react';

export const TerminalComponent = () => {
  const [lines, setLines] = useState(['Welcome to the terminal']);
  const [input, setInput] = useState('');

  const runCommand = () => {
    if (!input) return;
    setLines(prev => [...prev, `> ${input}`, `Executed: ${input}`]);
    setInput('');
  };

  return (
    <div>
      <h2>Terminal</h2>
      <div style={{background: '#111', color: '#0f0', padding: '10px', minHeight: '200px'}}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="type a command" />
        <button onClick={runCommand}>Run</button>
      </div>
    </div>
  );
};
