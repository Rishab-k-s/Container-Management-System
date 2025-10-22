import React, { useState } from 'react';

export const VMTerminal = () => {
  const [logs, setLogs] = useState(['VM Console started']);
  const [cmd, setCmd] = useState('');

  const submit = () => {
    if (!cmd) return;
    setLogs(prev => [...prev, `VM> ${cmd}`, `Response: OK`]);
    setCmd('');
  };

  return (
    <div>
      <h2>VM Terminal</h2>
      <div style={{border: '1px solid #ccc', padding: 8, minHeight: 150}}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{marginTop: 8}}>
        <input value={cmd} onChange={e => setCmd(e.target.value)} placeholder="vm command" />
        <button onClick={submit}>Send</button>
      </div>
    </div>
  );
};
