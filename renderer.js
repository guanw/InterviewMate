import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App.js';

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));