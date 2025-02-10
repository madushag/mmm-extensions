/******************************************************************************************/
/* This file handles the accounts view functionality of the extension.
/* It provides:
/* - Custom net worth duration persistence
/* - URL parameter management for dateRange
/* - Integration with Splitwise posting features
/******************************************************************************************/

import { CustomSettings } from "../types/entities/CustomSettings.js";
import { getCustomSettings, saveConfigValues } from "./settings-view.js";



// Listen for the CustomEvent from the content script
document.addEventListener('EXECUTE-ACCOUNTS-VIEW', (event) => {
	let customSettings = getCustomSettings();
	mainHandler(customSettings);
});

// Main handler function in the injected script
function mainHandler(customSettings: CustomSettings) {
	if (customSettings.rememberNetWorthDuration) {

		console.log("in accounts main handler");

		if (customSettings.showPostToSplitwiseButton) {
			console.log("in accounts main handler and showPostToSplitwiseButton is true");
		} else {
			console.log("in accounts main handler and showPostToSplitwiseButton is false");
		}

		// this is a test to generate a request ID


		// Parse the URL and extract the networth duration from the dateRange parameter
		const url = new URL(window.location.href);
		const dateRange = url.searchParams.get("dateRange");

		// If the stored default value is different from the dateRange, update the URL value with the default value
		if (customSettings.defaultNetWorthDuration !== dateRange) {
			url.searchParams.set("dateRange", customSettings.defaultNetWorthDuration);
			window.history.replaceState({}, '', url.toString());
			window.location.reload();
		}

	}
}



