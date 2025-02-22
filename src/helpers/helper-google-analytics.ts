/******************************************************************************************/
/* This file provides Google Analytics integration for the extension.
/* It provides:
/* - Event tracking with custom parameters
/* - Session management and persistence
/* - Client ID management
/* - Page view and error event tracking
/* - Debug mode for development

/* This file contains helper functions for Google Analytics.
/* It provides functionality to:
/* - Track Google Analytics events
/* - Handle message events between content script and page for analytics operations
/******************************************************************************************/

// Define the types of analytics messages
export enum AnalyticsMessageType {
	SEND_TO_GANALYTICS_SUCCESS = 'SEND_TO_GANALYTICS_SUCCESS',
	SEND_TO_GANALYTICS_ERROR = 'SEND_TO_GANALYTICS_ERROR'
}

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';

const MEASUREMENT_ID = "G-0356XB31M8";
const API_SECRET = "ZuFTmTvMQX2H6H121ZyY2A";
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;
const SESSION_EXPIRATION_IN_MIN = 30;

export enum AnalyticsEventType {
	SUCCESS = 'success',
	ERROR = 'error'
}

export interface AnalyticsEventDetail {
	eventName: string;
	[key: string]: any;
}

interface SessionData {
	session_id: string;
	timestamp: string;
}

interface EventParams {
	session_id?: string;
	engagement_time_msec?: number;
	[key: string]: any;
}

interface ErrorParams {
	message: string;
	stack?: string;
	[key: string]: any;
}

export function trackGoogleAnalyticsEvent(type: AnalyticsEventType, detail: AnalyticsEventDetail): void {
	const eventName = type === AnalyticsEventType.SUCCESS ?
		AnalyticsMessageType.SEND_TO_GANALYTICS_SUCCESS : AnalyticsMessageType.SEND_TO_GANALYTICS_ERROR;
	document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

class Analytics {
	private debug: boolean;

	constructor(debug = false) {
		this.debug = debug;
	}

	async getOrCreateClientId(): Promise<string> {
		const { clientId } = await chrome.storage.local.get('clientId');
		if (!clientId) {
			const newClientId = self.crypto.randomUUID();
			await chrome.storage.local.set({ clientId: newClientId });
			return newClientId;
		}
		return clientId;
	}

	async getOrCreateSessionId(): Promise<string> {
		let { sessionData } = await chrome.storage.session.get('sessionData') as { sessionData?: SessionData };
		const currentTimeInMs = Date.now();
		if (sessionData?.timestamp) {
			const durationInMin = (currentTimeInMs - Number(sessionData.timestamp)) / 60000;
			if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
				sessionData = undefined;
			} else {
				sessionData.timestamp = currentTimeInMs.toString();
				await chrome.storage.session.set({ sessionData });
			}
		}
		if (!sessionData) {
			sessionData = {
				session_id: currentTimeInMs.toString(),
				timestamp: currentTimeInMs.toString()
			};
			await chrome.storage.session.set({ sessionData });
		}
		return sessionData.session_id;
	}

	async fireEvent(name: string, params: EventParams = {}): Promise<void> {
		if (!params.session_id) {
			params.session_id = await this.getOrCreateSessionId();
		}
		if (!params.engagement_time_msec) {
			params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_MSEC;
		}
		try {
			const response = await fetch(
				`${this.debug ? GA_DEBUG_ENDPOINT : GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
				{
					method: 'POST',
					body: JSON.stringify({
						client_id: await this.getOrCreateClientId(),
						events: [{ name, params }]
					})
				}
			);

			if (this.debug) {
				console.log(await response.text());
			}
		} catch (e) {
			console.error('Google Analytics request failed with an exception', e);
		}
	}

	async firePageViewEvent(pageTitle: string, pageLocation: string, additionalParams: EventParams = {}): Promise<void> {
		return this.fireEvent('page_view', {
			page_title: pageTitle,
			page_location: pageLocation,
			...additionalParams
		});
	}

	async fireErrorEvent(error: ErrorParams, additionalParams: EventParams = {}): Promise<void> {
		return this.fireEvent('extension_error', {
			...error,
			...additionalParams
		});
	}
}

export default new Analytics();
