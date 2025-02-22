/******************************************************************************************/
/* This file handles the accounts view functionality of the extension.
/* It provides:
/* - Custom net worth duration persistence
/* - URL parameter management for dateRange
/* - Integration with Splitwise posting features
/******************************************************************************************/

import { showToast, ToastType } from "../toast.js";
import { CustomSettings } from "../types/entities/CustomSettings.js";
import { getCustomSettings, saveConfigValues } from "./settings-view.js";


// Listen for the CustomEvent from the content script
document.addEventListener('EXECUTE-ACCOUNTS-VIEW', (event) => {
	let customSettings = getCustomSettings();
	mainHandler(customSettings);
});

document.addEventListener('EXECUTE-ACCOUNTS-DETAILS-VIEW', (event) => {
	let customSettings = getCustomSettings();
	accountsDetailsViewHandler(customSettings);
});


// Main handler function in the injected script
function mainHandler(customSettings: CustomSettings): void {
	if (customSettings.rememberNetWorthDuration) {
		console.log("in accounts main handler");

		if (customSettings.showPostToSplitwiseButton) {
			console.log("in accounts main handler and showPostToSplitwiseButton is true");
		} else {
			console.log("in accounts main handler and showPostToSplitwiseButton is false");
		}

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
	showToast("Accounts view executed", ToastType.INFO);
}

function accountsDetailsViewHandler(customSettings: CustomSettings): void {
	addHideChartButton();
}

function addHideChartButton() {

	if (document.getElementById('mmm-hide-chart-container')) {
		return;
	}
	const accountBalanceGraphHeader = document.querySelector('div[class^="Flex-sc"][class*="AccountBalanceGraph__Header-sc"]');
	const dateRangeSelectorButton = accountBalanceGraphHeader?.querySelector('button[class*="AccountBalanceGraph__DateRangeOptionButton-sc"]');

	if (dateRangeSelectorButton) {
		// Create a container for the flex grid
		const flexContainer = document.createElement('div');
		flexContainer.style.display = 'flex';
		flexContainer.style.alignItems = 'center';
		flexContainer.style.marginLeft = 'auto';

		// Create a container for the toggle switch
		const toggleContainer = document.createElement('div');
		toggleContainer.id = 'mmm-hide-chart-container';
		toggleContainer.className = 'mmm-setting-item-content';
		toggleContainer.style.marginRight = '12px';

		// Create the toggle switch
		const toggleLabel = document.createElement('label');
		toggleLabel.className = 'toggle-switch';

		const toggleInput = document.createElement('input');
		toggleInput.type = 'checkbox';
		toggleInput.checked = false;
		toggleInput.id = 'mmm-hide-account-balance-graph';

		const toggleSlider = document.createElement('span');
		toggleSlider.className = 'slider';

		const toggleLabelText = document.createElement('span');
		toggleLabelText.textContent = 'Hide Chart';
		toggleLabelText.className = 'toggle-label-text';

		// Assemble the toggle switch
		toggleLabel.appendChild(toggleInput);
		toggleLabel.appendChild(toggleSlider);
		toggleContainer.appendChild(toggleLabel);
		toggleContainer.appendChild(toggleLabelText);

		// Add the toggle switch and dateRangeSelectorButton to the flex container
		flexContainer.appendChild(toggleContainer);
		flexContainer.appendChild(dateRangeSelectorButton);

		// Add the flex container to the header
		accountBalanceGraphHeader.appendChild(flexContainer);

		// Handle toggle changes
		toggleInput.addEventListener('change', () => {
			const graphContainer = accountBalanceGraphHeader.nextElementSibling as HTMLElement;
			if (graphContainer) {
				graphContainer.style.transition = 'opacity 0.3s ease';
				graphContainer.style.opacity = toggleInput.checked ? '0' : '1';
				setTimeout(() => {
					graphContainer.style.display = toggleInput.checked ? 'none' : 'block';
					graphContainer.style.opacity = toggleInput.checked ? '0' : '1';
				}, 300);
			}
		});
	}
}
