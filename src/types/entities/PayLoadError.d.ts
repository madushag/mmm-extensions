export interface PayloadError {
    fieldErrors: {
        field: string;
        messages: string[];
    }[];
    message: string;
    code: string;
}
