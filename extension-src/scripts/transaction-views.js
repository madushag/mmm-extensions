// Global variables
let SPLIT_WITH_PARTNER_TAG_NAME = "";
let SPLIT_WITH_PARTNER_ACCOUNT_ID = "";
let customSettingsValues = {};

// Listen for the CustomEvent from the content script
document.addEventListener('EXECUTE', (event) => {
    // Bootstrap settings   
    customSettingsValues = getCustomSettings();

    mainHandler();
});

// Main handler function in the injected script
function mainHandler() {

    SPLIT_WITH_PARTNER_TAG_NAME = customSettingsValues.splitWithPartnerTagName;
    SPLIT_WITH_PARTNER_ACCOUNT_ID = customSettingsValues.splitWithPartnerAccountId;

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
            addSplitButtonsIfNeeded(row);
            addUnsplitButtonIfNeeded(row);
        });
    }
}

// Add a split button to the transaction row if it is not already present.
function addSplitButtonsIfNeeded(row) {

    // Get the transaction row container
    const transactionRowContainer = document.querySelector('div[class*="TransactionsList__TransactionRowContainer-sc-19oqvl6-5 dlebUq"]');

    // Get the transaction details
    let transactionDetails = getTransactionDetailsForRow(row);

    // Get the settings
    const showSplitButtonForUnsplitTransactions = customSettings.getConfigValue("showSplitButtonForUnsplitTransactions", customSettingsValues);
    const showSplitButtonOnAllAccounts = customSettings.getConfigValue("showSplitButtonOnAllAccounts", customSettingsValues);

    // Check if the split button is already present, and if not, add it
    if (!row.querySelector(".monarch-helper-button-split")) {
        // Check if the transaction is already split
        let isAlreadySplit = transactionDetails.isSplitTransaction;

        // If the transaction is not already split, only then add the button
        if (!isAlreadySplit) {

            // Check if the split button should be shown. This is based on the settings and the account ID of the transaction
            if (showSplitButtonForUnsplitTransactions && (showSplitButtonOnAllAccounts || transactionDetails.accountId === SPLIT_WITH_PARTNER_ACCOUNT_ID)) {
               
                // Create the button container
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

    // Get the settings
    let showUnsplitButtonForSplitTransactions = customSettings.getConfigValue("showUnsplitButtonForSplitTransactions", customSettingsValues);

    // Check if the unsplit button is already present, and if not, add it
    if (!row.querySelector(".monarch-helper-button-unsplit")) {
        // Check if the transaction is already split
        let isAlreadySplit = getTransactionDetailsForRow(row).isSplitTransaction;

        // If the transaction is already split, and the relevant setting is enabled, add the unsplit button
        if (isAlreadySplit && showUnsplitButtonForSplitTransactions) {

            // Create the button container
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

    // Call the graphql helper to split the transaction
    await graphqlHelpers.splitTransaction(transactionDetails, row)
        .then(response => {
            // Check if there were any errors, and if so, show an error toast and fire an error event
            if (response?.updateTransactionSplit.errors) {
                showToast(`Error while splitting transaction ID ${transactionDetails.id}.`, "error");
                document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR', { detail: { eventName: "split_transaction" } }));
                
                return false;
            }

            // Get the split transaction ID
            const splitTransactionId = response.updateTransactionSplit.transaction.splitTransactions[0].id;

            // Call the graphql helper to hide the split transaction
            return graphqlHelpers.hideSplitTransaction(splitTransactionId)
                .then(hideResponse => {
                    // Check if there were any errors, and if so, show an error toast and fire an error event
                    if (hideResponse?.updateTransaction.errors) {
                        showToast(`Error while hiding transaction ID ${splitTransactionId}.`, "error");
                        document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR', { detail: { eventName: "split_transaction" } }));

                        return false;
                    }

                    // Add tags to the split transactions if the setting is enabled
                    const tagSplitTransactions = customSettings.getConfigValue("tagSplitTransactions", customSettingsValues);
                    if (tagSplitTransactions) {
                        // Call the graphql helper to add tags to the split transactions
                        return addTagsToSplitTransactions(transactionDetails, response.updateTransactionSplit.transaction.splitTransactions)
                            .then(success => {
                                // If successful, show a success toast
                                if (success) showToast(`Transaction ${transactionDetails.id} split successfully!`, "success");

                                // Hide the split button
                                row.querySelector(".monarch-helper-button-split").style.display = "none";
                                return true;
                            });
                    }
                    else {  
                        // If the tags are not being added, show a success toast
                        showToast(`Transaction ${transactionDetails.id} split successfully!`, "success");

                        // Hide the split button
                        row.querySelector(".monarch-helper-button-split").style.display = "none";
                        return true;
                    }
                });
        });

    // Fire a success analytics event
    document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_SUCCESS', { detail: { eventName: "split_transaction" } }));
}

// Handle the unsplit button click event
async function handleUnsplitButtonClick(e, row) {
    e.stopPropagation();

    let transactionDetails = getTransactionDetailsForRow(row);

    // Call the graphql helper to get the transaction drawer details
    await graphqlHelpers.getTransactionDrawerDetails(transactionDetails, row)
        .then(transactionDrawerDetails => {
            // Call the graphql helper to unsplit the transaction
            return graphqlHelpers.unsplitTransaction(transactionDrawerDetails.getTransaction.originalTransaction.id)
                .then(unsplitResponse => {
                    // Check if there were any errors, and if so, show an error toast and fire an error event
                    if (unsplitResponse?.updateTransactionSplit.errors) {
                        showToast(`Error while unsplitting transaction ID ${transactionDrawerDetails.getTransaction.originalTransaction.id}.`, "error");
                        document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR', { detail: { eventName: "unsplit_transaction" } }));

                        return false;
                    }

                    // Show a success toast
                    showToast(`Transaction ${transactionDrawerDetails.getTransaction.originalTransaction.id} unsplit successfully!`, "success");

                    // Hide the unsplit button  
                    row.querySelector(".monarch-helper-button-unsplit").style.display = "none";
                    
                    return true;
                });
        });

    // Fire a success analytics event
    document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_SUCCESS', { detail: { eventName: "unsplit_transaction" } }));
}   

// Add tags to the split transactions
async function addTagsToSplitTransactions(transactionDetails, splitTransactions) {
    // get the necessary tag IDs
    var splitWithPartnerTagId = (await graphqlHelpers.getTagIdWithTagName(SPLIT_WITH_PARTNER_TAG_NAME))?.id;

    // Get all the tag IDs on the original transaction, thats not the split with partner tag
    let tagIds = transactionDetails.tags
        .filter(tag => tag.id !== splitWithPartnerTagId)
        .map(tag => tag.id);

    // Add the split with partner tag ID to the tag list
    if (tagIds.length > 0) {
        tagIds.push(splitWithPartnerTagId);
    } else {
        tagIds = [splitWithPartnerTagId];
    }

    // Now apply tagIds on to the two split transactions. 
    // Check for errors in the result and return a success message if there are no errors
    var setTagsResponse1 = await graphqlHelpers.setTransactionTags(splitTransactions[0].id, tagIds);
    var setTagsResponse2 = await graphqlHelpers.setTransactionTags(splitTransactions[1].id, tagIds);

    // Check for errors in the result and return a success message if there are no errors
    if (setTagsResponse1.setTransactionTags.errors === null && setTagsResponse2.setTransactionTags.errors === null) {
        // If successful, fire a success analytics event
        document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_SUCCESS', { detail: { eventName: "add_tags_to_split_transactions" } }));
        return true;
    }
    else {
        // Else if there were errors, fire an error analytics event
        document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR', { detail: { eventName: "add_tags_to_split_transactions" } }));
        return false;
    }
}

//---------------------- HELPER FUNCTIONS ----------------------

// Return attributes of a transaction for a given row by accessing the React fiber of the drawer toggle
function getTransactionDetailsForRow(row) {
    let result = null;

    // Get the drawer toggle
    const drawerToggle = row.querySelector("button.fs-drawer-toggle");
    if (drawerToggle) {
        // Get the React fiber key
        const key = Object.keys(drawerToggle).find((key) => key.startsWith("__reactFiber$"));
        if (key) {
            // Get the fiber
            let fiber = drawerToggle[key];

            // Traverse the fiber to find the transaction details
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

                // Traverse the fiber to the parent
                fiber = fiber.return;
            }
        }
    }

    // Return the transaction details
    return result;
}

// Function to show a toast notification. Include a fade out duration parameter in seconds
function showToast(message, type = "success", fadeOutDuration = 5) {
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.innerText = message;

    // Add the toast to the body
    document.body.appendChild(toast);

    // Fade out the toast after the specified duration
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 1000);
    }, fadeOutDuration * 1000);
}

