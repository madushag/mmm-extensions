import { AccountTypeSummary } from "../entities/AccountTypeSummary";
import { HouseholdPreferences } from "../entities/HouseholdPreferences";

export interface GetAccountTypeSummariesResponse {
    data: {
        hasAccounts: boolean;
        accountTypeSummaries: AccountTypeSummary[];
        householdPreferences: HouseholdPreferences;
    };
    __typename: string;
}