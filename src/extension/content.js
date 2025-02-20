/******************************************************************************************/
/* This file is the main orchestrator of the extension.
/* It listens for page structure changes and injects the required scripts.
/* It also listens for messages from the helper scripts and injects them when needed.

/** THIS FILES CANNOT HAVE ANY MODULE.JS SYNTAX **/

/******************************************************************************************/

const SplitwiseMessageType = Object.freeze({
	POST_TO_SPLITWISE: 'POST_TO_SPLITWISE',
	SPLITWISE_EXPENSE_RESPONSE: 'SPLITWISE_EXPENSE_RESPONSE',
	GET_SPLITWISE_TOKEN: 'GET_SPLITWISE_TOKEN',
	SPLITWISE_TOKEN_RESPONSE: 'SPLITWISE_TOKEN_RESPONSE',
	GET_SPLITWISE_FRIENDS: 'GET_SPLITWISE_FRIENDS',
	SPLITWISE_FRIENDS_RESPONSE: 'SPLITWISE_FRIENDS_RESPONSE',
	GET_CURRENT_USER: 'GET_CURRENT_USER',
	CURRENT_USER_RESPONSE: 'CURRENT_USER_RESPONSE',
	GET_SPLITWISE_GROUPS: 'GET_SPLITWISE_GROUPS',
	SPLITWISE_GROUPS_RESPONSE: 'SPLITWISE_GROUPS_RESPONSE',
	DELETE_SPLITWISE_EXPENSE: 'DELETE_SPLITWISE_EXPENSE',
	SPLITWISE_DELETE_RESPONSE: 'SPLITWISE_DELETE_RESPONSE'
});

const AnalyticsMessageType = Object.freeze({
	SEND_TO_GANALYTICS_SUCCESS: 'SEND_TO_GANALYTICS_SUCCESS',
	SEND_TO_GANALYTICS_ERROR: 'SEND_TO_GANALYTICS_ERROR'
});

// Flag to check if the accounts view has been handled
let checkForNetWorthControlsButton = null;
let storedDateRange = null;
let previousUrl = window.location.href.split('?')[0]; // Initialize previous URL, remove query parameters
let areScriptsInjected = false;

/****************************** GANALYTICS EVENT LISTENERS ******************************/

// Listen for the CustomEvent from the injected script, for successful analytics events
document.addEventListener(AnalyticsMessageType.SEND_TO_GANALYTICS_SUCCESS, (event) => {
	// Send a message to the service worker script for successful analytics event
	chrome.runtime.sendMessage({
		type: AnalyticsMessageType.SEND_TO_GANALYTICS_SUCCESS,
		eventName: event.detail.eventName,
		params: event.detail.params
	});
});

// Listen for the CustomEvent from the injected script, for failed analytics events
document.addEventListener(AnalyticsMessageType.SEND_TO_GANALYTICS_ERROR, (event) => {
	// Send a message to the service worker script for failed analytics event
	chrome.runtime.sendMessage({
		type: AnalyticsMessageType.SEND_TO_GANALYTICS_ERROR,
		eventName: event.detail.eventName,
		params: event.detail.params
	});
});

/****************************** LISTENERS FOR PAGE TRIGGERED EVENTS ******************************/

