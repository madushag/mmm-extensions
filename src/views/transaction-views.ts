/******************************************************************************************/
/* This file handles the transaction view functionality of the extension.
/* It provides:
/* - Split and unsplit transaction operations
/* - Transaction tagging functionality
/* - Splitwise expense posting integration
/* - UI button management for transaction rows
/* - React fiber traversal for transaction details
/******************************************************************************************/

import { getCustomSettings } from './settings-view.js';
import { CustomSettings } from '../types/entities/CustomSettings.js';
import {
	getTagIdWithTagName,
	getTransactionDrawerDetails,
	hideSplitTransaction,
	setTransactionTags,
	splitTransaction,
	unsplitTransaction,
	updateTransactionNotes
} from '../helpers/helper-graphql.js';
import { handleGlobalError } from '../helpers/helper-errorhandler.js';
import { showToast, ToastType } from '../toast.js';
import { AnalyticsEventType, trackGoogleAnalyticsEvent } from '../helpers/helper-google-analytics.js';
import { deleteSplitwiseExpense, postToSplitwise } from '../helpers/splitwise/helper-splitwise.js';
import { MutationObserverMessageType } from '../helpers/helper-constants.js';
import { Transaction } from '../types/entities/Transaction.js';
import { ExpenseDetails } from '../types/entities/ExpenseDetails.js';
import { SplitwiseResponse } from '../types/splitwise-responses/splitWiseResponse.js';
import { UpdateTransactionSplitResponse } from '../types/graphql-responses/updateTransactionSplitResponse.js';

// Global variables
let SPLIT_WITH_PARTNER_TAG_NAME = "";
let SPLIT_WITH_PARTNER_ACCOUNT_ID = "";
let SPLITWISE_FRIEND_ID = "";
let SPLITWISE_USER_ID = 0;

// Listen for the EXECUTE-TRANSACTIONS-VIEW from the content script
document.addEventListener('EXECUTE-TRANSACTIONS-VIEW', (event: Event) => {
	// Bootstrap settings   
	let customSettings = getCustomSettings();
	mainHandler(customSettings);
});

// Main handler function in the injected script
function mainHandler(customSettings: CustomSettings) {
	SPLIT_WITH_PARTNER_TAG_NAME = customSettings.splitWithPartnerTagName;
	SPLIT_WITH_PARTNER_ACCOUNT_ID = customSettings.splitWithPartnerAccountId;
	SPLITWISE_FRIEND_ID = customSettings.splitwiseFriendId;
	SPLITWISE_USER_ID = customSettings.splitwiseUserId;

	// Get all the transaction rows, determined by whether the row has an amount and a merchant
	const transactionRows = Array.from(document.querySelectorAll('div[class*="TransactionsListRow"]'))
		.filter((row) => {
			return (
				row.querySelector('div[class*="TransactionOverview__Amount"]') &&
				row.querySelector('div[class*="TransactionMerchantSelect"]')
			);
		});

	// If there are transactions, attach the split and unsplit buttons
	if (transactionRows.length > 0) {
		transactionRows.forEach((row) => {
			addSplitButtonsIfNeeded(row as HTMLElement, customSettings);
			addUnsplitButtonIfNeeded(row as HTMLElement, customSettings);
			addDeleteSplitwiseExpenseButtonIfNeeded(row as HTMLElement, customSettings);
		});
	}

	// Resume the mutation observer after DOM modifications are complete
	window.postMessage({ type: MutationObserverMessageType.RESUME_OBSERVER, source: 'MMM_EXTENSION' }, '*');
}

// Add a delete splitwise expense button to the transaction row if it is not already present.
function addDeleteSplitwiseExpenseButtonIfNeeded(row: HTMLElement, customSettings: CustomSettings) {

	// Get the transaction details
	let transactionDetails = getTransactionDetailsForRow(row);

	// Check if the delete splitwise expense button is already present, and if not, add it
	if (!row.querySelector(".monarch-helper-button-delete-splitwise-expense")) {
		// Check if the transaction has a splitwise expense id, and a tag indicating it has been posted to splitwise
		if (transactionDetails?.notes?.includes("Splitwise Expense ID:")
			&& transactionDetails?.tags?.some(tag => tag.name === customSettings.transactionPostedToSplitwiseTagName)) {
			// Add the delete splitwise expense button
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "button-container";

			// Insert the button container before the transaction icon container
			const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
			if (transactionIconContainer)
				transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Only add the delete splitwise expense button if the transaction is not split
			if (!transactionDetails?.isSplitTransaction) {
				const buttonDeleteSplitwiseExpense = document.createElement("button");
				buttonDeleteSplitwiseExpense.className = "monarch-helper-button-delete-splitwise-expense";
				const existingButton = document.querySelector('button[class*="Button"]');
				if (existingButton)
					buttonDeleteSplitwiseExpense.className += " " + existingButton.className;
				buttonDeleteSplitwiseExpense.innerHTML = "🗑️";
				buttonDeleteSplitwiseExpense.title = "Delete Splitwise Expense";
				buttonDeleteSplitwiseExpense.onclick = async (e) => await handleDeleteSplitwiseExpenseButtonClick(e, row);
				buttonContainer.appendChild(buttonDeleteSplitwiseExpense);
			}
		}
	}
}

