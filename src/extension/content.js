// Flag to check if the accounts view has been handled
let checkForNetWorthControlsButton = null;
let storedDateRange = null;
let previousUrl = window.location.href.split('?')[0]; // Initialize previous URL, remove query parameters
let areScriptsInjected = false;


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
            // Check if the URL has changed
            if (window.location.href.split('?')[0] !== previousUrl) {
                previousUrl = window.location.href.split('?')[0]; // Update the previous URL, remove query parameters
                onPageStructureChanged(true); // Call your function to handle the change
            }
			else {
				onPageStructureChanged(false);
			}
        }
    });
});


// Start observing the document for changes in the child nodes
observer.observe(document, { childList: true, subtree: true });

// Core logic to handle each page structure change
async function onPageStructureChanged(urlHasChanged = false) {
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

	// Handle the accounts view, but do it only once per page load
	// Check if the part of the URL that determines the page is /accounts, after removing the query parameters
	// (e.g., https://app.monarchmoney.com/accounts?chartType=performance&dateRange=YTD&timeframe=month)
	if (new URL(window.location.href).pathname.split('/')[1] === "accounts") {

		// store the dateRange parameter from the URL
		storedDateRange = (new URL(window.location.href)).searchParams.get("dateRange");

		if (urlHasChanged) {
			injectRequiredScripts();
			handleAccountsView(); // Handle the accounts view
		}
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

			if (areScriptsInjected) {
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
			if (areScriptsInjected) {
				// Dispatch the execute event
				document.dispatchEvent(new CustomEvent('EXECUTE-TRANSACTIONS-VIEW')); 
			}
		}
    }, 1000);
}

// Handle the Accounts view
function handleAccountsView() {
	if (!checkForNetWorthControlsButton) { // Check if the interval is not already set
		checkForNetWorthControlsButton = setInterval(() => {	
			const netWorthControlsButton = document.querySelector('button[class*="NetWorthChartControls__TimeFrameOptionButton"]');
			if (netWorthControlsButton) {
				clearInterval(checkForNetWorthControlsButton);	
				checkForNetWorthControlsButton = null;
				if (areScriptsInjected) {
					console.log("dispatching execute accounts view");
					document.dispatchEvent(new CustomEvent('EXECUTE-ACCOUNTS-VIEW')); 
				}
			}
		}, 1000);
	}
}


// Inject the required scripts
function injectRequiredScripts() {
	// Only inject the script once
	if (!areScriptsInjected) {
		const scriptSettingsView = document.createElement('script');
		scriptSettingsView.src = chrome.runtime.getURL('views/settings-view.js');
		scriptSettingsView.type = 'module';

		const scriptTransactionViews = document.createElement('script');
		scriptTransactionViews.src = chrome.runtime.getURL('views/transaction-views.js');
		scriptTransactionViews.type = 'module';

		const scriptAccountsView = document.createElement('script');
		scriptAccountsView.src = chrome.runtime.getURL('views/accounts-view.js');
		scriptAccountsView.type = 'module';

		const scriptHelpersGraphql = document.createElement('script');
		scriptHelpersGraphql.src = chrome.runtime.getURL('helpers/helper-graphql.js');   
		scriptHelpersGraphql.type = 'module';

		const scriptToast = document.createElement('script');
		scriptToast.src = chrome.runtime.getURL('toast.js');
		scriptToast.type = 'module';

		document.head.appendChild(scriptSettingsView);
		document.head.appendChild(scriptTransactionViews);
		document.head.appendChild(scriptAccountsView);
		document.head.appendChild(scriptHelpersGraphql);
		document.head.appendChild(scriptToast);
		areScriptsInjected = true; // Mark script as injected
	}
}
