import React, { useState, useEffect, useRef } from 'react';

export const CreateCustomContainerModal = ({ onClose, onCreate, loading }) => {
  const [dockerfile, setDockerfile] = useState(`FROM python:3.9-slim

# Install any additional packages you need
# RUN pip install numpy pandas

# Your application code
# COPY . /app
# WORKDIR /app
`);
  const [name, setName] = useState('');
  const [logs, setLogs] = useState([]);
  const logContainerRef = useRef(null);

  // Simulate build logs when loading starts
  useEffect(() => {
    if (loading) {
      setLogs(['> Initializing build process...']);
      
      const steps = [
        { msg: '> Preparing build context...', delay: 800 },
        { msg: '> Injecting SSH configuration...', delay: 1500 },
        { msg: '> Sending build context to Docker daemon...', delay: 2500 },
        { msg: '> Step 1/5 : FROM base_image', delay: 3500 },
        { msg: '> Step 2/5 : COPY setup_ssh.sh', delay: 4500 },
        { msg: '> Step 3/5 : RUN chmod +x /setup_ssh.sh', delay: 5500 },
        { msg: '> Step 4/5 : EXPOSE 22', delay: 6500 },
        { msg: '> Step 5/5 : ENTRYPOINT ["/entrypoint.sh"]', delay: 7500 },
        { msg: '> Successfully built image', delay: 9000 },
        { msg: '> Creating container...', delay: 10000 },
        { msg: '> Starting container...', delay: 11000 },
        { msg: '> Waiting for SSH to be ready...', delay: 12000 },
      ];

      const timeouts = steps.map(step => 
        setTimeout(() => {
          setLogs(prev => [...prev, step.msg]);
          if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
          }
        }, step.delay)
      );

      return () => timeouts.forEach(clearTimeout);
    } else {
      setLogs([]);
    }
  }, [loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(dockerfile, name);
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content custom-container-modal building">
          <div className="build-status">
            <div className="spinner-large"></div>
            <h3>Building & Creating Container</h3>
            <p>Please wait while we build your custom image...</p>
          </div>
          
          <div className="build-logs" ref={logContainerRef}>
            {logs.map((log, i) => (
              <div key={i} className="log-line">{log}</div>
            ))}
            <div className="log-line blink">_</div>
          </div>
        </div>
        <style>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
          }
          .modal-content.custom-container-modal.building {
            width: 500px;
            text-align: center;
            background: #1e1e1e;
            border: 1px solid #333;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .build-status {
            padding: 30px;
            border-bottom: 1px solid #333;
          }
          .spinner-large {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(52, 152, 219, 0.3);
            border-top-color: #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          .build-logs {
            background: #000;
            padding: 15px;
            height: 200px;
            overflow-y: auto;
            text-align: left;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            color: #ccc;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
          }
          .log-line {
            margin-bottom: 4px;
            word-break: break-all;
          }
          .blink {
            animation: blink 1s step-end infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes blink { 50% { opacity: 0; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content custom-container-modal">
        <div className="modal-header">
          <h3>Create Custom Container</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Container Name (Optional)</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., python-dev"
            />
          </div>

          <div className="form-group">
            <label>Dockerfile Content</label>
            <div className="info-text">
              SSH setup will be automatically injected into your image.
            </div>
            <textarea 
              value={dockerfile} 
              onChange={(e) => setDockerfile(e.target.value)}
              rows={15}
              className="dockerfile-editor"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="create-btn" disabled={loading}>
              {loading ? 'Building & Creating...' : 'Create Container'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content.custom-container-modal {
          background: #1e1e1e;
          padding: 20px;
          border-radius: 8px;
          width: 600px;
          max-width: 90vw;
          color: #fff;
          border: 1px solid #333;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .info-text {
          font-size: 0.85em;
          color: #aaa;
          margin-bottom: 5px;
        }
        .dockerfile-editor {
          width: 100%;
          background: #111;
          color: #0f0;
          font-family: monospace;
          border: 1px solid #333;
          padding: 10px;
          border-radius: 4px;
          resize: vertical;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
        .cancel-btn {
          background: transparent;
          border: 1px solid #555;
          color: #fff;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .create-btn {
          background: #2ecc71;
          border: none;
          color: #fff;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .create-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
