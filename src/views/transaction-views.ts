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
	updateTransactionNotes,
} from '../helpers/helper-graphql.js';
import { handleGlobalError } from '../helpers/helper-errorhandler.js';
import { Transaction } from '../types/entities/Transaction.js';
import { SplitTransaction } from '../types/entities/SplitTransaction.js';
import { showToast, ToastType } from '../toast.js';
import { AnalyticsEventType, trackGoogleAnalyticsEvent } from '../helpers/helper-google-analytics.js';
import { ExpenseDetails } from '../types/entities/ExpenseDetails.js';
import { deleteSplitwiseExpense, postToSplitwise } from '../helpers/helper-splitwise.js';

// Global variables
let SPLIT_WITH_PARTNER_TAG_NAME = "";
let SPLIT_WITH_PARTNER_ACCOUNT_ID = "";
let SPLITWISE_FRIEND_ID = "";
let SPLITWISE_USER_ID = 0;
let SPLITWISE_GROUP_ID = 0;

// Listen for the EXECUTE-TRANSACTIONS-VIEW from the content script
document.addEventListener('EXECUTE-TRANSACTIONS-VIEW', (event) => {
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
	SPLITWISE_GROUP_ID = customSettings.splitwiseGroupId;

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
			if (transactionIconContainer) transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Add the delete splitwise expense button to the button container
			const buttonDeleteSplitwiseExpense = document.createElement("button");
			buttonDeleteSplitwiseExpense.className = "monarch-helper-button-delete-splitwise-expense";
			const existingButton = document.querySelector('button[class*="Button"]');
			if (existingButton) buttonDeleteSplitwiseExpense.className += " " + existingButton.className;
			buttonDeleteSplitwiseExpense.innerHTML = "🗑️";
			buttonDeleteSplitwiseExpense.title = "Delete Splitwise Expense";
			buttonDeleteSplitwiseExpense.onclick = async (e) => await handleDeleteSplitwiseExpenseButtonClick(e, row);
			buttonContainer.appendChild(buttonDeleteSplitwiseExpense);
		}
	}
}

// Add a split button to the transaction row if it is not already present.
function addSplitButtonsIfNeeded(row: HTMLElement, customSettings: CustomSettings) {

	// Get the transaction row container
	// const transactionRowContainer = document.querySelector('div[class*="TransactionsList__TransactionRowContainer-sc-19oqvl6-5 dlebUq"]');

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
			if (transactionIconContainer) transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Add the split button to the button container
			const buttonSplit = document.createElement("button");
			buttonSplit.className = "monarch-helper-button-split";
			// Apply styles from an existing button
			const existingButton = document.querySelector('button[class*="Button"]');
			if (existingButton) buttonSplit.className += " " + existingButton.className;
			buttonSplit.innerHTML = "✂️";
			buttonSplit.title = "Split Transaction";
			buttonSplit.onclick = async (e) => await handleSplitButtonClick(e, row);
			buttonContainer.appendChild(buttonSplit);

			// Add the split and post to Splitwise button if enabled and not already posted
			if (customSettings.showPostToSplitwiseButton && !transactionDetails?.tags?.some(tag => tag.name === customSettings.transactionPostedToSplitwiseTagName)) {
				const buttonSplitAndPostToSW = document.createElement("button");
				buttonSplitAndPostToSW.className = "monarch-helper-button-splitwise";
				if (existingButton) buttonSplitAndPostToSW.className += " " + existingButton.className;
				buttonSplitAndPostToSW.innerHTML = "📤";
				buttonSplitAndPostToSW.title = "Split & Post to Splitwise";
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

		// If the transaction is already split, and the relevant setting is enabled, add the unsplit button
		if (isAlreadySplit && showUnsplitButtonForSplitTransactions) {

			// Create the button container
			const buttonContainer = document.createElement("div");
			buttonContainer.className = "button-container";

			// Insert the button container before the transaction icon container
			const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
			if (transactionIconContainer) transactionIconContainer?.parentNode?.insertBefore(buttonContainer, transactionIconContainer);

			// Add the unsplit button to the button container
			const buttonUnsplit = document.createElement("button");
			buttonUnsplit.className = "monarch-helper-button-unsplit";

			// Copy existing button class names
			const existingButton = document.querySelector('button[class*="Button"]');
			if (existingButton) buttonUnsplit.className += " " + existingButton.className;

			buttonUnsplit.innerHTML = "🔀"; // Merge/Split transaction button
			buttonUnsplit.title = "Unsplit Transaction";
			buttonUnsplit.onclick = async (e) => handleUnsplitButtonClick(e, row);
			buttonContainer.appendChild(buttonUnsplit);
		}
	}
}