// Listen for messages from page scripts
window.addEventListener('message', function (event) {
	// Only accept messages from our extension
	if (event.data.source !== 'MMM_EXTENSION') return;

	// Forward Splitwise-related messages to the service worker
	if (event.data.type === SplitwiseMessageType.GET_CURRENT_USER) {
		chrome.runtime.sendMessage({
			type: SplitwiseMessageType.GET_CURRENT_USER
		}, response => {
			window.postMessage({
				type: SplitwiseMessageType.CURRENT_USER_RESPONSE,
				messageId: event.data.messageId,
				userId: response.userId,
				error: response.error,
				source: 'MMM_EXTENSION'
			}, '*');
		});
	}
	else if (event.data.type === SplitwiseMessageType.GET_SPLITWISE_GROUPS) {
		chrome.runtime.sendMessage({
			type: SplitwiseMessageType.GET_SPLITWISE_GROUPS
		}, response => {
			window.postMessage({
				type: SplitwiseMessageType.SPLITWISE_GROUPS_RESPONSE,
				messageId: event.data.messageId,
				groups: response.groups,
				error: response.error,
				source: 'MMM_EXTENSION'
			}, '*');
		});
	}
	else if (event.data.type === SplitwiseMessageType.GET_SPLITWISE_FRIENDS) {
		chrome.runtime.sendMessage({
			type: SplitwiseMessageType.GET_SPLITWISE_FRIENDS
		}, response => {
			window.postMessage({
				type: SplitwiseMessageType.SPLITWISE_FRIENDS_RESPONSE,
				messageId: event.data.messageId,
				friends: response.friends,
				error: response.error,
				source: 'MMM_EXTENSION'
			}, '*');
		});
	}

	if (event.data.type === SplitwiseMessageType.POST_TO_SPLITWISE) {
		chrome.runtime.sendMessage({
			type: SplitwiseMessageType.POST_TO_SPLITWISE,
			...event.data.data
		}, response => {
			window.postMessage({
				type: SplitwiseMessageType.SPLITWISE_EXPENSE_RESPONSE,
				messageId: event.data.messageId,
				response: response.data,
				error: response.error,
				source: 'MMM_EXTENSION'
			}, '*');
		});
	}

	if (event.data.type === SplitwiseMessageType.DELETE_SPLITWISE_EXPENSE) {
		chrome.runtime.sendMessage({
			type: SplitwiseMessageType.DELETE_SPLITWISE_EXPENSE,
			data: event.data.data
		}, response => {
			window.postMessage({
				type: SplitwiseMessageType.SPLITWISE_DELETE_RESPONSE,
				messageId: event.data.messageId,
				response: response.data,
				error: response.error,
				source: 'MMM_EXTENSION'
			}, '*');
		});
	}
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
				onPageStructureChanged(true);
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
	let urlParts = new URL(window.location.href).pathname.split('/');

	// Check if the page is the transactions page or the accounts details page
	if (urlParts[1] === "transactions"
		|| (urlParts[1] === "accounts" && urlParts[2] === "details")
		|| (urlParts[1] === "categories" && !isNaN(urlParts[2]))) {
		injectRequiredScripts();
		handleTransactionsView(); // Handle the transactions view
	}

	// Add the custom settings link to the settings page
	if (urlParts[1] === "settings") {
		injectRequiredScripts();
		handleSettingsView(); // Handle the settings view
	}

	// Handle the accounts view, but do it only once per page load
	// Check if the part of the URL that determines the page is /accounts, after removing the query parameters
	// (e.g., https://app.monarchmoney.com/accounts?chartType=performance&dateRange=YTD&timeframe=month)
	if (urlParts[1] === "accounts") {
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
				// Dispatch the execute event in transaction-views.ts
				document.dispatchEvent(new CustomEvent('EXECUTE-TRANSACTIONS-VIEW'));
			}
		}

	}, 1000);
}

// Handle the Accounts view
function handleAccountsView() {
	if (!checkForNetWorthControlsButton) {
		// Check if the interval is not already set
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

/******************************************************************************************/
// Inject the required scripts
function injectRequiredScripts() {
	if (!areScriptsInjected) {
		const scripts = [
			{ src: 'views/settings-view.js', type: 'module' },
			{ src: 'views/transaction-views.js', type: 'module' },
			{ src: 'views/accounts-view.js', type: 'module' },
			{ src: 'helpers/helper-graphql.js', type: 'module' },
			{ src: 'helpers/helper-google-analytics.js', type: 'module' },
			{ src: 'toast.js', type: 'module' },
			{ src: 'helpers/helper-splitwise.js', type: 'module' }
		];

		scripts.forEach(script => {
			const scriptElement = document.createElement('script');
			scriptElement.src = chrome.runtime.getURL(script.src);
			scriptElement.type = script.type;
			document.head.appendChild(scriptElement);
		});

		areScriptsInjected = true;
	}
}
