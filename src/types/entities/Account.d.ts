import { Subtype } from "./AccountSubtype";
import { Credential } from "./Credential";
import { Institution } from "./Institution";
import { AccountType } from "./AccountType";


export interface Account {
    id: string;
    syncDisabled?: boolean;
    isHidden?: boolean;
    isAsset?: boolean;
    includeInNetWorth?: boolean;
    order?: number;
    type?: AccountType;
    displayName?: string;
    displayBalance?: number;
    signedBalance?: number;
    updatedAt?: string;
    icon?: string;
    logoUrl?: string | null;
    includeBalanceInNetWorth?: boolean;
    displayLastUpdatedAt?: string;
    mask?: string | null;
    subtype?: Subtype;
    __typename?: string;
    credential?: Credential | null;
    institution?: Institution | null;
}
