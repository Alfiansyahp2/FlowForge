import React from 'react';

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f3f4f6'
    }}>
      <h1 style={{ fontSize: '48px', color: '#2563eb', marginBottom: '20px' }}>
        FlowForge
      </h1>
      <p style={{ fontSize: '18px', color: '#6b7280' }}>
        If you can see this, React is working! ✅
      </p>
      <button
        onClick={() => alert('Button works!')}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Click Me
      </button>
    </div>
  );
}

export default App;