// Add a split button to the transaction row if it is not already present.
function addSplitButtonsIfNeeded(row: HTMLElement, customSettings: CustomSettings) {
	// Get the transaction details
	let transactionDetails = getTransactionDetailsForRow(row);

	// Check if the split button is already present, and if not, add it
	if (!row.querySelector(".monarch-helper-button-split") && transactionDetails?.isSplitTransaction === false) {
		if (customSettings.showSplitButtonForUnsplitTransactions &&
			(customSettings.showSplitButtonOnAllAccounts || transactionDetails?.account?.id === SPLIT_WITH_PARTNER_ACCOUNT_ID)) {
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "button-container";

			// Insert the button container before the transaction icon container
			const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
			if (transactionIconContainer)
				transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Only add the split button if the transaction does not have a "Posted to Splitwise" tag
			if (!transactionDetails?.tags?.some(tag => tag.name === customSettings.transactionPostedToSplitwiseTagName)) {
				// Add the split button to the button container
				const buttonSplit = document.createElement("button");
				buttonSplit.className = "monarch-helper-button-split";
				// Apply styles from an existing button
				const existingButton = document.querySelector('button[class*="Button"]');
				if (existingButton)
					buttonSplit.className += " " + existingButton.className;
				buttonSplit.innerHTML = "✂️";
				buttonSplit.title = "Split Transaction";
				buttonSplit.onclick = async (e) => await handleSplitButtonClick(e, row);
				buttonContainer.appendChild(buttonSplit);
			}

			// Add the split and post to Splitwise button if enabled and not already posted
			if (customSettings.showPostToSplitwiseButton && !transactionDetails?.tags?.some(tag => tag.name === customSettings.transactionPostedToSplitwiseTagName)) {
				const buttonSplitAndPostToSW = document.createElement("button");
				buttonSplitAndPostToSW.className = "monarch-helper-button-splitwise";
				const existingButton = document.querySelector('button[class*="Button"]');
				if (existingButton) buttonSplitAndPostToSW.className += " " + existingButton.className;

				// if transaction category is in the utility categories list, show a 💡 icon
				if (customSettings.handleUtilities && transactionDetails?.category?.id
					&& customSettings.utilityCategories.includes(transactionDetails.category.id)) {
					buttonSplitAndPostToSW.innerHTML = "💡";
					buttonSplitAndPostToSW.title = "Split & Post to Splitwise";
				}
				else if (customSettings.handleCreditCardPayments && transactionDetails?.category?.name?.toLowerCase().includes('credit card payment')) {
					buttonSplitAndPostToSW.innerHTML = "💳";
					buttonSplitAndPostToSW.title = "Post to Splitwise";
				}
				else {
					buttonSplitAndPostToSW.innerHTML = "📤";
					buttonSplitAndPostToSW.title = "Split & Post to Splitwise";
				}
				buttonSplitAndPostToSW.onclick = async (e) => await handleSplitAndPostToSWButtonClick(e, row);
				buttonContainer.appendChild(buttonSplitAndPostToSW);
			}
		}
	}
}

