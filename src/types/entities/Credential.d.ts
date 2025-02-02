export interface Credential {
    id: string;
    updateRequired: boolean;
    dataProvider: string;
    disconnectedFromDataProviderAt: string;
    syncDisabledAt: string;
    syncDisabledReason: string;
    __typename: string;
} 