// Handle the split button click event
async function handleSplitButtonClick(e: MouseEvent, row: HTMLElement) {
	if (e) e.stopPropagation();

	let transactionDetails = getTransactionDetailsForRow(row);

	// Call the graphql helper to split the transaction
	const response = await splitTransaction(transactionDetails);
	if (response?.data?.updateTransactionSplit.errors) {
		handleGlobalError(new Error("Error while splitting transaction ID " + transactionDetails?.id), "split_transaction");
		return false;
	}

	const splitTransactionId = response?.data?.updateTransactionSplit.transaction.splitTransactions[0].id;
	if (!splitTransactionId) throw new Error("No split transaction ID found");

	const result = await hideSplitTransaction(splitTransactionId);
	if (!result || result.errors) {
		handleGlobalError(new Error("Error while hiding split transaction ID " + splitTransactionId), "hide_split_transaction");
		return false;
	}

	const tagSplitTransactions = getCustomSettings().tagSplitTransactions;
	if (tagSplitTransactions && response?.data?.updateTransactionSplit.transaction.splitTransactions) {
		let success = await addTagsToSplitTransactions(transactionDetails, response.data.updateTransactionSplit.transaction.splitTransactions);
		if (!success) return false;
	}

	// Show a toast and hide the split button
	showToast(`Transaction ${transactionDetails?.id} split successfully!`, ToastType.SUCCESS);
	const splitButton = row.querySelector<HTMLElement>(".monarch-helper-button-split");
	if (splitButton) splitButton.style.display = "none";

	// Fire a success analytics event
	trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'split_transaction' });

	return true;
}

// Handle the unsplit button click event
async function handleUnsplitButtonClick(e: MouseEvent, row: HTMLElement) {
	e.stopPropagation();

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails) return false;

	const transactionDrawerDetails = await getTransactionDrawerDetails(transactionDetails);
	if (!transactionDrawerDetails?.data?.getTransaction?.originalTransaction?.id) {
		throw new Error("Missing original transaction ID");
	}

	const unsplitResponse = await unsplitTransaction(transactionDrawerDetails.data.getTransaction.originalTransaction.id);

	if (unsplitResponse?.data?.updateTransactionSplit.errors) {
		handleGlobalError(new Error("Error while unsplitting transaction ID " + transactionDrawerDetails.data.getTransaction.originalTransaction.id), "unsplit_transaction");
		return false;
	}

	showToast(`Transaction ${transactionDrawerDetails.data.getTransaction.originalTransaction.id} unsplit successfully!`, ToastType.SUCCESS);
	const unsplitButton = row.querySelector<HTMLElement>(".monarch-helper-button-unsplit");
	if (unsplitButton) unsplitButton.style.display = "none";

	// Fire a success analytics event
	trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'unsplit_transaction' });
}

