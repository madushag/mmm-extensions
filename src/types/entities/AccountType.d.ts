import { Account } from "./Account";

export interface AccountType {
    name: string;
    display: string;
    group: string;
    __typename: string;
    accounts: Account[];
} 