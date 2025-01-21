// ==UserScript==
// @name         Maddy's Monarch Money Extensions
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enhance Monarch Money functionality
// @author       Maddy G.
// @match        https://app.monarchmoney.com/*
// @run-at       document-idle
// @resource     MMMCSS https://raw.githubusercontent.com/madushag/mmm-tweaks/refs/heads/main/mmm-styles.css
// @require      https://raw.githubusercontent.com/madushag/mmm-tweaks/refs/heads/main/MMM-custom-settings.js
// @require      https://raw.githubusercontent.com/madushag/mmm-tweaks/refs/heads/main/mmm-helpers-graphql.js
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

const version = "1.0";
const GRAPHQL_URL = "https://api.monarchmoney.com/graphql"; // Ensure this is defined
let SPLIT_WITH_PARTNER_TAG_NAME = "";
let SPLIT_WITH_PARTNER_ACCOUNT_ID = "";

// Create a MutationObserver to watch for changes in the URL
const observer = new MutationObserver(() => onPageStructureChanged());

// Start observing the document for changes in the child nodes
observer.observe(document, { childList: true, subtree: true });

// Core logic to handle the split button
async function onPageStructureChanged() {

    injectStylesIfNeeded();
    SPLIT_WITH_PARTNER_TAG_NAME = customSettings.getConfigValue("splitWithPartnerTagName");
    SPLIT_WITH_PARTNER_ACCOUNT_ID = customSettings.getConfigValue("splitWithPartnerAccountId");

    // Check if the page is the transactions page or the accounts details page
    if (window.location.href.includes("transactions") || window.location.href.includes("accounts/details")) {
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

            // If there are transactions, stop checking for them
            if (transactionRows.length > 0) {
                clearInterval(checkForTransactions);

                // Use a single event listener for all buttons
                transactionRows.forEach((row) => {
                    addSplitButtonsIfNeeded(row);
                    addUnsplitButtonIfNeeded(row);
                });
            }
        }, 1000);
    }

    if (window.location.href.includes("settings/")) {
        customSettings.addCustomSettingsLink();
    }
}

// Add two split buttons to the transaction row if it is not already present.
function addSplitButtonsIfNeeded(row) {
    const transactionDetails = getTransactionDetailsForRow(row);
    const showSplitButtonForUnsplitTransactions = customSettings.getConfigValue("showSplitButtonForUnsplitTransactions");
    const showSplitButtonOnAllAccounts = customSettings.getConfigValue("showSplitButtonOnAllAccounts");

    // Check if the split button is already present
    if (!row.querySelector(".monarch-helper-button-split")) {
        // Check if the transaction is already split
        let isAlreadySplit = transactionDetails.isSplitTransaction;

        // If the transaction is not already split, add the buttons
        if (!isAlreadySplit) {
            // Check if this is a transaction that should be split and the split button should be shown
            if (showSplitButtonForUnsplitTransactions && (showSplitButtonOnAllAccounts || transactionDetails.accountId === SPLIT_WITH_PARTNER_ACCOUNT_ID)) {
               
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "button-container";

                // Insert the button container before the transaction icon container
                const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
                if (transactionIconContainer) transactionIconContainer.parentNode.insertBefore(buttonContainer, transactionIconContainer);

                // Add the split button to the button container
                const buttonSplit = document.createElement("button");
                buttonSplit.className = "monarch-helper-button-split";

                // Copy existing button class names
                const existingButton = document.querySelector('button[class*="Button"]');
                if (existingButton) buttonSplit.className += " " + existingButton.className;

                buttonSplit.innerHTML = "✂️";
                buttonSplit.title = "Split Transaction";
                buttonSplit.onclick = async (e) => await handleSplitButtonClick(e, row);
                buttonContainer.appendChild(buttonSplit);
            }
        }
    }
}

