// Helper function to call the GraphQL API
function callGraphQL(data) {
    var options = {
        mode: "cors",
        method: "POST",
        headers: {
            accept: "*/*",
            authorization: `Token ${getGraphqlToken()}`,
            "content-type": "application/json",
            origin: "https://app.monarchmoney.com",
        },
        body: JSON.stringify(data),
    };

    return fetch(GRAPHQL_URL, options)
        .then((response) => response.json())
        .then((data) => data.data)
        .catch((error) => {
            console.error(version, error);

            // determine what OperationName is being called. This can be found in the data object. Then show a toast accordingly
            if (data.operationName === "Common_SplitTransactionMutation") {
                showToast(`Error while splitting transaction ${transactionDetails.id}.`, "error");

            } else if (data.operationName === "Web_TransactionDrawerUpdateTransaction" && data.input.hideFromReports === true) {
                showToast(`Error while hiding transaction ${transactionDetails.id}.`, "error");

            } else if (data.operationName == "GetHouseholdTransactionTags") {
                showToast(`Error while fetching tag details for ${SplitWithDebTagName}.`, "error");

            } else if (data.operationName == "Web_SetTransactionTags") {
                showToast(`Error while setting tags on transaction ${transactionDetails.id}.`, "error");

            } else {
                showToast(`Error while invoking GraphQL API for transaction ${transactionDetails.id}.`, "error");
            }
        });
}

// Helper function to get the GraphQL token from localStorage
const getGraphqlToken = () => JSON.parse(JSON.parse(localStorage.getItem("persist:root")).user).token;

// Hide a split transaction
async function hideSplitTransaction(transactionId) {
    const json = {
        operationName: "Web_TransactionDrawerUpdateTransaction",
        variables: {
            input: {
                id: transactionId,
                hideFromReports: true
            }
        },
        query: `mutation Web_TransactionDrawerUpdateTransaction($input: UpdateTransactionMutationInput!) {
            updateTransaction(input: $input) {
                transaction {
                    id
                    amount
                    pending
                    date
                    hideFromReports
                    needsReview
                    reviewedAt
                    reviewedByUser {
                        id
                        name
                        __typename
                    }
                    plaidName
                    notes
                    isRecurring
                    category {
                        id
                        __typename
                    }
                    goal {
                        id
                        __typename
                    }
                    merchant {
                        id
                        name
                        __typename
                    }
                    __typename
                }
                errors {
                    ...PayloadErrorFields
                    __typename
                }
                __typename
            }
        }
        
        fragment PayloadErrorFields on PayloadError {
            fieldErrors {
                field
                messages
                __typename
            }
            message
            code
            __typename
        }`
    };

    return await graphqlHelpers.callGraphQL(json);

}

// Get the tag details by name
async function getTagIdWithTagName(tagName) {
    const json = {
        operationName: "GetHouseholdTransactionTags",
        variables: {},
        query: `query GetHouseholdTransactionTags {
            householdTransactionTags {
                id
                name
                color
                order
                transactionCount
                __typename
            }
        }`
    };

    const response = await graphqlHelpers.callGraphQL(json);
    const tags = response.householdTransactionTags;

    return tagName ? tags.find(t => t.name === tagName) : tags; // Return tag object or all tags if tagName is not provided
}

// Set tags for a transaction. TagIds is an array of tag IDs
async function setTransactionTags(transactionId, tagIds) {
    const json = {
        operationName: "Web_SetTransactionTags",
        variables: {
            input: {
                transactionId: transactionId,
                tagIds: tagIds
            }
        },
        query: `mutation Web_SetTransactionTags($input: SetTransactionTagsInput!) {
            setTransactionTags(input: $input) {
                errors {
                    ...PayloadErrorFields
                    __typename
                }
                transaction {
                    id
                    tags {
                        id
                        __typename
                    }
                    __typename
                }
                __typename
            }
        }
        
        fragment PayloadErrorFields on PayloadError {
            fieldErrors {
                field
                messages
                __typename
            }
            message
            code
            __typename
        }`
    };

    return await graphqlHelpers.callGraphQL(json);
}

