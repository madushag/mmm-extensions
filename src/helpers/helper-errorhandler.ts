/******************************************************************************************/
/* This file provides global error handling functionality for the extension.
/* It provides:
/* - Centralized error handling with toast notifications
/* - Error event tracking through Google Analytics
/* - Consistent error formatting across the application
/******************************************************************************************/

import { showToast, ToastType } from "../toast.js";
import { AnalyticsMessageType } from "./helper-google-analytics.js";

export function handleGlobalError(error: Error, context: string) {
	showToast(`Error in ${context}: ${error.message}`, ToastType.ERROR);
	document.dispatchEvent(new CustomEvent(AnalyticsMessageType.SEND_TO_GANALYTICS_ERROR, {
		detail: {
			eventName: "global_error",
			context: context,
			error: error.message,
			stackTrace: error.stack
		}
	}));
}