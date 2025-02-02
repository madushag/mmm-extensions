import { AccountType } from "./AccountType";
import { Account } from "./Account";

export interface AccountTypeSummary {
    type: AccountType;
    accounts: Account[];
    isAsset: boolean;
    totalDisplayBalance: string;
    __typename: string;
    id: string;
    name: string;
} 