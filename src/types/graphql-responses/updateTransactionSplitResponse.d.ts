import { SplitTransaction } from "../entities/SplitTransaction";
import { PayloadError } from "../entities/PayLoadError";

export interface UpdateTransactionSplitResponse {
    data?: {
        updateTransactionSplit: {
            errors: PayloadError[];
            transaction: {
                id: string;
                hasSplitTransactions: boolean;
                splitTransactions: SplitTransaction[];
                __typename: string;
            };
            __typename: string;
        };
    };
    errors?: any[];
} 