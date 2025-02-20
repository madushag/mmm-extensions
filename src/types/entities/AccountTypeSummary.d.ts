/******************************************************************************************/
/* Type definition for Account Type Summary in the Monarch Money API.
/* Defines the structure for:
/* - Account type groupings and balances
/* - Asset classification
/* - Total balance calculations
/* - Associated accounts list
/******************************************************************************************/

import { Account } from "./Account";
import { AccountType } from "./AccountType";

export interface AccountTypeSummary {
    type: AccountType;
    accounts: Account[];
    isAsset: boolean;
    totalDisplayBalance: number;
    __typename: string;
}