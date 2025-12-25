
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// Removed StrictMode to prevent double-initialization issues with complex 
// canvas libraries like FortuneSheet/Luckysheet in development.
root.render(
    <App />
);
