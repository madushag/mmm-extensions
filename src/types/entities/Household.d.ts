import { User } from "./User";

export interface Household {
    id: string;
    users: User[];
    __typename: string;
} 