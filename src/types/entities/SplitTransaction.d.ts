import { Merchant } from "./Merchant";
import { Category } from "./Category";
import { Goal } from "./Goal";
import { HouseholdTransactionTag } from "./HouseholdTransactionTag";
import { NeedsReviewByUser } from "./NeedsReviewByUser";

export interface SplitTransaction {
    id: string;
    amount: number;
    notes: string;
    hideFromReports: boolean;
    reviewStatus: string;
    merchant: Merchant;
    category: Category;
    goal?: Goal;
    needsReviewByUser?: NeedsReviewByUser;
    tags: HouseholdTransactionTag[];
    __typename: string;
} 