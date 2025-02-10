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
import { SplitwiseMessageType } from '../helpers/helper-splitwise.js';
import { AnalyticsMessageType } from '../helpers/helper-google-analytics.js';

// Check if the extension is running in development mode
const isDev = chrome.runtime.getManifest().name.includes('DEV');

// Splitwise OAuth configuration
const SPLITWISE_CONFIG = {
	client_id: '2ZaThr0W2roRjKEXVdRU8jPyaXkpnlnosvYSoXM9', // Get this from Splitwise Developer Portal
	redirect_uri: chrome.identity.getRedirectURL('oauth2'),
	auth_url: 'https://secure.splitwise.com/oauth/authorize',
	token_url: 'https://secure.splitwise.com/oauth/token',
	authorize_url: 'https://secure.splitwise.com/oauth/authorize',
	scope: ''
};

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
	else if (request.type === SplitwiseMessageType.GET_CURRENT_USER) {
		getCurrentUser()
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
		getSplitwiseFriends()
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
		postToSplitwise(request.expenseDetails, request.myUserId, request.debUserId)
			.then(response => {
				sendResponse({ success: true, data: response });
			})
			.catch(error => {
				console.error('Error posting to Splitwise:', error);
				sendResponse({ success: false, error: error.message });
			});
		return true; // Required for async response
	}
});


// Post a transaction to Splitwise
async function postToSplitwise(expenseDetails, myUserId, debUserId) {
	let groupId = 0;
	let description = `${expenseDetails.merchant.name} charged not on Savor card`;
	const expenseAmount = expenseDetails.amount * -1;

	// round to 2 decimal places
	let myOwedShare = Math.round(expenseAmount / 2 * 100) / 100;
	let debOwedShare = Math.round(expenseAmount / 2 * 100) / 100;

	// if the sum of myOwedShare and debOwedShare is not equal to expenseAmount, then subtract the difference from myOwedShare
	if (myOwedShare + debOwedShare !== expenseAmount) {
		myOwedShare = myOwedShare - (myOwedShare + debOwedShare - expenseAmount);
	}

	if (expenseDetails.category.name === "Gas Bill" || expenseDetails.category.name === "Electric Bill") {
		const monthName = new Date(expenseDetails.date).toLocaleString('default', { month: 'long' });
		const year = expenseDetails.date.split("-")[0];
		groupId = 1708251; // HomeRevereSWGroupId
		description = `${expenseDetails.category.name === "Gas Bill" ? "Gas" : "Electric"} - ${year} ${monthName}`;
	}

	// Create the expense data object
	const expenseData = {
		cost: expenseAmount.toString(),
		description,
		details: `Category: ${expenseDetails.category.name}${expenseDetails.notes ? `, Notes: ${expenseDetails.notes}` : ''}`,
		date: expenseDetails.date,
		group_id: groupId,
		users__0__user_id: myUserId,
		users__0__paid_share: expenseAmount.toString(),
		users__0__owed_share: myOwedShare.toString(),
		users__1__user_id: debUserId,
		users__1__paid_share: "0",
		users__1__owed_share: debOwedShare.toString()
	};

	const token = await getSplitwiseToken();
	const response = await fetch("https://secure.splitwise.com/api/v3.0/create_expense", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(expenseData)
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json();
}


// Get the Splitwise token
async function getSplitwiseToken() {
	// Check if we have a cached token
	const cached = await chrome.storage.local.get(['splitwise_token', 'splitwise_token_expiry']);
	if (cached.splitwise_token && cached.splitwise_token_expiry) {
		if (Date.now() < cached.splitwise_token_expiry - 300000) {
			console.log('Using cached token');
			return cached.splitwise_token;
		}
	}

	// Start OAuth flow
	const redirectUri = SPLITWISE_CONFIG.redirect_uri;
	const authUrl = `${SPLITWISE_CONFIG.auth_url}?client_id=${SPLITWISE_CONFIG.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(SPLITWISE_CONFIG.scope)}`;

	try {
		const redirectUrl = await chrome.identity.launchWebAuthFlow({
			url: authUrl,
			interactive: true
		});

		// With implicit grant, the token comes directly in the URL fragment
		const urlHash = new URL(redirectUrl).hash.substring(1);
		const params = new URLSearchParams(urlHash);
		const accessToken = params.get('access_token');

		if (!accessToken) {
			throw new Error('No access token received');
		}

		// Cache the token with expiry
		await chrome.storage.local.set({
			splitwise_token: accessToken,
			splitwise_token_expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days in milliseconds
		});
		return accessToken;

	} catch (error) {
		console.error('Detailed Splitwise OAuth error:', {
			message: error.message,
			stack: error.stack,
			error
		});
		throw error;
	}
}

// Get friends from Splitwise
async function getSplitwiseFriends() {
	const token = await getSplitwiseToken();
	const response = await fetch("https://secure.splitwise.com/api/v3.0/get_friends", {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json"
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const data = await response.json();
	return data.friends;
}

// Get the current user from Splitwise
async function getCurrentUser() {
	const token = await getSplitwiseToken();
	const response = await fetch("https://secure.splitwise.com/api/v3.0/get_current_user", {
		method: "GET",
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json"
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const data = await response.json();
	if (!data.user || !data.user.id) {
		throw new Error('Invalid response from Splitwise API');
	}

	return data.user.id;
}



