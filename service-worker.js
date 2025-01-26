import Analytics from './scripts/google-analytics.js';

addEventListener('unhandledrejection', async (event) => { 
    Analytics.fireErrorEvent(event.reason); 
});

chrome.runtime.onInstalled.addListener(() => { 
    Analytics.fireEvent('install'); 
});


// Listen for messages from content scripts to fire analytics events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'analyticsEvent') {
        Analytics.fireEvent(request.eventName, request.params);
        sendResponse({ status: 'success' });
    }
});


