import { HouseholdTransactionTag } from "../entities/HouseholdTransactionTag";
import { PayloadError } from "../entities/PayLoadError";

export interface SetTransactionTagsResponse {
    data?: {
        setTransactionTags: {
            errors: PayloadError[];
            transaction: {
                id: string;
                tags: HouseholdTransactionTag[];
                __typename: string;
            };
            __typename: string;
        };
    };
    errors?: any[];
}

