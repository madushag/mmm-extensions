export interface Institution {
    id: string;
    logo: string;
    name: string;
    status: string | null;
    plaidStatus: {
        auth?: {
            status: string;
            breakdown: {
                success: number;
                error_plaid: number;
                error_institution: number;
            };
            last_status_change: string;
        };
        identity?: {
            status: string;
            breakdown: {
                success: number;
                error_plaid: number;
                error_institution: number;
            };
            last_status_change: string;
        };
        item_logins?: {
            status: string;
            breakdown: {
                success: number;
                error_plaid: number;
                error_institution: number;
            };
            last_status_change: string;
        };
        health_incidents?: Array<{
            title: string;
            end_date: string | null;
            start_date: string;
            incident_updates: Array<{
                status: string;
                description: string;
                updated_date: string;
            }>;
        }>;
        liabilities_updates?: {
            status: string;
            breakdown: {
                success: number;
                error_plaid: number;
                refresh_interval: string;
                error_institution: number;
            };
            last_status_change: string;
        };
        transactions_updates?: {
            status: string;
            breakdown: {
                success: number;
                error_plaid: number;
                refresh_interval: string;
                error_institution: number;
            };
            last_status_change: string;
        };
    } | null;
    newConnectionsDisabled: boolean;
    hasIssuesReported: boolean;
    url: string;
    hasIssuesReportedMessage: string;
    transactionsStatus: string | null;
    balanceStatus: string | null;
    __typename: string;
} 