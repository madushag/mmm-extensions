const injectedTabs = new Set(); // Set to track injected tab IDs

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab is fully loaded and the URL matches
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://app.monarchmoney.com")) {
        // Check if the styles have already been injected for this tab
        if (!injectedTabs.has(tabId)) {
            chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['styles/styles.css']
            });
            injectedTabs.add(tabId); // Mark this tab as having injected styles
        }
    }
});

