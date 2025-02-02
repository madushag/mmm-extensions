/****************************** GANALYTICS EVENT LISTENERS ******************************/

// Listen for the CustomEvent from the injected script, for successful analytics events
document.addEventListener('SEND_TO_GANALYTICS_SUCCESS', (event) => {
    // Send a message to the background script for successful analytics event
    chrome.runtime.sendMessage({ 
        type: 'analyticsEventSuccess', 
        eventName: event.detail.eventName, 
        params: event.detail.params
    });
});

// Listen for the CustomEvent from the injected script, for failed analytics events
document.addEventListener('SEND_TO_GANALYTICS_ERROR', (event) => {
    // Send a message to the background script for failed analytics event
    chrome.runtime.sendMessage({ 
        type: 'analyticsEventError', 
        eventName: event.detail.eventName, 
        params: event.detail.params
    });
});

/****************************** PAGE STRUCTURE CHANGE LISTENER ******************************/

// Create a MutationObserver to watch for changes in the URL
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        // Check if the mutation target is not the head element. 
        // We do this to prevent the mutation observer from being triggered when we inject scripts into the page.
        if (mutation.target.nodeName !== 'HEAD') {
            onPageStructureChanged(); 
        }
    });
});

// Start observing the document for changes in the child nodes
observer.observe(document, { childList: true, subtree: true });

// Core logic to handle each page structure change
async function onPageStructureChanged() {
    // Check if the page is the transactions page or the accounts details page
    if (window.location.href.includes("transactions") || window.location.href.includes("accounts/details")) {
		injectRequiredScripts();
        handleTransactionsView(); // Handle the transactions view
    }

    // Add the custom settings link to the settings page
    if (window.location.href.includes("settings/")) {
		injectRequiredScripts();
        handleSettingsView(); // Handle the settings view
    }
}

/****************************** VIEW HANDLERS ******************************/

// Handle the settings view
function handleSettingsView() {
	// Check for Settings page elements every second
	const checkForSettingsPageElements = setInterval(() => {

		// Check if there is an div with class starting with "CardHeader__Title" with the text "Account"
		if (document.querySelector('div[class^="CardHeader__Title"]')?.textContent === 'Account') {
			clearInterval(checkForSettingsPageElements);

			if (isScriptInjected) {
				// Dispatch the execute event
				document.dispatchEvent(new CustomEvent('EXECUTE-CUSTOM-SETTINGS'));
			}
		}
	}, 1000);
}

// Handle the transactions view
function handleTransactionsView() {
    // Check for transaction rows every second
    const checkForTransactions = setInterval(() => {
        // Get all the transaction rows, determined by whether the row has an amount and a merchant
        const transactionRows = Array.from(document.querySelectorAll('div[class*="TransactionsListRow"]'))
            .filter((row) => {
                return (
                    row.querySelector('div[class*="TransactionOverview__Amount"]') &&
                    row.querySelector('div[class*="TransactionMerchantSelect"]')
                );
            });

        // If there are transactions, stop checking for them, and inject and execute the main handler
        if (transactionRows.length > 0) {
            clearInterval(checkForTransactions); 
			if (isScriptInjected) {
				// Dispatch the execute event
				document.dispatchEvent(new CustomEvent('EXECUTE')); 
			}
		}
    }, 1000);
}


// Flag to check if the script has been injected
let isScriptInjected = false;
// Inject the required scripts
function injectRequiredScripts() {
	const scriptCustomSettings = document.createElement('script');
    scriptCustomSettings.src = chrome.runtime.getURL('custom-settings.js');
	scriptCustomSettings.type = 'module';

    const scriptHelpersGraphql = document.createElement('script');
    scriptHelpersGraphql.src = chrome.runtime.getURL('helper-graphql.js');   
	scriptHelpersGraphql.type = 'module';

    const scriptTransactionViews = document.createElement('script');
    scriptTransactionViews.src = chrome.runtime.getURL('transaction-views.js');
	scriptTransactionViews.type = 'module';

    // Only inject the script once  
    if (!isScriptInjected) {
        document.head.appendChild(scriptCustomSettings);
        document.head.appendChild(scriptHelpersGraphql);
        document.head.appendChild(scriptTransactionViews);
        isScriptInjected = true; // Mark script as injected
    }
}