// Split a transaction and tag it with the given category and tags
async function splitTransaction(transactionDetails, row) {
    // Check if the transaction is not already split
    if (!transactionDetails.hasSplitTransactions && !transactionDetails.isSplitTransaction) {
        // Calculate the split amount
        const totalAmount = parseFloat(transactionDetails.amount);
        const splitAmount = Math.round((totalAmount / 2) * 100) / 100; // Round to 2 decimal places
        const amount1 = splitAmount;
        const amount2 = totalAmount - splitAmount;

        // Create the GraphQL payload
        const payload = {
            operationName: "Common_SplitTransactionMutation",
            variables: {
                input: {
                    transactionId: transactionDetails.id,
                    splitData: [
                        {
                            merchantName: transactionDetails.merchant.name,
                            categoryId: transactionDetails.category.id,
                            amount: amount1,
                        },
                        {
                            merchantName: transactionDetails.merchant.name,
                            categoryId: transactionDetails.category.id,
                            amount: amount2,
                        },
                    ],
                },
            },
            query: `mutation Common_SplitTransactionMutation($input: UpdateTransactionSplitMutationInput!) {
                updateTransactionSplit(input: $input) {
                    errors {
                        ...PayloadErrorFields
                        __typename
                    }
                    transaction {
                        id
                        hasSplitTransactions
                        splitTransactions {
                            id
                            merchant {
                                id
                                name
                                __typename
                            }
                            category {
                                id
                                icon
                                name
                                __typename
                            }
                            amount
                            notes
                            __typename
                        }
                        __typename
                    }
                    __typename
                }
            }
            
            fragment PayloadErrorFields on PayloadError {
                fieldErrors {
                    field
                    messages
                    __typename
                }
                message
                code
                __typename
            }`,
        };

        return await graphqlHelpers.callGraphQL(payload);
    }
}

// Get the transaction drawer details
async function getTransactionDrawerDetails(transactionDetails, row) {
    // Check if the transaction is already split
    if (transactionDetails.isSplitTransaction) {

        // Create the GraphQL payload to get transaction drawer details
        const payload = {
            operationName: "GetTransactionDrawer",
            variables: {
                id: transactionDetails.id,
                redirectPosted: true
            },
            query: `query GetTransactionDrawer($id: UUID!, $redirectPosted: Boolean) {
                getTransaction(id: $id, redirectPosted: $redirectPosted) {
                    id
                    ...TransactionDrawerFields
                    __typename
                }
                myHousehold {
                    id
                    users {
                        id
                        name
                        __typename
                    }
                    __typename
                }
            }

            fragment TransactionDrawerSplitMessageFields on Transaction {
                id
                amount
                merchant {
                    id
                    name
                    __typename
                }
                category {
                    id
                    icon
                    name
                    __typename
                }
                __typename
            }

            fragment OriginalTransactionFields on Transaction {
                id
                date
                amount
                merchant {
                    id
                    name
                    __typename
                }
                __typename
            }

            fragment AccountLinkFields on Account {
                id
                displayName
                icon
                logoUrl
                id
                __typename
            }

            fragment TransactionOverviewFields on Transaction {
                id
                amount
                pending
                date
                hideFromReports
                plaidName
                notes
                isRecurring
                reviewStatus
                needsReview
                isSplitTransaction
                dataProviderDescription
                attachments {
                    id
                    __typename
                }
                category {
                    id
                    name
                    icon
                    group {
                        id
                        type
                        __typename
                    }
                    __typename
                }
                merchant {
                    name
                    id
                    transactionsCount
                    logoUrl
                    recurringTransactionStream {
                        frequency
                        isActive
                        __typename
                    }
                    __typename
                }
                tags {
                    id
                    name
                    color
                    order
                    __typename
                }
                account {
                    id
                    displayName
                    icon
                    logoUrl
                    __typename
                }
                __typename
            }

            fragment TransactionDrawerFields on Transaction {
                id
                amount
                pending
                isRecurring
                date
                originalDate
                hideFromReports
                needsReview
                reviewedAt
                reviewedByUser {
                    id
                    name
                    __typename
                }
                plaidName
                notes
                hasSplitTransactions
                isSplitTransaction
                isManual
                splitTransactions {
                    id
                    ...TransactionDrawerSplitMessageFields
                    __typename
                }
                originalTransaction {
                    id
                    ...OriginalTransactionFields
                    __typename
                }
                attachments {
                    id
                    publicId
                    extension
                    sizeBytes
                    filename
                    originalAssetUrl
                    __typename
                }
                account {
                    id
                    hideTransactionsFromReports
                    ...AccountLinkFields
                    __typename
                }
                category {
                    id
                    __typename
                }
                goal {
                    id
                    __typename
                }
                merchant {
                    id
                    name
                    transactionCount
                    logoUrl
                    recurringTransactionStream {
                        id
                        frequency
                        __typename
                    }
                    __typename
                }
                tags {
                    id
                    name
                    color
                    order
                    __typename
                }
                needsReviewByUser {
                    id
                    __typename
                }
                ...TransactionOverviewFields
                __typename
            }`
        };

        return await graphqlHelpers.callGraphQL(payload);
    }
}