// Add an unsplit button to the transaction row if it is not already present.
function addUnsplitButtonIfNeeded(row: HTMLElement, customSettings: CustomSettings) {

	// Get the relevant settings
	const showUnsplitButtonForSplitTransactions = customSettings.showUnsplitButtonForSplitTransactions;

	// Check if the unsplit button is already present, and if not, add it
	if (!row.querySelector(".monarch-helper-button-unsplit")) {
		// Check if the transaction is already split
		let isAlreadySplit = getTransactionDetailsForRow(row)?.isSplitTransaction;
		let isHidden = getTransactionDetailsForRow(row)?.hideFromReports;

		// If the transaction is already split, and the relevant setting is enabled, add the unsplit button
		if (isAlreadySplit && showUnsplitButtonForSplitTransactions) {

			// Create the button container
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "button-container";

			// Insert the button container before the transaction icon container
			const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
			if (transactionIconContainer)
				transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Add the unsplit button to the button container
			const buttonUnsplit = document.createElement("button");
			buttonUnsplit.className = "monarch-helper-button-unsplit";
			if (!isHidden) { // Check if the transaction is not hidden
				// Copy existing button class names
				const existingButton = document.querySelector('button[class*="Button"]');
				if (existingButton)
					buttonUnsplit.className += " " + existingButton.className;
				buttonUnsplit.innerHTML = "🔀"; // Merge/Split transaction button
				buttonUnsplit.title = "Unsplit Transaction";
				buttonUnsplit.onclick = async (e) => handleUnsplitButtonClick(e, row);
				buttonContainer.appendChild(buttonUnsplit);
			}
		}
	}
}

// Handle the split button click event
async function handleSplitButtonClick(e: MouseEvent | null, row: HTMLElement): Promise<boolean> {
	if (e)
		e.stopPropagation();

	// hide div with class "button-container"
	const buttonContainer = row.querySelector(".button-container");
	if (buttonContainer)
		(buttonContainer as HTMLElement).style.display = "none";

	let transactionDetails = getTransactionDetailsForRow(row);

	// Call the graphql helper to split the transaction
	const response = await splitTransaction(transactionDetails);
	if (response?.data?.updateTransactionSplit.errors) {
		handleGlobalError(new Error("Error while splitting transaction ID " + transactionDetails?.id), "split_transaction");
		return false;
	}

	const splitTransactionId = response?.data?.updateTransactionSplit.transaction.splitTransactions[0].id;
	if (!splitTransactionId)
		throw new Error("No split transaction ID found");

	const result = await hideSplitTransaction(splitTransactionId);
	if (!result || result.errors) {
		handleGlobalError(new Error("Error while hiding split transaction ID " + splitTransactionId), "hide_split_transaction");
		return false;
	}

	const shouldTagSplitTransactions = getCustomSettings().tagSplitTransactions;
	if (shouldTagSplitTransactions && response?.data?.updateTransactionSplit.transaction.splitTransactions) {
		let success = await tagSplitTransactions(transactionDetails, response);
		if (!success)
			return false;
	}

	// Show a toast and hide the split button
	showToast(`Transaction split successfully!`, ToastType.SUCCESS);

	// Fire a success analytics event
	trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'split_transaction' });
	return true;
}

// Handle the unsplit button click event
async function handleUnsplitButtonClick(e: MouseEvent, row: HTMLElement): Promise<boolean> {
	e.stopPropagation();

	// Hide the button container
	const buttonContainer = row.querySelector(".button-container");
	if (buttonContainer)
		(buttonContainer as HTMLElement).style.display = "none";

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails)
		return false;

	const transactionDrawerDetails = await getTransactionDrawerDetails(transactionDetails);
	if (!transactionDrawerDetails?.data?.getTransaction?.originalTransaction?.id) {
		throw new Error("Missing original transaction ID");
	}

	// first delete the splitwise expense if it exists
	const splitwiseExpenseId = transactionDetails.notes?.match(/Splitwise Expense ID: (\d+)/)?.[1];
	if (splitwiseExpenseId) {
		await handleDeleteSplitwiseExpenseButtonClick(e, row);
	}

	// then unsplit the transaction
	const unsplitResponse = await unsplitTransaction(transactionDrawerDetails.data.getTransaction.originalTransaction.id);
	if (unsplitResponse?.data?.updateTransactionSplit.errors) {
		handleGlobalError(new Error("Error while unsplitting transaction ID " + transactionDrawerDetails.data.getTransaction.originalTransaction.id), "unsplit_transaction");
		return false;
	}

	showToast(`Transaction unsplit successfully!`, ToastType.SUCCESS);

	// Fire a success analytics event
	trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'unsplit_transaction' });
	return true;
}

