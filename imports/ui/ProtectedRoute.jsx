import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';

export const ProtectedRoute = ({ children }) => {
  const user = useTracker(() => Meteor.user(), []);
  const isLoggingIn = useTracker(() => Meteor.loggingIn(), []);
  const [countdown, setCountdown] = useState(3);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // If user is not authenticated and not logging in, start countdown
    if (!user && !isLoggingIn && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setShouldRedirect(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, isLoggingIn, countdown]);

  // Show loading while checking authentication status
  if (isLoggingIn) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#fff',
        backgroundColor: '#1a1a1a'
      }}>
        Loading...
      </div>
    );
  }

  // Show redirect message before redirecting
  if (!user && !isLoggingIn && !shouldRedirect) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          border: '1px solid #ff6b6b'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            🔒
          </div>
          <h2 style={{
            fontSize: '24px',
            marginBottom: '15px',
            color: '#ff6b6b'
          }}>
            Restricted Page
          </h2>
          <p style={{
            fontSize: '16px',
            marginBottom: '10px',
            color: '#ccc'
          }}>
            You cannot access this page without being logged in.
          </p>
          <p style={{
            fontSize: '14px',
            color: '#999',
            marginBottom: '25px'
          }}>
            Redirecting to login/signup in <span style={{
              color: '#ff6b6b',
              fontWeight: 'bold',
              fontSize: '18px'
            }}>{countdown}</span> second{countdown !== 1 ? 's' : ''}...
          </p>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#333',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#ff6b6b',
              width: `${((3 - countdown) / 3) * 100}%`,
              transition: 'width 1s linear'
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login page after countdown
  if (shouldRedirect) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the protected component
  return children;
};
