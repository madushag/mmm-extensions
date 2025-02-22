/******************************************************************************************/
/* This file contains the endpoints for interacting with the Splitwise API.              */
/* It provides functionality to:                                                         */
/* - Get the Splitwise token using OAuth                                                  */
/* - Fetch friends from Splitwise                                                         */
/******************************************************************************************/

// Splitwise OAuth configuration
const SPLITWISE_CONFIG = {
	client_id: '2ZaThr0W2roRjKEXVdRU8jPyaXkpnlnosvYSoXM9', // Get this from Splitwise Developer Portal
	redirect_uri: chrome.identity.getRedirectURL('oauth2'),
	auth_url: 'https://secure.splitwise.com/oauth/authorize',
	token_url: 'https://secure.splitwise.com/oauth/token',
	authorize_url: 'https://secure.splitwise.com/oauth/authorize',
	scope: ''
};

// Get the Splitwise token
export async function getSplitwiseTokenUsingAPI() {
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
export async function getSplitwiseFriendsUsingAPI() {
	const token = await getSplitwiseTokenUsingAPI();
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
export async function getCurrentUserUsingAPI() {
	const token = await getSplitwiseTokenUsingAPI();
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

// Get groups from Splitwise
export async function getSplitwiseGroupsUsingAPI() {
	const token = await getSplitwiseTokenUsingAPI();
	const response = await fetch("https://secure.splitwise.com/api/v3.0/get_groups", {
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
	return data.groups;
}

// Post a transaction to Splitwise
export async function postToSplitwiseUsingAPI(expenseDetails, myUserId, debUserId) {
	let groupId = expenseDetails.groupId || 0;
	let description = expenseDetails.description;

	// round to 2 decimal places

	// if amount is negative, then make it positive, otherwise dont change the sign of the amount
	const expenseAmount = expenseDetails.amount < 0 ? expenseDetails.amount * -1 : expenseDetails.amount;
	let myOwedShare = Math.round(expenseAmount / 2 * 100) / 100;
	let debOwedShare = Math.round(expenseAmount / 2 * 100) / 100;

	// if the sum of myOwedShare and debOwedShare is not equal to expenseAmount, then subtract the difference from myOwedShare
	if (myOwedShare + debOwedShare !== expenseAmount) {
		myOwedShare = myOwedShare - (myOwedShare + debOwedShare - expenseAmount);
	}

	// If this is a utility bill (indicated by group ID being set), format description accordingly
	if (groupId > 0) {
		const monthName = new Date(expenseDetails.date).toLocaleString('default', { month: 'long' });
		const year = expenseDetails.date.split("-")[0];
		description = `${expenseDetails.category.name} - ${monthName} ${year}`;
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

	const token = await getSplitwiseTokenUsingAPI();
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

// Delete a Splitwise expense
export async function deleteSplitwiseExpenseUsingAPI(transactionId) {
	try {
		// Extract the Splitwise expense ID from the transaction notes
		const token = await getSplitwiseTokenUsingAPI();
		const response = await fetch(`https://secure.splitwise.com/api/v3.0/delete_expense/${transactionId}`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json"
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return response.json();
	} catch (error) {
		console.error('Error deleting Splitwise expense:', error);
		throw error;
	}
}
