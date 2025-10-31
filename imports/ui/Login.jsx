import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');  // Add this line
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');  // Clear success message on login
    setLoading(true);

    Meteor.loginWithPassword(email, password, (err) => {
      if (err) {
        setLoading(false);
        setError(err.reason || 'Login failed. Please try again.');
        return;
      }

      // Get user role after successful login
      Meteor.call('users.getRole', (error, userRole) => {
        setLoading(false);
        
        if (error) {
          console.warn('Could not retrieve user role:', error);
          // Continue anyway with default role
          sessionStorage.setItem('userRole', 'user');
        } else {
          // Store role in session
          console.log('User role:', userRole);
          sessionStorage.setItem('userRole', userRole);
        }
        
        // Redirect to service selection page
        navigate('/services');
      });
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Create user account with profile including role
      await new Promise((resolve, reject) => {
        Accounts.createUser(
          {
            email: email,
            password: password,
            profile: { role: role }
          },
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      // Log out the user immediately after registration
      Meteor.logout(() => {
        setLoading(false);
        setSuccess('Account created successfully! Please sign in with your credentials.');
        
        // Switch to login mode and clear form
        setIsRegister(false);
        setPassword('');
        setConfirmPassword('');
        // Keep email filled for convenience
      });

    } catch (err) {
      setLoading(false);
      setError(err.reason || err.message || 'Registration failed. Please try again.');
    }
  };

  const styles = {
    loginPage: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    },
    loginContainer: {
      width: '100%',
      maxWidth: '440px',
    },
    loginCard: {
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden',
    },
    loginHeader: {
      padding: '40px 40px 30px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
    },
    loginTitle: {
      margin: '0 0 8px',
      fontSize: '28px',
      fontWeight: '700',
      color: 'white',
    },
    loginSubtitle: {
      margin: '0',
      fontSize: '14px',
      opacity: '0.9',
    },
    loginForm: {
      padding: '40px',
    },
    formGroup: {
      marginBottom: '24px',
    },
    formLabel: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: '600',
      color: '#333',
    },
    formInput: {
      width: '100%',
      padding: '12px 16px',
      fontSize: '15px',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    },
    formInputDisabled: {
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed',
      opacity: '0.6',
    },
    formSelect: {
      width: '100%',
      padding: '12px 16px',
      fontSize: '15px',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      cursor: 'pointer',
      backgroundColor: 'white',
    },
    errorMessage: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: '#fee',
      border: '1px solid #fcc',
      borderRadius: '8px',
      color: '#c33',
      fontSize: '14px',
      marginBottom: '20px',
    },
    successMessage: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: '#d4edda',
      border: '1px solid #c3e6cb',
      borderRadius: '8px',
      color: '#155724',
      fontSize: '14px',
      marginBottom: '20px',
    },
    submitButton: {
      width: '100%',
      padding: '14px',
      fontSize: '16px',
      fontWeight: '600',
      color: 'white',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
    submitButtonDisabled: {
      opacity: '0.7',
      cursor: 'not-allowed',
    },
    loginFooter: {
      padding: '0 40px 40px',
      textAlign: 'center',
    },
    toggleText: {
      margin: '0',
      fontSize: '14px',
      color: '#666',
    },
    toggleButton: {
      background: 'none',
      border: 'none',
      color: '#667eea',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      marginLeft: '6px',
      padding: '0',
      textDecoration: 'none',
    },
    spinner: {
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  };

  return (
    <div style={styles.loginPage}>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          input:focus, select:focus {
            outline: none;
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
          }
          button:active:not(:disabled) {
            transform: translateY(0);
          }
        `}
      </style>
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginHeader}>
            <h2 style={styles.loginTitle}>Container Management System</h2>
            <p style={styles.loginSubtitle}>
              {isRegister ? 'Create Account' : 'Sign in to continue'}
            </p>
          </div>
          
          <form style={styles.loginForm} onSubmit={isRegister ? handleRegister : handleLogin}>
            <div style={styles.formGroup}>
              <label htmlFor="email" style={styles.formLabel}>Email Address</label>
              <input
                id="email"
                type="email"
                style={{
                  ...styles.formInput,
                  ...(loading && styles.formInputDisabled)
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="password" style={styles.formLabel}>Password</label>
              <input
                id="password"
                type="password"
                style={{
                  ...styles.formInput,
                  ...(loading && styles.formInputDisabled)
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {isRegister && (
              <>
                <div style={styles.formGroup}>
                  <label htmlFor="confirmPassword" style={styles.formLabel}>Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    style={{
                      ...styles.formInput,
                      ...(loading && styles.formInputDisabled)
                    }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    disabled={loading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label htmlFor="role" style={styles.formLabel}>Select Role</label>
                  <select
                    id="role"
                    style={{
                      ...styles.formSelect,
                      ...(loading && styles.formInputDisabled)
                    }}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <div style={styles.errorMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="currentColor"/>
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div style={styles.successMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {success}
              </div>
            )}

            <button 
              type="submit" 
              style={{
                ...styles.submitButton,
                ...(loading && styles.submitButtonDisabled)
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div style={styles.spinner}></div>
                  {isRegister ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div style={styles.loginFooter}>
            <p style={styles.toggleText}>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                style={styles.toggleButton}
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                  setSuccess('');
                  setEmail('');           // Clear email
                  setPassword('');        // Clear password
                  setConfirmPassword(''); // Clear confirm password
                  setRole('user');        // Reset role to default
                }}
                disabled={loading}
              >
                {isRegister ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
