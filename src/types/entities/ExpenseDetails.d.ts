// Details of the transaction to be posted to Splitwise
export interface ExpenseDetails {
	merchant: {
		name: string;
	};
	category: {
		name: string;
	};
	amount: number;
	date: string;
	notes?: string;
	groupId?: number;
}