// Handle splitting and posting to Splitwise
async function handleSplitAndPostToSWButtonClick(e: MouseEvent, row: HTMLElement): Promise<boolean> {
	if (e)
		e.stopPropagation();

	let startTime = new Date();
	console.log("Starting split and post to SW button click " + startTime.toISOString());

	// Hide the button container
	const buttonContainer = row.querySelector(".button-container");
	if (buttonContainer)
		(buttonContainer as HTMLElement).style.display = "none";

	if (!SPLITWISE_FRIEND_ID) {
		showToast("No Splitwise friend selected in settings. Please configure a friend in MMM Extensions Custom Settings.", ToastType.ERROR);
		return false;
	}

	if (!SPLITWISE_USER_ID) {
		showToast("No Splitwise user ID found. Please ensure you're logged into Splitwise and try enabling Splitwise integration again.", ToastType.ERROR);
		return false;
	}

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails)
		return false;

	try {
		// Get custom settings to check for utility handling and credit card payments
		const settings = getCustomSettings();
		let groupId = 0;
		let description = '';

		// If utilities are being handled and this category is in the utility categories list
		if (settings.handleUtilities && transactionDetails.category?.id && settings.utilityCategories.includes(transactionDetails.category.id)) {
			groupId = settings.splitwiseUtilityGroupId;
			const monthName = new Date(transactionDetails.date).toLocaleString('default', { month: 'long' });
			const year = transactionDetails.date.split("-")[0];
			description = `${transactionDetails.category.name} - ${monthName} ${year}`;
		}
		// If this is a credit card payment and credit card handling is enabled
		else if (settings.handleCreditCardPayments && transactionDetails.category?.name?.toLowerCase().includes('credit card payment')) {
			groupId = settings.creditCardPaymentGroupId;
			const monthName = new Date(transactionDetails.date).toLocaleString('default', { month: 'long' });
			const year = transactionDetails.date.split("-")[0];
			description = `Credit Card Payment - ${monthName} ${year}`;
		}
		// Default description for regular expenses
		else {
			description = `${transactionDetails.merchant?.name || 'Unknown'} charged not on shared card`;
		}

		// Post to Splitwise using the ExpenseDetails interface
		const merchantInfo = { name: transactionDetails.merchant?.name || 'Unknown' };
		const categoryInfo = { name: transactionDetails.category?.name || 'Uncategorized' };
		const expenseDetails: ExpenseDetails = {
			merchant: merchantInfo,
			category: categoryInfo,
			amount: transactionDetails.amount,
			date: transactionDetails.date,
			notes: transactionDetails.notes,
			groupId: groupId,
			description: description
		};

		var postedToSplitwiseResponse = await postToSplitwise(expenseDetails, SPLITWISE_USER_ID, parseInt(SPLITWISE_FRIEND_ID));
		var splitwiseExpenseId = postedToSplitwiseResponse.expenses[0].id;

		let endTime = new Date();
		console.log("Splitwise post completed in " + (endTime.getTime() - startTime.getTime()) + "ms");
		startTime = new Date();
		console.log("Starting split " + startTime.toISOString());

		// get the existing notes from the transaction
		const existingNotes = transactionDetails.notes;

		// Dont split it if the transaction is a "Credit Card Payment", otherwise split it
		if (!transactionDetails.category?.name?.toLowerCase().includes('credit card payment')) {
			// Call the graphql helper to split the transaction
			const response = await splitTransaction(transactionDetails);
			if (response?.data?.updateTransactionSplit.errors) {
				handleGlobalError(new Error("Error while splitting transaction ID " + transactionDetails?.id), "split_transaction");
				return false;
			}

			const splitTransactionId = response?.data?.updateTransactionSplit.transaction.splitTransactions[0].id;
			if (!splitTransactionId)
				throw new Error("No split transaction ID found");

			// Hide 1st split transaction
			const result = await hideSplitTransaction(splitTransactionId);
			if (!result || result.errors) {
				handleGlobalError(new Error("Error while hiding split transaction ID " + splitTransactionId), "hide_split_transaction");
				return false;
			}

			const shouldTagSplitTransactions = getCustomSettings().tagSplitTransactions;
			if (shouldTagSplitTransactions && response?.data?.updateTransactionSplit.transaction.splitTransactions) {
				let success = await tagSplitTransactions(transactionDetails, response);
				if (!success)
					return false;
			}

			// Append a note to the split transactions, and retain the existing notes
			var note = existingNotes ? `${existingNotes}\n\nSplitwise Expense ID: ${splitwiseExpenseId}` : `Splitwise Expense ID: ${splitwiseExpenseId}`;
			var success = await addNoteToTransactions(transactionDetails, response?.data?.updateTransactionSplit.transaction.splitTransactions, note);
			if (!success)
				return false;

			showToast(`Transaction split successfully!`, ToastType.SUCCESS);
		}
		// if its a credit card payment, just add a tag and a note to the transaction
		else {
			// Add a tag to the transaction to indicate that it has been posted to Splitwise
			var postedToSplitwiseTagId = (await getTagIdWithTagName(getCustomSettings().transactionPostedToSplitwiseTagName))?.id;
			if (postedToSplitwiseTagId) {
				let tags = transactionDetails.tags?.filter(tag => tag.id !== postedToSplitwiseTagId).map(tag => tag.id) || [];

				// Add the posted to splitwise tag ID to the tag list
				if (postedToSplitwiseTagId) {
					if (tags.length > 0) {
						tags.push(postedToSplitwiseTagId);
					}
					else {
						tags = [postedToSplitwiseTagId];
					}
				}

				var setTagsResponse = await setTransactionTags(transactionDetails.id, tags);
				if (setTagsResponse?.errors) {
					handleGlobalError(new Error("Error while setting tags on transaction ID " + transactionDetails.id), "set_tags_on_transaction");
					return false;
				}
			}

			// Append a note to the transaction, and retain the existing notes
			var note = existingNotes ? `${existingNotes}\n\nSplitwise Expense ID: ${splitwiseExpenseId}` : `Splitwise Expense ID: ${splitwiseExpenseId}`;
			var notesResponse = await updateTransactionNotes(transactionDetails.id, note);
			if (notesResponse?.errors) {
				handleGlobalError(new Error("Error while updating transaction notes for transaction ID " + transactionDetails.id), "update_transaction_notes");
				return false;
			}
		}

		endTime = new Date();
		console.log("Splitwise post and split completed in " + (endTime.getTime() - startTime.getTime()) + "ms");

		// Show a toast and hide the split button
		showToast(`Transaction posted to Splitwise successfully!`, ToastType.SUCCESS);
		trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'post_to_splitwise' });
		return true;
	}
	catch (error) {
		handleGlobalError(error, "handleSplitAndPostToSWButtonClick");
		return false;
	}
}

