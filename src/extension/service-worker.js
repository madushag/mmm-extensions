import Analytics from '../google-analytics.js';

// Listen for the install event and fire an install event
chrome.runtime.onInstalled.addListener(() => { 
    Analytics.fireEvent('install'); 
});

// Listen for messages from content scripts to fire analytics events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'analyticsEventSuccess') {
        Analytics.fireEvent(request.eventName, request.params);
    }
    else if (request.type === 'analyticsEventError') {
        Analytics.fireErrorEvent(request.eventName, request.params);
    }
});


