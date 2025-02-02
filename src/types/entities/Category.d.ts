export interface Category {
    id: string;
    name: string;
    icon: string;
    group?: {
        id: string;
        type: string;
        __typename: string;
    };
    __typename: string;
} 