// Handle splitting and posting to Splitwise
async function handleSplitAndPostToSWButtonClick(e: MouseEvent, row: HTMLElement) {
	if (e) e.stopPropagation();

	if (!SPLITWISE_FRIEND_ID) {
		showToast("No Splitwise friend selected in settings. Please configure a friend in MMM Extensions Custom Settings.", ToastType.ERROR);
		return false;
	}

	if (!SPLITWISE_USER_ID) {
		showToast("No Splitwise user ID found. Please ensure you're logged into Splitwise and try enabling Splitwise integration again.", ToastType.ERROR);
		return false;
	}

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails) return false;

	// Dont split it if the transaction is a "Credit Card Payment"
	if (!transactionDetails.category?.name?.toLowerCase().includes('credit card payment')) {
		const splitSuccess = await handleSplitButtonClick(e, row);
		if (!splitSuccess) return false;
	}

	try {
		// Get custom settings to check for utility handling and credit card payments
		const settings = getCustomSettings();
		let groupId = 0;
		let description = '';

		// If utilities are being handled and this category is in the utility categories list
		if (settings.handleUtilities &&
			transactionDetails.category?.id &&
			settings.utilityCategories.includes(transactionDetails.category.id)) {
			groupId = settings.splitwiseGroupId;
			const monthName = new Date(transactionDetails.date).toLocaleString('default', { month: 'long' });
			const year = transactionDetails.date.split("-")[0];
			description = `${transactionDetails.category.name} - ${monthName} ${year}`;
		}
		// If this is a credit card payment and credit card handling is enabled
		else if (settings.handleCreditCardPayments &&
			transactionDetails.category?.name?.toLowerCase().includes('credit card payment')) {
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

		var response = await postToSplitwise(expenseDetails, SPLITWISE_USER_ID, parseInt(SPLITWISE_FRIEND_ID));
		var splitwiseExpenseId = response.expenses[0].id;

		// add a tag to the transaction to indicate that it has been posted to Splitwise
		var postedToSplitwiseTagId = (await getTagIdWithTagName(getCustomSettings().transactionPostedToSplitwiseTagName))?.id;
		if (postedToSplitwiseTagId) {
			await setTransactionTags(transactionDetails.id, [postedToSplitwiseTagId]);
		}

		// add a note to the transaction and store the splitwise expense id
		await updateTransactionNotes(transactionDetails.id, `Splitwise Expense ID: ${splitwiseExpenseId}`);

		// Show a toast and hide the split button
		showToast(`Transaction posted to Splitwise successfully!`, ToastType.SUCCESS);
		const splitButton = row.querySelector<HTMLElement>(".monarch-helper-button-splitwise");
		if (splitButton) splitButton.style.display = "none";

		trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'post_to_splitwise' });

		return true;

	} catch (error) {
		handleGlobalError(error, "handleSplitAndPostToSWButtonClick");
		return false;
	}
}

// Handle the delete splitwise expense button click event
async function handleDeleteSplitwiseExpenseButtonClick(e: MouseEvent, row: HTMLElement) {
	e.stopPropagation();

	let transactionDetails = getTransactionDetailsForRow(row);
	if (!transactionDetails) return false;

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

		const deleteButton = row.querySelector<HTMLElement>(".monarch-helper-button-delete-splitwise-expense");
		if (deleteButton) deleteButton.style.display = "none";

		trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'delete_splitwise_expense' });

		return true;
	} catch (error) {
		handleGlobalError(error, "handleDeleteSplitwiseExpenseButtonClick");
		return false;
	}
}

// Add tags to the split transactions
async function addTagsToSplitTransactions(transactionDetails: Transaction | null, splitTransactions: SplitTransaction[]) {
	if (!transactionDetails || !splitTransactions) return false;

	// get the necessary tag IDs
	let splitWithPartnerTagId = (await getTagIdWithTagName(SPLIT_WITH_PARTNER_TAG_NAME))?.id;
	// Get all the tag IDs on the original transaction, thats not the split with partner tag
	let tagIds = transactionDetails.tags?.filter(tag => tag.id !== splitWithPartnerTagId).map(tag => tag.id) || [];
	// Add the split with partner tag ID to the tag list
	if (splitWithPartnerTagId) {
		if (tagIds.length > 0) {
			tagIds.push(splitWithPartnerTagId);
		} else {
			tagIds = [splitWithPartnerTagId];
		}
	}

	// Now apply tagIds on to the two split transactions. 
	let setTagsResponse1 = await setTransactionTags(splitTransactions[0].id, tagIds);
	if (setTagsResponse1.errors) {
		// handle via global error handler
		handleGlobalError(new Error("Error while setting tags on split transaction ID " + splitTransactions[0].id), "set_tags_on_split_transaction");
		return false;
	}

	let setTagsResponse2 = await setTransactionTags(splitTransactions[1].id, tagIds);
	if (setTagsResponse2.errors) {
		// handle via global error handler
		handleGlobalError(new Error("Error while setting tags on split transaction ID " + splitTransactions[1].id), "set_tags_on_split_transaction");
		return false;
	}

	// got this far, so fire a success event to the analytics
	trackGoogleAnalyticsEvent(AnalyticsEventType.SUCCESS, { eventName: 'add_tags_to_split_transactions' });
	return true;
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
						tags: transactionDetails.tags.map((tag: { id: string; name: string }) => ({
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



