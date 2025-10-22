import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

console.log('[ENV]', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  HAS_ANON: !!process.env.SUPABASE_ANON_KEY,
  HAS_SERVICE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