// Add an unsplit button to the transaction row if it is not already present.
function addUnsplitButtonIfNeeded(row) {

    let showUnsplitButtonForSplitTransactions = customSettings.getConfigValue("showUnsplitButtonForSplitTransactions");

    // Check if the unsplit button is already present
    if (!row.querySelector(".monarch-helper-button-unsplit")) {
        // Check if the transaction is already split
        let isAlreadySplit = getTransactionDetailsForRow(row).isSplitTransaction;

        // If the transaction is already split, add the unsplit button
        if (isAlreadySplit && showUnsplitButtonForSplitTransactions) {
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "button-container";

            // Insert the button container before the transaction icon container
            const transactionIconContainer = row.querySelector('div[class*="TransactionOverview__Icons"]');
            if (transactionIconContainer) transactionIconContainer.parentNode.insertBefore(buttonContainer, transactionIconContainer);

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
async function handleSplitButtonClick(e, row) {
    if (e) e.stopPropagation();
    let transactionDetails = getTransactionDetailsForRow(row);

    await graphqlHelpers.splitTransaction(transactionDetails, row)
        .then(response => {
            if (response?.updateTransactionSplit.errors) {
                showToast(`Error while splitting transaction ID ${transactionDetails.id}.`, "error");
                return false;
            }
            const splitTransactionId = response.updateTransactionSplit.transaction.splitTransactions[0].id;
            return graphqlHelpers.hideSplitTransaction(splitTransactionId)
                .then(hideResponse => {
                    if (hideResponse?.updateTransaction.errors) {
                        showToast(`Error while hiding transaction ID ${splitTransactionId}.`, "error");
                        return false;
                    }

                    // Add tags to the split transactions if the setting is enabled
                    const tagSplitTransactions = customSettings.getConfigValue("tagSplitTransactions");
                    if (tagSplitTransactions) {
                        return addTagsToSplitTransactions(transactionDetails, response.updateTransactionSplit.transaction.splitTransactions)
                        .then(success => {
                            if (success) showToast(`Transaction ${transactionDetails.id} split successfully!`, "success");

                            // hide the split button
                            row.querySelector(".monarch-helper-button-split").style.display = "none";
                            return true;
                        });
                    }
                    else {  
                        showToast(`Transaction ${transactionDetails.id} split successfully!`, "success");
                        // hide the split button
                        row.querySelector(".monarch-helper-button-split").style.display = "none";
                        return true;
                    }
                });
        });
}

async function handleUnsplitButtonClick(e, row) {
    e.stopPropagation();
    let transactionDetails = getTransactionDetailsForRow(row);

    await graphqlHelpers.getTransactionDrawerDetails(transactionDetails, row)
        .then(transactionDrawerDetails => 
            graphqlHelpers.unsplitTransaction(transactionDrawerDetails.getTransaction.originalTransaction.id)
                .then(unsplitResponse => {
                    if (unsplitResponse?.updateTransactionSplit.errors) {
                        showToast(`Error while unsplitting transaction ID ${transactionDrawerDetails.getTransaction.originalTransaction.id}.`, "error");
                        return false;
                    }
                    showToast(`Transaction ${transactionDrawerDetails.getTransaction.originalTransaction.id} unsplit successfully!`, "success");

                    // hide the unsplit button  
                    row.querySelector(".monarch-helper-button-unsplit").style.display = "none";
                    
                    return true;
                })
        );
}   

// Add tags to the split transactions
async function addTagsToSplitTransactions(transactionDetails, splitTransactions) {
    // get the necessary tag IDs
    var splitWithDebTagId = (await graphqlHelpers.getTagIdWithTagName(SPLIT_WITH_PARTNER_TAG_NAME))?.id;

    // Get all the tag IDs on the original transaction, thats not the split with deb tag
    let tagIds = transactionDetails.tags
        .filter(tag => tag.id !== splitWithDebTagId)
        .map(tag => tag.id);

    // Add the split with deb tag ID to the tag list
    if (tagIds.length > 0) {
        tagIds.push(splitWithDebTagId);
    } else {
        tagIds = [splitWithDebTagId];
    }

    // Now apply tagIds on to the two split transactions. 
    // Check for errors in the result and return a success message if there are no errors
    var setTagsResponse1 = await graphqlHelpers.setTransactionTags(splitTransactions[0].id, tagIds);
    var setTagsResponse2 = await graphqlHelpers.setTransactionTags(splitTransactions[1].id, tagIds);

    // Check for errors in the result and return a success message if there are no errors
    if (setTagsResponse1.setTransactionTags.errors === null && setTagsResponse2.setTransactionTags.errors === null) {
        return true;
    }
    else {
        return false;
    }
}

//---------------------- HELPER FUNCTIONS ----------------------

// Inject the styles if they are not already injected
function injectStylesIfNeeded() {
    if (!document.getElementById("mmm-toast-styles")) {
        const css = GM_getResourceText("MMMCSS");
        const style = document.createElement("style");
        style.id = "mmm-toast-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }
}

// Return attributes of a transaction for a given row by accessing the React fiber of the drawer toggle
function getTransactionDetailsForRow(row) {
    let result = null;
    const drawerToggle = row.querySelector("button.fs-drawer-toggle");
    if (drawerToggle) {
        const key = Object.keys(drawerToggle).find((key) =>
            key.startsWith("__reactFiber$")
        );
        if (key) {
            let fiber = drawerToggle[key];
            while (fiber) {
                if (fiber.memoizedProps?.transaction) {
                    let transactionDetails = fiber.memoizedProps.transaction;
                    result = {
                        id: transactionDetails.id,
                        accountId: transactionDetails.account.id,
                        amount: transactionDetails.amount,
                        date: transactionDetails.date,
                        hasSplitTransactions: transactionDetails.hasSplitTransactions,
                        isSplitTransaction: transactionDetails.isSplitTransaction,
                        merchant: { name: transactionDetails.merchant.name },
                        category: { 
                            id: transactionDetails.category.id, 
                            name: transactionDetails.category.name 
                        },
                        notes: transactionDetails.notes,
                        tags: transactionDetails.tags.map((tag) => ({
                            id: tag.id,
                            name: tag.name,
                        })),
                    };
                    break;
                }
                fiber = fiber.return;
            }
        }
    }
    return result;
}

// Function to show a toast notification. Include a fade out duration parameter in seconds
function showToast(message, type = "success", fadeOutDuration = 5) {
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.innerText = message;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 1000);
    }, fadeOutDuration * 1000);
}
