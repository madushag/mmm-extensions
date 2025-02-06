import { HouseholdTransactionTag } from "../entities/HouseholdTransactionTag";

export interface GetHouseholdTransactionTagsResponse {
    data?: {
        householdTransactionTags: HouseholdTransactionTag[];
    };
    errors?: any[];
}