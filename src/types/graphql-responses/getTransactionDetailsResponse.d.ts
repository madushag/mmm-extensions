import { Transaction } from '../entities/Transaction';
import { Household } from '../entities/Household';


export interface GetTransactionDetailsResponse {
    data?: {
        getTransaction: Transaction;
        myHousehold: Household;
    };
    errors?: any[];
}
