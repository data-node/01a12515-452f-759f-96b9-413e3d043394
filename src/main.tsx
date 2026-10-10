import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Capture } from './Capture';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';

const captureWindow = new URLSearchParams(location.search).get('window') === 'capture';
document.body.classList.toggle('capture-window', captureWindow);
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{captureWindow ? <Capture standalone /> : <App />}</React.StrictMode>);
