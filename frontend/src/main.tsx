import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { detectBrowserBridge } from './lib/browser-bridge';
import './styles.css';
import './styles/canvas-polish.css';
import './styles/prompt-first.css';
import './styles/material-themes.css';

void detectBrowserBridge().then((bridge) => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App bridge={bridge}/>
    </MotionConfig>
  </React.StrictMode>,
));

import './styles/canvas-modes.css';
