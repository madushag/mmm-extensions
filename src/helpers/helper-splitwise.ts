/******************************************************************************************/
/* This file contains the helper functions for interacting with the Splitwise API.
/* It provides functionality to:
/* - Get and manage Splitwise authentication tokens
/* - Post expenses to Splitwise
/* - Handle message events between content script and page for Splitwise operations
/******************************************************************************************/

import { ExpenseDetails } from '../types/entities/ExpenseDetails.d.js';
import { SplitwiseResponse } from '../types/splitwise-responses/splitWiseResponse.d.js';

export enum SplitwiseMessageType {
	POST_TO_SPLITWISE = 'POST_TO_SPLITWISE',
	SPLITWISE_EXPENSE_RESPONSE = 'SPLITWISE_EXPENSE_RESPONSE',
	GET_SPLITWISE_TOKEN = 'GET_SPLITWISE_TOKEN',
	SPLITWISE_TOKEN_RESPONSE = 'SPLITWISE_TOKEN_RESPONSE'
}

/**
 * Posts an expense to Splitwise using the provided expense details and user IDs.
 * It sends a message to the content script and listens for the response.
 * On success, it resolves with the response from Splitwise; on failure, it rejects with an error.
 * 
 * @param expenseDetails - The details of the expense to be posted.
 * @param myUserId - The ID of the user posting the expense.
 * @param debUserId - The ID of the user being debited for the expense.
 * @returns A promise that resolves to the Splitwise response or rejects with an error.
 */
export async function postToSplitwise(
	expenseDetails: ExpenseDetails,
	myUserId: number,
	debUserId: number
): Promise<SplitwiseResponse> {
	return new Promise((resolve, reject) => {
		const messageId = Math.random().toString(36).substring(7);

		// Setup the event listener before posting the message
		const messageListener = (event: MessageEvent) => {
			// Only accept messages from our extension
			if (event.data.source !== 'MMM_EXTENSION') return;

			// Handle the response from Splitwise
			if (event.data.type === SplitwiseMessageType.SPLITWISE_EXPENSE_RESPONSE && event.data.messageId === messageId) {
				window.removeEventListener('message', messageListener);

				if (event.data.error) {
					reject(new Error(event.data.error));
				} else {
					resolve(event.data.response);
				}
			}
		};
		window.addEventListener('message', messageListener);

		try {
			// Send message to content script
			window.postMessage({
				type: SplitwiseMessageType.POST_TO_SPLITWISE,
				messageId,
				source: 'MMM_EXTENSION',
				data: {
					expenseDetails,
					myUserId,
					debUserId
				}
			}, '*');
		} catch (error) {
			window.removeEventListener('message', messageListener);
			reject(error);
		}
	});
}


// /**
//  * Gets the Splitwise token. This function can work in two ways:
//  * 1. Through Chrome runtime messaging when called from content script
//  * 2. Through window messaging when called from the page context
//  * @returns A promise that resolves to either the token or an object with token/error
//  */
// export async function getSplitwiseToken(): Promise<{ token?: string; error?: string } | string> {
// 	// If we're in a content script context (chrome.runtime is available)
// 	if (typeof chrome !== 'undefined' && chrome.runtime) {
// 		return new Promise((resolve) => {
// 			chrome.runtime.sendMessage({
// 				type: SplitwiseMessageType.GET_SPLITWISE_TOKEN
// 			}, response => {
// 				resolve({
// 					token: response.token,
// 					error: response.error
// 				});
// 			});
// 		});
// 	}

// 	// If we're in the page context
// 	return new Promise((resolve, reject) => {
// 		const messageId = Math.random().toString(36).substring(7);

// 		// Listen for the response
// 		const messageListener = (event: MessageEvent) => {
// 			if (event.data.type === SplitwiseMessageType.SPLITWISE_TOKEN_RESPONSE && event.data.messageId === messageId) {
// 				window.removeEventListener('message', messageListener);

// 				if (event.data.error) {
// 					reject(new Error(event.data.error));
// 				} else if (!event.data.token) {
// 					reject(new Error('Failed to get Splitwise token'));
// 				} else {
// 					resolve(event.data.token);
// 				}
// 			}
// 		};
// 		window.addEventListener('message', messageListener);

// 		// Request the token
// 		window.postMessage({
// 			type: SplitwiseMessageType.GET_SPLITWISE_TOKEN,
// 			messageId,
// 			source: 'MMM_EXTENSION'
// 		}, '*');

// 		// Timeout after 10 seconds
// 		setTimeout(() => {
// 			window.removeEventListener('message', messageListener);
// 			reject(new Error('Timeout waiting for Splitwise token'));
// 		}, 10000);
// 	});
// }

// // Function to post expense to Splitwise
// export async function postToSplitwiseAPI(data: any): Promise<{ data?: any; error?: string }> {
// 	return new Promise((resolve) => {
// 		chrome.runtime.sendMessage({
// 			type: SplitwiseMessageType.POST_TO_SPLITWISE,
// 			...data
// 		}, response => {
// 			resolve({
// 				data: response.data,
// 				error: response.error
// 			});
// 		});
// 	});
// }

// // Function to handle Splitwise message events
// export function handleSplitwiseMessage(event: MessageEvent): void {
// 	// Only accept messages from our extension
// 	if (event.data.source !== 'MMM_EXTENSION') return;

// 	if (event.data.type === SplitwiseMessageType.GET_SPLITWISE_TOKEN) {
// 		getSplitwiseToken().then(response => {
// 			window.postMessage({
// 				type: SplitwiseMessageType.SPLITWISE_TOKEN_RESPONSE,
// 				messageId: event.data.messageId,
// 				token: typeof response === 'string' ? response : response.token,
// 				error: typeof response === 'string' ? undefined : response.error,
// 				source: 'MMM_EXTENSION'
// 			}, '*');
// 		});
// 	}
// 	else if (event.data.type === SplitwiseMessageType.POST_TO_SPLITWISE) {
// 		postToSplitwiseAPI(event.data.data).then(response => {
// 			window.postMessage({
// 				type: SplitwiseMessageType.SPLITWISE_EXPENSE_RESPONSE,
// 				messageId: event.data.messageId,
// 				response: response.data,
// 				error: response.error,
// 				source: 'MMM_EXTENSION'
// 			}, '*');
// 		});
// 		});
// 	}
// }