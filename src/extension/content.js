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

const MutationObserverMessageType = Object.freeze({
	PAUSE_OBSERVER: 'PAUSE_OBSERVER',
	RESUME_OBSERVER: 'RESUME_OBSERVER'
});

// Class to handle the mutation observer and related functions
class MutationObserverHandler {
	constructor() {

		this.observeElementParentElement = null;
		this.previousUrl = window.location.href.split('?')[0];

		this.transactionObserver = new MutationObserver(
			this.debounce((mutations) => {
				console.log('mutation observer triggered');
				if (window.location.href.split('?')[0] !== previousUrl) {
					previousUrl = window.location.href.split('?')[0];
					onPageStructureChanged(true);
				} else {
					onPageStructureChanged(false);
				}
			}, 500)
		);

		this.urlObserver = new MutationObserver(
			this.debounce((mutations) => {
				// If the URL has changed, reinitialize the transactions observation
				if (window.location.href.split('?')[0] !== previousUrl) {
					console.log('url changed');
					previousUrl = window.location.href.split('?')[0];
					monarchObserverHandler.initializeTransactionsObservation();
				}
			}, 500)
		);
	}

	// Debounce a function (used to debounce the mutation observer)
	debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	initializeUrlObserver() {
		this.urlObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: false,
			characterData: false
		});
	}

	// Initialize the observation of the page elements
	initializeTransactionsObservation() {
		this.observerHandler(true);
	}

	// Observe the element
	observeElement(observeElement) {
		if (observeElement) {
			this.transactionObserver.observe(observeElement, {
				childList: true,
				subtree: true,
				attributes: false,
				characterData: false
			});
		}
	}

	// Disable the mutation observer
	disable() {
		// console.log('disabling mutation observer');
		this.transactionObserver.disconnect();
	}

	// Enable the mutation observer
	enable() {
		// console.log('enabling mutation observer');
		this.observerHandler(false);
	}

	observerHandler(runFirstTime = false) {
		let urlParts = new URL(window.location.href).pathname.split('/');
		if (urlParts[1] === "accounts" && urlParts[2] === "details") {
			const checkForParentElement = setInterval(() => {
				// Check if the page is the accounts details page
				this.observeElementParentElement = document.querySelector('div[class^="Grid__GridItem"][class*="AccountDetails__StyleGridItem"]');
				if (this.observeElementParentElement) {
					clearInterval(checkForParentElement);

					const checkForElement = setInterval(() => {
						const observeElement = this.observeElementParentElement.querySelector('div[class^="Flex-sc"][class*="TransactionsList__ListContainer"]');
						if (observeElement) {
							clearInterval(checkForElement);
							this.disable();
							if (runFirstTime) {
								onPageStructureChanged(true);
							}
							this.observeElement(observeElement);
						}
					}, 250);
				}
			}, 250);
		}
		else if (urlParts[1] === "transactions") {
			const checkForElement = setInterval(() => {
				const observeElement = document.querySelector('div[class^="Flex-sc"][class*="TransactionsList__ListContainer"]');
				if (observeElement) {
					clearInterval(checkForElement);
					this.disable();
					if (runFirstTime) {
						onPageStructureChanged(true);
					}
					this.observeElement(observeElement);
				}
			}, 250);
			console.log('set interval for transactions', checkForElement);
		}
		else if (urlParts[1] === "categories" && !isNaN(urlParts[2])) {
			const checkForElement = setInterval(() => {
				const observeElement = document.querySelector('div[class^="Flex-sc"][class*="TransactionsList__ListContainer"]');
				if (observeElement) {
					clearInterval(checkForElement);
					this.disable();
					if (runFirstTime) {
						onPageStructureChanged(true);
					}
					this.observeElement(observeElement);
				}
			}, 250);
		}
		else if (urlParts[1] === "settings") {
			onPageStructureChanged(false);
		}
	}
}


// Flag to check if the accounts view has been handled
let checkForNetWorthControlsButton = null;
let storedDateRange = null;
let previousUrl = window.location.href.split('?')[0]; // Initialize previous URL, remove query parameters
let areScriptsInjected = false;

// Initialize the observer handler
const monarchObserverHandler = new MutationObserverHandler();
monarchObserverHandler.initializeTransactionsObservation();
monarchObserverHandler.initializeUrlObserver();



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

	// Listen for observer control messages from page scripts
	if (event.data.type === MutationObserverMessageType.PAUSE_OBSERVER) {
		monarchObserverHandler.disable();
	}
	else if (event.data.type === MutationObserverMessageType.RESUME_OBSERVER) {
		monarchObserverHandler.enable();
	}
	// Forward Splitwise-related messages to the service worker
	else if (event.data.type === SplitwiseMessageType.GET_CURRENT_USER) {
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
		// if there is no urlParts[2] element, then in main accounts page
		if (!urlParts[2]) {
			// store the dateRange parameter from the URL
			storedDateRange = (new URL(window.location.href)).searchParams.get("dateRange");
			injectRequiredScripts();
			handleAccountsView();
		}
		// if there is a urlParts[2] element, handle the transactions view
		else if (urlParts[2] === "details") {
			injectRequiredScripts();
			handleAccountsDetailsView();
			handleTransactionsView();
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

				// Pause the mutation observer before modifying the DOM
				monarchObserverHandler.disable();

				// Dispatch the execute event in transaction-views.ts
				document.dispatchEvent(new CustomEvent('EXECUTE-TRANSACTIONS-VIEW'));
			}
		}

	}, 500);
}

// Handle the Accounts view
function handleAccountsView() {
	// Check if the interval is not already set
	checkForNetWorthControlsButton = setInterval(() => {
		const netWorthControlsButton = document.querySelector('button[class*="NetWorthChartControls__TimeFrameOptionButton"]');
		if (netWorthControlsButton) {
			clearInterval(checkForNetWorthControlsButton);
			checkForNetWorthControlsButton = null;
			if (areScriptsInjected) {
				document.dispatchEvent(new CustomEvent('EXECUTE-ACCOUNTS-VIEW'));
			}
		}
	}, 1000);
}

// Handle the Accounts view
function handleAccountsDetailsView() {
	// Check if the interval is not already set
	checkForAccountBalanceGraphHeader = setInterval(() => {
		const accountBalanceGraphHeader = document.querySelector('div[class^="Flex-sc"][class*="AccountBalanceGraph__Header-sc"]');
		if (accountBalanceGraphHeader) {
			clearInterval(checkForAccountBalanceGraphHeader);
			checkForAccountBalanceGraphHeader = null;
			if (areScriptsInjected) {
				document.dispatchEvent(new CustomEvent('EXECUTE-ACCOUNTS-DETAILS-VIEW'));
			}
		}
	}, 1000);
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
			{ src: 'helpers/splitwise/helper-splitwise.js', type: 'module' }
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