// Unsplit a transaction
async function unsplitTransaction(originalTransactionId) {
    const payload = {
        operationName: "Common_SplitTransactionMutation",
        variables: {
        input: {
            transactionId: originalTransactionId,
            splitData: []
        }
    },
    query: `mutation Common_SplitTransactionMutation($input: UpdateTransactionSplitMutationInput!) {
        updateTransactionSplit(input: $input) {
            errors {
                ...PayloadErrorFields
                __typename
            }
            transaction {
                id
                hasSplitTransactions
                splitTransactions {
                    id
                    amount
                    notes
                    hideFromReports
                    reviewStatus
                    merchant {
                        id
                        name
                        __typename
                    }
                    category {
                        id
                        icon
                        name
                        __typename
                    }
                    goal {
                        id
                        __typename
                    }
                    needsReviewByUser {
                        id
                        __typename
                    }
                    tags {
                        id
                        __typename
                    }
                    __typename
                }
                __typename
            }
            __typename
        }
    }

    fragment PayloadErrorFields on PayloadError {
        fieldErrors {
            field
            messages
            __typename
        }
        message
                code
                __typename
            }`
    };

    return await graphqlHelpers.callGraphQL(payload);  
}

async function getAllAccountDetails() {
    const payload = {
        operationName: "Web_GetAccountsPage",
        variables: {},
        query: `query Web_GetAccountsPage {
        hasAccounts
        accountTypeSummaries {
            type {
                name
                display
                group
                __typename
            }
            accounts {
                id
                ...AccountsListFields
                __typename
            }
            isAsset
            totalDisplayBalance
            __typename
        }
        householdPreferences {
            id
            accountGroupOrder
            __typename
            }
        }

        fragment AccountMaskFields on Account {
            id
            mask
            subtype {
                display
                __typename
            }
            __typename
        }

        fragment InstitutionStatusTooltipFields on Institution {
            id
            logo
            name
            status
            plaidStatus
            newConnectionsDisabled
            hasIssuesReported
            url
            hasIssuesReportedMessage
            transactionsStatus
            balanceStatus
            __typename
        }

        fragment AccountListItemFields on Account {
            id
            displayName
            displayBalance
            signedBalance
            updatedAt
            syncDisabled
            icon
            logoUrl
            isHidden
            isAsset
            includeInNetWorth
            includeBalanceInNetWorth
            displayLastUpdatedAt
            ...AccountMaskFields
            credential {
                id
                updateRequired
                dataProvider
                disconnectedFromDataProviderAt
                syncDisabledAt
                syncDisabledReason
                __typename
            }
            institution {
                id
                ...InstitutionStatusTooltipFields
                __typename
            }
            __typename
        }

        fragment AccountsListFields on Account {
            id
            syncDisabled
            isHidden
            isAsset
            includeInNetWorth
            order
            type {
                name
                display
                __typename
                    }
                    ...AccountListItemFields
                    __typename
                }`
        };  

    return await graphqlHelpers.callGraphQL(payload);  
}

// Export the functions to be used in the main script
window.graphqlHelpers = {
    callGraphQL: callGraphQL,
    getGraphqlToken: getGraphqlToken,
    getTagIdWithTagName: getTagIdWithTagName,
    setTransactionTags: setTransactionTags,
    hideSplitTransaction: hideSplitTransaction,
    unsplitTransaction: unsplitTransaction,
    getTransactionDrawerDetails: getTransactionDrawerDetails,
    splitTransaction: splitTransaction,
    getAllAccountDetails: getAllAccountDetails
}