// Add a note to the original transaction and split transactions
async function addNoteToTransactions(transactionDetails: Transaction | null, splitTransactions: any[], note: string): Promise<boolean> {
	// Add a note to the split transactions
	var notesResponse1 = await updateTransactionNotes(splitTransactions[0].id, note);
	if (notesResponse1?.errors) {
		handleGlobalError(new Error("Error while updating transaction notes for split transaction ID " + splitTransactions[0].id), "update_transaction_notes");
		return false;
	}
	console.log("Note added to transaction ID " + splitTransactions[0].id);

	// Add a note to the split transactions
	var notesResponse2 = await updateTransactionNotes(splitTransactions[1].id, note);
	if (notesResponse2?.errors) {
		handleGlobalError(new Error("Error while updating transaction notes for split transaction ID " + splitTransactions[1].id), "update_transaction_notes");
		return false;
	}
	console.log("Note added to transaction ID " + splitTransactions[1].id);

	return true;
}

// Add tags to the split transactions
async function tagSplitTransactions(transactionDetails: Transaction | null, response: UpdateTransactionSplitResponse | null): Promise<boolean> {
	let splitWithPartnerTagId = (await getTagIdWithTagName(SPLIT_WITH_PARTNER_TAG_NAME))?.id;
	var postedToSplitwiseTagId = (await getTagIdWithTagName(getCustomSettings().transactionPostedToSplitwiseTagName))?.id;
	let tagList = transactionDetails?.tags?.filter(tag => tag.id !== splitWithPartnerTagId && tag.id !== postedToSplitwiseTagId).map(tag => tag.id) || [];

	// Add tags to indicate that its been split with a partner to the split transactions
	const shouldTagSplitTransactions = getCustomSettings().tagSplitTransactions;
	if (shouldTagSplitTransactions) {
		if (splitWithPartnerTagId) {
			if (tagList.length > 0) {
				tagList.push(splitWithPartnerTagId);
			}
			else {
				tagList = [splitWithPartnerTagId];
			}
		}
	}

	// Add a tag to the transaction to indicate that it has been posted to Splitwise
	if (postedToSplitwiseTagId) {
		// Add the posted to splitwise tag ID to the tag list
		if (postedToSplitwiseTagId) {
			if (tagList.length > 0) {
				tagList.push(postedToSplitwiseTagId);
			}
			else {
				tagList = [postedToSplitwiseTagId];
			}
		}
	}

	if (response?.data?.updateTransactionSplit.transaction.splitTransactions) {
		// Tag both split transactions
		var setTagsResponse1 = await setTransactionTags(response?.data?.updateTransactionSplit.transaction.splitTransactions[0].id, tagList);
		if (setTagsResponse1?.errors) {
			handleGlobalError(new Error("Error while setting tags on split transaction ID " + response?.data?.updateTransactionSplit.transaction.splitTransactions[0].id), "set_tags_on_split_transaction");
			return false;
		}

		var setTagsResponse2 = await setTransactionTags(response?.data?.updateTransactionSplit.transaction.splitTransactions[1].id, tagList);
		if (setTagsResponse2?.errors) {
			handleGlobalError(new Error("Error while setting tags on split transaction ID " + response?.data?.updateTransactionSplit.transaction.splitTransactions[1].id), "set_tags_on_split_transaction");
			return false;
		}
	}

	return true;
}

