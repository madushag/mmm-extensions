// CustomSettings class
export interface CustomSettings {
	splitWithPartnerTagName: string;
	splitWithPartnerAccountId: string;
	showSplitButtonForUnsplitTransactions: boolean;
	showSplitButtonOnAllAccounts: boolean;
	showUnsplitButtonForSplitTransactions: boolean;
	tagSplitTransactions: boolean;

	showPostToSplitwiseButton: boolean;
	splitwiseFriendId: string;
	splitwiseUserId: number;
	splitwiseGroupId: number;

	rememberNetWorthDuration: boolean;
	defaultNetWorthDuration: string;

	handleUtilities: boolean;
	utilityCategories: string[];

	handleCreditCardPayments: boolean;
	creditCardPaymentGroupId: number;
	transactionPostedToSplitwiseTagName: string;
}