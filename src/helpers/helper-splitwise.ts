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
	SPLITWISE_TOKEN_RESPONSE = 'SPLITWISE_TOKEN_RESPONSE',
	GET_SPLITWISE_FRIENDS = 'GET_SPLITWISE_FRIENDS',
	SPLITWISE_FRIENDS_RESPONSE = 'SPLITWISE_FRIENDS_RESPONSE',
	GET_CURRENT_USER = 'GET_CURRENT_USER',
	CURRENT_USER_RESPONSE = 'CURRENT_USER_RESPONSE'
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

/**
 * Gets the list of friends from Splitwise.
 * It sends a message to the content script and listens for the response.
 * On success, it resolves with the list of friends; on failure, it rejects with an error.
 * 
 * @returns A promise that resolves to the list of Splitwise friends or rejects with an error.
 */
export async function getSplitwiseFriends(): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const messageId = Math.random().toString(36).substring(7);

		// Setup the event listener before posting the message
		const messageListener = (event: MessageEvent) => {
			// Only accept messages from our extension
			if (event.data.source !== 'MMM_EXTENSION') return;

			// Handle the response from Splitwise
			if (event.data.type === SplitwiseMessageType.SPLITWISE_FRIENDS_RESPONSE && event.data.messageId === messageId) {
				window.removeEventListener('message', messageListener);

				if (event.data.error) {
					reject(new Error(event.data.error));
				} else {
					resolve(event.data.friends);
				}
			}
		};
		window.addEventListener('message', messageListener);

		try {
			// Send message to content script
			window.postMessage({
				type: SplitwiseMessageType.GET_SPLITWISE_FRIENDS,
				messageId,
				source: 'MMM_EXTENSION'
			}, '*');
		} catch (error) {
			window.removeEventListener('message', messageListener);
			reject(error);
		}
	});
}

/**
 * Get the current user's information from Splitwise using message passing
 * @returns Promise with the current user's ID or throws an error
 */
export async function getCurrentUser(): Promise<number> {
	return new Promise((resolve, reject) => {
		const messageId = Math.random().toString(36).substring(7);

		// Setup the event listener before posting the message
		const messageListener = (event: MessageEvent) => {
			// Only accept messages from our extension
			if (event.data.source !== 'MMM_EXTENSION') return;

			// Handle the response 
			if (event.data.type === SplitwiseMessageType.CURRENT_USER_RESPONSE && event.data.messageId === messageId) {
				window.removeEventListener('message', messageListener);

				if (event.data.error) {
					reject(new Error(event.data.error));
				} else if (!event.data.userId) {
					reject(new Error('No user ID received from Splitwise'));
				} else {
					resolve(event.data.userId);
				}
			}
		};
		window.addEventListener('message', messageListener);

		try {
			// Send message to content script
			window.postMessage({
				type: SplitwiseMessageType.GET_CURRENT_USER,
				messageId,
				source: 'MMM_EXTENSION'
			}, '*');
		} catch (error) {
			window.removeEventListener('message', messageListener);
			reject(error);
		}
	});
}