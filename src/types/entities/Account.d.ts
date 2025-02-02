import { Subtype } from "./Subtype";
import { Credential } from "./Credential";
import { Institution } from "./Institution";
import { AccountType } from "./AccountType";


export interface Account {
    id: string;
    displayName: string;
    displayBalance?: string;
    signedBalance?: number;
    updatedAt?: string;
    syncDisabled?: boolean;
    icon?: string;
    logoUrl?: string;
    isHidden?: boolean;
	hideTransactionsFromReports?: boolean;
    isAsset?: boolean;
    includeInNetWorth?: boolean;
    includeBalanceInNetWorth?: boolean;
    displayLastUpdatedAt?: string;
    mask?: string;
    subtype?: Subtype;
    credential?: Credential;
    institution?: Institution;
    order?: number;
    type?: AccountType;
    __typename?: string;
}
