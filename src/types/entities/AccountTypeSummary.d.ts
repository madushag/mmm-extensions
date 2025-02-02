import { Account } from "./Account";
import { AccountType } from "./AccountType";

export interface AccountTypeSummary {
    type: AccountType;
    accounts: Account[];
    isAsset: boolean;
    totalDisplayBalance: number;
    __typename: string;
} 