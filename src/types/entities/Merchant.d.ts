export interface Merchant {
    id: string;
    name: string;
    transactionsCount?: number;
    logoUrl?: string;
    recurringTransactionStream?: {
        id: string;
        frequency: string;
        __typename?: string;
    };
    __typename?: string;
} 