// Handle the delete splitwise expense button click event
async function handleDeleteSplitwiseExpenseButtonClick(e: MouseEvent, row: HTMLElement): Promise<boolean> {
	e.stopPropagation();

	// hide the button container
	const buttonContainer = row.querySelector(".button-container");
	if (buttonContainer)
		(buttonContainer as HTMLElement).style.display = "none";

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails)
		return false;

	try {
		// extract the splitwise expense id from the notes
		const splitwiseExpenseId = transactionDetails.notes?.match(/Splitwise Expense ID: (\d+)/)?.[1];
		if (!splitwiseExpenseId) {
			showToast("No Splitwise expense ID found. Please ensure the transaction has a Splitwise expense ID.", ToastType.ERROR);
			return false;
		}

		// Delete the splitwise expense
		await deleteSplitwiseExpense(splitwiseExpenseId);

		// Remove the tag indicating the transaction was posted to Splitwise
		// get all the tags on the transaction, and just remove the posted to splitwise tag
		let tags = transactionDetails.tags?.filter(tag => tag.name !== getCustomSettings().transactionPostedToSplitwiseTagName);
		if (tags) {
			await setTransactionTags(transactionDetails.id, tags.map(tag => tag.id));
		}

		// Clear the notes containing the Splitwise expense ID, but just remove the text "Splitwise Expense ID: ###"
		await updateTransactionNotes(transactionDetails.id, transactionDetails.notes?.replace(/Splitwise Expense ID: \d+/, ""));

		showToast(`Splitwise expense deleted successfully!`, ToastType.SUCCESS);

		const deleteButton = row.querySelector(".monarch-helper-button-delete-splitwise-expense");
		if (deleteButton)
			(deleteButton as HTMLElement).style.display = "none";

		trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'delete_splitwise_expense' });
		return true;
	}
	catch (error) {
		handleGlobalError(error, "handleDeleteSplitwiseExpenseButtonClick");
		return false;
	}
}

//---------------------- HELPER FUNCTIONS ----------------------
// Return attributes of a transaction for a given row by accessing the React fiber of the drawer toggle
function getTransactionDetailsForRow(row: HTMLElement): Transaction | null {
	// Get the drawer toggle
	const drawerToggle = row.querySelector("button.fs-drawer-toggle");
	if (drawerToggle) {
		// Get the React fiber key
		const key = Object.keys(drawerToggle).find((key) => key.startsWith("__reactFiber$"));
		if (key) {
			// Get the fiber
			let fiber = (drawerToggle as any)[key];

			// Traverse the fiber to find the transaction details
			while (fiber) {
				if (fiber.memoizedProps?.transaction) {
					let transactionDetails = fiber.memoizedProps.transaction;
					return {
						id: transactionDetails.id,
						account: {
							id: transactionDetails.account.id,
							displayName: transactionDetails.account.displayName
						},
						hideFromReports: transactionDetails.hideFromReports,
						amount: transactionDetails.amount,
						date: transactionDetails.date,
						hasSplitTransactions: transactionDetails.hasSplitTransactions,
						isSplitTransaction: transactionDetails.isSplitTransaction,
						merchant: {
							id: transactionDetails.merchant.id,
							name: transactionDetails.merchant.name,
							logoUrl: transactionDetails.merchant.logoUrl,
						},
						category: {
							id: transactionDetails.category.id,
							name: transactionDetails.category.name,
						},
						notes: transactionDetails.notes,
						tags: transactionDetails.tags.map((tag) => ({
							id: tag.id,
							name: tag.name,
						})),
					};
				}
				// Traverse the fiber to the parent
				fiber = fiber.return;
			}
		}
	}

	// Return null if no transaction details are found
	return null;
}
