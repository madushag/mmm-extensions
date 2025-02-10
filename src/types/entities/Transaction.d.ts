/******************************************************************************************/
/* Type definition for Transaction entities in the Monarch Money API.
/* Defines the structure for:
/* - Transaction core data (ID, amount, date)
/* - Split transaction relationships and status
/* - Associated entities (merchant, category, account)
/* - Review status and attachments
/* - Tags and reporting settings
/******************************************************************************************/

import { HouseholdTransactionTag } from "./HouseholdTransactionTag";
import { User } from "./User";
import { Merchant } from "./Merchant";
import { Category } from "./Category";
import { Account } from "./Account";
import { Attachment } from "./Attachment";

export interface Transaction {
    id: string;
    amount: number;
    pending?: boolean;
    date: string;
    originalDate?: string;
    hideFromReports?: boolean;
    needsReview?: boolean;
    reviewedAt?: string;
    reviewedByUser?: User;
    plaidName?: string;
    notes?: string;
    isRecurring?: boolean;
    isSplitTransaction?: boolean;
    hasSplitTransactions?: boolean;
    isManual?: boolean;
    splitTransactions?: {
        id: string;
        amount: number;
        merchant: Merchant;
        category: Category;
        __typename: string;
    }[];
    originalTransaction?: {
        id: string;
        date: string;
        amount: number;
        merchant: Merchant;
        __typename: string;
    };
    attachments?: Attachment[];
    account?: Account;
    category?: Category;
    goal?: {
        id: string;
        __typename: string;
    };
    merchant?: Merchant;
    tags?: HouseholdTransactionTag[];
    needsReviewByUser?: {
        id: string;
        __typename: string;
    };
    __typename?: string;
}
