import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333' }}>FlowForge Test</h1>
      <p style={{ color: '#666' }}>If you can see this, React is working!</p>
      <button onClick={() => alert('Button works!')}>
        Click Me
      </button>
    </div>
  );
}

export default App;
