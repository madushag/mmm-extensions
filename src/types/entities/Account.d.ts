/******************************************************************************************/
/* Type definition for Account entities in the Monarch Money API.
/* Defines the structure for:
/* - Account core properties (ID, name, balance)
/* - Display and sync settings
/* - Institution and credential relationships
/* - Net worth inclusion settings
/******************************************************************************************/

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
