import { PayloadError } from "../entities/PayLoadError";

export interface UpdateTransactionResponse {
    data?: {
        updateTransaction: {
            transaction: {
                id: string;
                amount: number;
                pending: boolean;
                date: string;
                hideFromReports: boolean;
                needsReview: boolean;
                reviewedAt: string;
                reviewedByUser: {
                    id: string;
                    name: string;
                    __typename: string;
                };
                plaidName: string;
                notes: string;
                isRecurring: boolean;
                category: {
                    id: string;
                    __typename: string;
                };
                goal: {
                    id: string;
                    __typename: string;
                };
                merchant: {
                    id: string;
                    name: string;
                    __typename: string;
                };
                __typename: string;
            };
            errors: PayloadError[];
            __typename: string;
        };
    };
    errors?: any[];
}

