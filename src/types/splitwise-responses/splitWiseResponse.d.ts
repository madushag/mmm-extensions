// Response from the Splitwise API
export interface SplitwiseResponse {
	errors: {
		base?: string;
		[key: string]: any;
	};
	[key: string]: any;
}