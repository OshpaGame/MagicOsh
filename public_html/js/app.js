/**
 * MagicOsh Web Application
 * Main Entry Point
 */

import './modules/store.js';
import './modules/messaging.js?v=4';
import './modules/giveaway.js';
import './modules/auth.js?v=3';

console.log('MagicOsh App Initialized');

// DOMContentLoaded listener for any global initializations
document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation interactions if any (e.g., mobile menu toggle)
    console.log('DOM Ready');
});
