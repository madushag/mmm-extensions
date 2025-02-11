/******************************************************************************************/
/* This file contains the helper functions for interacting with the Monarch Money GraphQL API.
/* It provides functionality to:
/* - Execute GraphQL queries and mutations
/* - Handle transaction operations (split, unsplit, tags)
/* - Manage account details and transaction drawer information
/* - Interface with Splitwise for expense sharing
/******************************************************************************************/

import { UpdateTransactionResponse } from "../types/graphql-responses/updateTransactionResponse";
import { SetTransactionTagsResponse } from "../types/graphql-responses/setTransactionTagsResponse";
import { GetTransactionDetailsResponse } from "../types/graphql-responses/getTransactionDetailsResponse";
import { UpdateTransactionSplitResponse } from "../types/graphql-responses/updateTransactionSplitResponse";
import { GraphQLResponse } from "../types/graphql-responses/graphQLResponse";
import { Transaction } from "../types/entities/Transaction";
import { Account } from "../types/entities/Account";
import { AccountTypeSummary } from "../types/entities/AccountTypeSummary";
import { HouseholdTransactionTag } from "../types/entities/HouseholdTransactionTag";
import { showToast, ToastType } from "../toast.js";
import { Category } from "../types/entities/Category";

const GRAPHQL_URL = "https://api.monarchmoney.com/graphql";
const SPLITWISE_API_URL = "https://secure.splitwise.com/api/v3.0/create_expense";
const GROUP_ID = 0;
const HomeRevereSWGroupId = 1708251;

// Helper function to get the GraphQL token from localStorage
const getGraphqlToken = (): string => {
	const user = JSON.parse(JSON.parse(localStorage.getItem("persist:root") || '{}').user || '{}');
	return user.token;
};

// Helper function to call the GraphQL API
export async function callGraphQL(data: any): Promise<GraphQLResponse> {
	const options = {
		method: "POST",
		headers: {

			accept: "*/*",
			authorization: `Token ${getGraphqlToken()}`,
			"content-type": "application/json",
			origin: "https://app.monarchmoney.com",
		},
		body: JSON.stringify(data),
	};

	try {
		const response = await fetch(GRAPHQL_URL, options);
		return response.json();
	} catch (error) {
		console.error(error);
		if (data.operationName === "Common_SplitTransactionMutation") {
			showToast(`Error while splitting transaction.`, ToastType.ERROR);
		} else if (data.operationName === "Web_TransactionDrawerUpdateTransaction") {
			showToast(`Error while hiding transaction.`, ToastType.ERROR);
		} else if (data.operationName === "GetHouseholdTransactionTags") {
			showToast(`Error while fetching tag details.`, ToastType.ERROR);
		} else if (data.operationName === "Web_SetTransactionTags") {
			showToast(`Error while setting tags on transaction.`, ToastType.ERROR);
		} else if (data.operationName === "ManageGetCategoryGroups") {
			showToast(`Error while fetching category details.`, ToastType.ERROR);
		} else {
			showToast(`Error while invoking GraphQL API.`, ToastType.ERROR);
		}
		return { errors: [error] };
	}
}

// Hide a split transaction
export async function hideSplitTransaction(transactionId: string): Promise<UpdateTransactionResponse> {
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

	return await callGraphQL(json);
}

// Get all tags
export async function getAllTags(): Promise<HouseholdTransactionTag[]> {
	const json = {
		operationName: "GetHouseholdTransactionTags",
		variables: { includeTransactionCount: false },
		query: `query GetHouseholdTransactionTags($search: String, $limit: Int, $bulkParams: BulkTransactionDataParams, $includeTransactionCount: Boolean = false) {
            householdTransactionTags(
                search: $search
                limit: $limit
                bulkParams: $bulkParams
            ) {
                id
                name
                color
                order
                transactionCount @include(if: $includeTransactionCount)
                __typename
            }
        }`
	};

	const response = await callGraphQL(json);
	return response.data?.householdTransactionTags || [];
}

// Get the tag details by name
export async function getTagIdWithTagName(tagName?: string): Promise<HouseholdTransactionTag | null> {
	const tags = await getAllTags();
	return tagName ? tags.find(t => t.name === tagName)! : null;
}

// Set tags for a transaction. TagIds is an array of tag IDs
export async function setTransactionTags(transactionId: string, tagIds: string[]): Promise<SetTransactionTagsResponse> {
	const json = {
		operationName: "Web_SetTransactionTags",
		variables: {
			input: {
				transactionId,
				tagIds
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

	return await callGraphQL(json);
}

// Split a transaction and tag it with the given category and tags
export async function splitTransaction(transactionDetails: Transaction | null): Promise<UpdateTransactionSplitResponse | null> {
	if (!transactionDetails) return null;

	if (!transactionDetails.hasSplitTransactions && !transactionDetails.isSplitTransaction) {
		const totalAmount = parseFloat(transactionDetails.amount.toString());

		const splitAmount = Math.round((totalAmount / 2) * 100) / 100;
		const amount1 = splitAmount;
		const amount2 = totalAmount - splitAmount;

		const payload = {
			operationName: "Common_SplitTransactionMutation",
			variables: {
				input: {
					transactionId: transactionDetails.id,
					splitData: [
						{
							merchantName: transactionDetails.merchant?.name ?? '',
							categoryId: transactionDetails.category?.id ?? '',
							amount: amount1,
						},
						{
							merchantName: transactionDetails.merchant?.name ?? '',
							categoryId: transactionDetails.category?.id ?? '',
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

		return await callGraphQL(payload);
	}
	return null;

}

// Get the transaction drawer details
export async function getTransactionDrawerDetails(transactionDetails: Transaction): Promise<GetTransactionDetailsResponse | null> {
	if (transactionDetails.isSplitTransaction) {
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

		return await callGraphQL(payload);
	}
	return null;
}

// Unsplit a transaction
export async function unsplitTransaction(originalTransactionId: string): Promise<UpdateTransactionSplitResponse> {
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

	return await callGraphQL(payload);
}

// Get all account details
export async function getAllAccountDetails(): Promise<{ id: string; name: string }[]> {
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

	const result = (await callGraphQL(payload)).data?.accountTypeSummaries as AccountTypeSummary[];
	const accountIdsNames = result
		.flatMap((summary: AccountTypeSummary) => summary.accounts)
		.map(account => ({ id: account.id, name: account.displayName }))
		.sort((a, b) => a.name.localeCompare(b.name));

	return accountIdsNames;
}

// Get all categories
export async function getAllCategories(): Promise<Category[]> {
	const payload = {
		operationName: "ManageGetCategoryGroups",
		variables: {},
		query: `query ManageGetCategoryGroups {
			categoryGroups {
				id
				name
				order
				type
				__typename
			}
			categories(includeDisabledSystemCategories: false) {
				id
				name
				order
				icon
				isSystemCategory
				systemCategory
				isDisabled
				group {
					id
					type
					name
					__typename
				}
				__typename
			}
		}`
	};

	const response = await callGraphQL(payload);
	return (response.data?.categories || []).sort((a, b) => a.name.localeCompare(b.name));
}

// Helper function to map Monarch categories to Splitwise categories
function mapMonarchCategoryToSplitwiseCategory(monarchCategoryId: string | undefined): number {
	// Default to "General" category if no mapping found
	if (!monarchCategoryId) return 18;

	// TODO: Add proper category mapping
	const categoryMap: Record<string, number> = {
		// Add mappings based on your categories
		// Format: 'monarch_category_id': splitwise_category_id
	};

	return categoryMap[monarchCategoryId] || 18; // Default to "General" if no mapping found
}

