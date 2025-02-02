export interface Credential {
    id: string;
    updateRequired: boolean;
    dataProvider: string;
    disconnectedFromDataProviderAt: string | null;
    syncDisabledAt: string | null;
    syncDisabledReason: string | null;
    __typename: string;
} 