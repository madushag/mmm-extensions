/******************************************************************************************/
/* This file is the service worker for the browser extension.
/* It handles:
/* - OAuth authentication flow with Splitwise
/* - Token management and caching
/* - Expense creation in Splitwise
/* - Google Analytics event tracking
/* - Message passing between content scripts and background processes
/******************************************************************************************/

import Analytics from '../helpers/helper-google-analytics.js';
import { AnalyticsMessageType } from '../helpers/helper-google-analytics.js';
import {
	getSplitwiseTokenUsingAPI,
	getCurrentUserUsingAPI,
	getSplitwiseFriendsUsingAPI,
	postToSplitwiseUsingAPI,
	getSplitwiseGroupsUsingAPI,
	deleteSplitwiseExpenseUsingAPI
} from '../helpers/splitwise/helper-splitwise-endpoints.js';
import { SplitwiseMessageType } from '../helpers/splitwise/helper-splitwise.js';


// Check if the extension is running in development mode
const isDev = chrome.runtime.getManifest().name.includes('DEV');

// Listen for the install event and fire an install event
chrome.runtime.onInstalled.addListener(() => {
	// prevent firing this event if running locally
	if (!isDev) {
		Analytics.fireEvent('install');
	}
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

	//***** GOOGLE ANALYTICS EVENTS *****
	if (request.type === AnalyticsMessageType.SEND_TO_GANALYTICS_SUCCESS) {
		// prevent firing this event if running in dev mode
		if (!isDev) {
			Analytics.fireEvent(request.eventName, request.params);
		}
	}
	else if (request.type === AnalyticsMessageType.SEND_TO_GANALYTICS_ERROR) {
		// prevent firing this event if running dev mode
		if (!isDev) {
			Analytics.fireErrorEvent(request.eventName, request.params);
		}
	}

	//***** SPLITWISE EVENTS *****
	else if (request.type === SplitwiseMessageType.GET_SPLITWISE_TOKEN) {
		getSplitwiseTokenUsingAPI()
			.then(token => {
				sendResponse({ success: true, token });
			})
			.catch(error => {
				console.error('Error getting Splitwise token:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
	else if (request.type === SplitwiseMessageType.GET_CURRENT_USER) {
		getCurrentUserUsingAPI()
			.then(userId => {
				sendResponse({ success: true, userId });
			})
			.catch(error => {
				console.error('Error getting current user:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
	else if (request.type === SplitwiseMessageType.GET_SPLITWISE_FRIENDS) {
		getSplitwiseFriendsUsingAPI()
			.then(friends => {
				sendResponse({ success: true, friends });
			})
			.catch(error => {
				console.error('Error getting Splitwise friends:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
	else if (request.type === SplitwiseMessageType.POST_TO_SPLITWISE) {
		postToSplitwiseUsingAPI(request.expenseDetails, request.myUserId, request.debUserId)
			.then(response => {
				sendResponse({ success: true, data: response });
			})
			.catch(error => {
				console.error('Error posting to Splitwise:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
	else if (request.type === SplitwiseMessageType.GET_SPLITWISE_GROUPS) {
		getSplitwiseGroupsUsingAPI()
			.then(groups => {
				sendResponse({ success: true, groups });
			})
			.catch(error => {
				console.error('Error getting Splitwise groups:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
	else if (request.type === SplitwiseMessageType.DELETE_SPLITWISE_EXPENSE) {
		deleteSplitwiseExpenseUsingAPI(request.data.transactionId)
			.then(response => {
				sendResponse({ success: true, response });
			})
			.catch(error => {
				console.error('Error in delete expense handler:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Will respond asynchronously
	}
});






