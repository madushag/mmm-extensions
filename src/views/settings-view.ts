/******************************************************************************************/
/* This file handles the settings view functionality of the extension.
/* It provides:
/* - Custom settings UI and modal management
/* - Settings persistence and retrieval
/* - Configuration for split transactions, tags, and accounts
/* - Theme detection and UI customization
/* - Net worth duration preferences
/******************************************************************************************/

import { CustomSettings } from "../types/entities/CustomSettings.js";
import { getAllMonarchAccountDetails, getAllTags, getAllCategories } from "../helpers/helper-graphql.js";
import { getSplitwiseFriends, getCurrentSplitwiseUser, getSplitwiseGroups } from "../helpers/splitwise/helper-splitwise.js";
import { showToast, ToastType } from "../toast.js";
import { createModalHtml, loadUtilityCategories } from "./settings-view-generators.js";


const DEFAULT_SETTINGS: CustomSettings = {
	splitWithPartnerTagName: "",
	splitWithPartnerAccountId: "",
	showSplitButtonForUnsplitTransactions: true,
	showSplitButtonOnAllAccounts: true,
	showUnsplitButtonForSplitTransactions: false,
	tagSplitTransactions: false,
	rememberNetWorthDuration: false,
	defaultNetWorthDuration: "YTD",
	showPostToSplitwiseButton: false,
	splitwiseFriendId: "",
	splitwiseUserId: 0,
	splitwiseUtilityGroupId: 0,
	handleUtilities: false,
	utilityCategories: [],
	handleCreditCardPayments: false,
	creditCardPaymentGroupId: 0,
	transactionPostedToSplitwiseTagName: ""
};

// Listen for the CustomEvent from the content script
document.addEventListener('EXECUTE-CUSTOM-SETTINGS', (event) => {
	// Bootstrap settings   
	addCustomSettingsLink();
});

// Function to add the custom settings link
function addCustomSettingsLink() {
	// Add custom settings section
	const settingsContainer = document.querySelector('div[class*="Settings__SubNavCard"]')?.querySelector('div[class^="Menu"]');

	// Check if the settings container exists and if the custom settings link doesn't already exist
	if (settingsContainer && !document.getElementById('mmm-custom-settings-anchor')) {

		// Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
		// and add it to the custom settings link
		const existingChildAnchorElementStyles = settingsContainer.querySelector('a:not([class*="nav-item-active"])');
		const existingDivElementStyles = existingChildAnchorElementStyles?.querySelector('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');
		// Add an anchor element to the settings container to contain the custom settings link
		const customSettingsAnchorElement = document.createElement('a');
		customSettingsAnchorElement.href = '#';
		customSettingsAnchorElement.id = 'mmm-custom-settings-anchor';
		if (existingChildAnchorElementStyles) customSettingsAnchorElement.className = existingChildAnchorElementStyles.className;

		// Create the custom setting div element and add it to the anchor element
		const customSettingsDivElement = document.createElement('div');
		customSettingsDivElement.id = 'mmm-custom-settings-div';
		if (existingDivElementStyles) customSettingsDivElement.className = existingDivElementStyles.className;
		customSettingsDivElement.innerHTML = 'MMM Extensions Custom Settings';

		// Add the custom settings link to the anchor element   
		customSettingsAnchorElement.appendChild(customSettingsDivElement);
		// Add the anchor element to the settings container
		settingsContainer.appendChild(customSettingsAnchorElement);

		// Show modal on click. Do a fade in transition
		customSettingsDivElement.addEventListener('click', () => {
			showCustomSettingsModal();
		});

	}

	// If the custom settings link already exists, re-apply the styles to match the current theme
	else if (document.getElementById('mmm-custom-settings-anchor')) {

		// Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
		// and add it to the custom settings link
		const existingChildAnchorElementStyles = settingsContainer?.querySelector<HTMLAnchorElement>('a:not([class*="nav-item-active"])');
		const existingDivElementStyles = existingChildAnchorElementStyles?.querySelector<HTMLDivElement>('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

		const anchorElement = document.getElementById('mmm-custom-settings-anchor') as HTMLAnchorElement;
		const divElement = document.getElementById('mmm-custom-settings-div') as HTMLDivElement;

		if (existingChildAnchorElementStyles) anchorElement.className = existingChildAnchorElementStyles.className;
		if (existingDivElementStyles) divElement.className = existingDivElementStyles.className;
	}

}

// Function to create the custom settings modal
async function showCustomSettingsModal(): Promise<void> {
	const theme = detectTheme();
	const allTags = await getAllTags();

	const accountIdsNames = await getAllMonarchAccountDetails();
	if (!accountIdsNames || accountIdsNames.length === 0) {
		// log an error to analytics, show an error toast and then return
		document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR',
			{ detail: { eventName: "mmm_custom_settings_modal_error", params: { error: "No Monarch accounts found" } } }));
		showToast('Error loading Monarch accounts', ToastType.ERROR);
		return;
	}

	// Add the modal to the DOM
	await createModalHtml(allTags, accountIdsNames, theme);
	// Show the modal
	const modal = document.getElementById("mmm-settings-modal");
	setTimeout(() => {
		modal.classList.add('show');
		loadSettingsAndSetModalValues();
	}, 10);

	// Attach event listeners to the modal
	attachModalEventListeners(modal);

	// Remove the modal when the user clicks outside of it
	window.addEventListener('click', (e: MouseEvent) => {
		if (e.target === modal) {
			modal.classList.remove('show');
			setTimeout(() => {
				modal.remove();
			}, 500);
		}
	});

	// Send an analytics event when the modal is opened
	document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_SUCCESS',
		{ detail: { eventName: "mmm_custom_settings_modal_opened", params: { theme: theme } } }));

}

//------------------ HELPER FUNCTIONS ------------------

// Function to attach event listeners to the modal
function attachModalEventListeners(modal: HTMLElement): void {

	// Save settings on change
	modal.addEventListener('change', async (e: Event) => {
		e.stopPropagation();

		const target = e.target as HTMLInputElement;

		// Skip showHideSettingItems and saving for utility category changes and utility search inbox changes as they are handled separately
		if (!target.classList.contains('utility-category-checkbox')
			&& !target.id.includes('categories-search')
			&& target.tagName !== 'SELECT') {
			showHideSettingItems(target);
		}

		// Special handling for Splitwise toggle
		if (target.id === 'show-post-to-splitwise' && target.checked) {
			await loadSplitwiseData();
		}

		// Save all settings
		const settingElements = document.querySelectorAll<HTMLInputElement>('[mmm-data-setting-name]');
		const settings = getCustomSettings();
		settingElements.forEach(el => {

			// Skip utility category checkboxes
			if (el.dataset.settingName && !el.id.includes('category-')) {
				const settingName = el.dataset.settingName as keyof CustomSettings;
				const value = el.type === 'checkbox' ? el.checked : el.value;
				settings[settingName] = value as never;
			}
		});
		saveCustomSettings(settings);
	});

	// Close modal on X click with fade out
	const closeBtn = modal.querySelector<HTMLElement>('.mmm-modal-close');
	closeBtn?.addEventListener('click', () => {
		modal.classList.remove('show');
		setTimeout(() => {
			modal.remove();
		}, 500); // Match the transition-slow timing
	});
}
// Function to hide a setting item
function hideSettingItem(settingItem: HTMLElement): void {
	settingItem.style.maxHeight = '0';
	settingItem.style.opacity = '0';
	settingItem.style.overflow = 'hidden';
	settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)';
	setTimeout(() => {
		settingItem.style.display = 'none';
		settingItem.style.overflow = ''; // Reset overflow after hiding
	}, 500);
}
// Function to show a setting item
function showSettingItem(settingItem: HTMLElement): void {
	// First make it visible but hidden to calculate full height
	settingItem.style.display = 'block';
	settingItem.style.opacity = '0';
	settingItem.style.maxHeight = '0';
	settingItem.style.overflow = 'hidden';
	// Force a reflow to ensure the browser registers the display change
	settingItem.offsetHeight;
	// Calculate the total height including all nested content
	const totalHeight = calculateTotalHeight(settingItem);
	// Now set the actual height and fade in
	settingItem.style.maxHeight = `${totalHeight}px`;
	settingItem.style.opacity = '1';
	settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)';
	// Remove overflow restriction after animation
	setTimeout(() => {
		settingItem.style.overflow = '';
	}, 500);
}
// Helper function to calculate total height including nested elements
function calculateTotalHeight(element) {
	// Temporarily remove transitions and maxHeight to get true height
	const originalTransition = element.style.transition;
	const originalMaxHeight = element.style.maxHeight;
	const originalHeight = element.style.height;
	element.style.transition = 'none';
	element.style.maxHeight = 'none';
	element.style.height = 'auto';
	// Get the full height including margins
	const computedStyle = window.getComputedStyle(element);
	const marginTop = parseFloat(computedStyle.marginTop);
	const marginBottom = parseFloat(computedStyle.marginBottom);
	// Calculate total height including all nested content
	const totalHeight = element.offsetHeight + marginTop + marginBottom;
	// Restore original styles
	element.style.transition = originalTransition;
	element.style.maxHeight = originalMaxHeight;
	element.style.height = originalHeight;
	// Add extra padding for nested elements
	return totalHeight + 50; // Add some buffer for nested elements
}

// Function to load settings and set the modal values
async function loadSettingsAndSetModalValues(): Promise<void> {
	const settings = getCustomSettings();

	// Split/Unsplit settings elements
	const showSplitCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
	const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
	const showUnsplitCheckbox = document.getElementById('show-unsplit-button-for-split-transactions') as HTMLInputElement;
	const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;
	const tagNameSelect = document.getElementById('split-with-partner-tag-name') as HTMLSelectElement;
	// Load the settings
	showSplitCheckbox.checked = settings.showSplitButtonForUnsplitTransactions || false;
	showAllAccountsCheckbox.checked = settings.showSplitButtonOnAllAccounts || false;
	showUnsplitCheckbox.checked = settings.showUnsplitButtonForSplitTransactions || false;
	tagTransactionsCheckbox.checked = settings.tagSplitTransactions || false;
	tagNameSelect.value = settings.splitWithPartnerTagName || '';

	// Splitwise settings elements
	const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;
	const splitwiseFriendAccountId = document.getElementById('split-with-partner-account-id') as HTMLSelectElement;
	const handleUtilitiesCheckbox = document.getElementById('handle-utilities') as HTMLInputElement;
	const splitwiseUtilityGroupId = document.getElementById('splitwise-utility-group-id') as HTMLSelectElement;
	const handleCreditCardPaymentsCheckbox = document.getElementById('handle-credit-card-payments') as HTMLInputElement;
	const creditCardSplitwiseGroupId = document.getElementById('credit-card-payment-group-id') as HTMLSelectElement;
	const transactionPostedToSplitwiseTagName = document.getElementById('transaction-posted-to-splitwise-tag-name') as HTMLSelectElement;
	// Load the settings
	showPostToSplitwiseCheckbox.checked = settings.showPostToSplitwiseButton || false;
	splitwiseFriendAccountId.value = settings.splitWithPartnerAccountId || '';
	handleUtilitiesCheckbox.checked = settings.handleUtilities || false;
	// Load categories for utilities
	await loadUtilityCategories(settings.utilityCategories || []);
	splitwiseUtilityGroupId.value = settings.splitwiseUtilityGroupId.toString() || '0';
	handleCreditCardPaymentsCheckbox.checked = settings.handleCreditCardPayments || false;
	creditCardSplitwiseGroupId.value = settings.creditCardPaymentGroupId.toString() || '0';
	transactionPostedToSplitwiseTagName.value = settings.transactionPostedToSplitwiseTagName || '';

	// Other settings
	const defaultNetWorthDurationSelect = document.getElementById('default-net-worth-duration') as HTMLSelectElement;
	defaultNetWorthDurationSelect.value = settings.defaultNetWorthDuration || 'YTD';

	// Load Splitwise data
	await loadSplitwiseData();

	showHideSettingItems(null);
}

// Function to show or hide setting items based on the settings
function showHideSettingItems(target: HTMLElement | null): void {
	const showSplitButtonCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
	const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
	const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;
	const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;
	const handleUtilitiesCheckbox = document.getElementById('handle-utilities') as HTMLInputElement;
	const handleCreditCardPaymentsCheckbox = document.getElementById('handle-credit-card-payments') as HTMLInputElement;
	// Split button settings
	const showSplitOnAllAccountsSettingItem = document.getElementById('mmm-setting-item-show-split-button-on-all-accounts') as HTMLElement;
	const partnerAccountIdSettingItem = document.getElementById('mmm-setting-item-split-with-partner-account-id') as HTMLElement;
	const tagSettingItem = document.getElementById('mmm-setting-item-split-with-partner-tag-name') as HTMLElement;
	// Splitwise settings group
	const splitwiseSettingsGroup = document.getElementById('splitwise-settings-group') as HTMLElement;
	const utilityCategoriesSettingItem = document.getElementById('mmm-setting-item-utility-categories') as HTMLElement;
	const splitwiseUtilityGroupSettingItem = document.getElementById('mmm-setting-item-splitwise-utility-group') as HTMLElement;
	const creditCardPaymentGroupSettingItem = document.getElementById('mmm-setting-item-credit-card-payment-group') as HTMLElement;
	const transactionPostedToSplitwiseTagNameSettingItem = document.getElementById('mmm-setting-item-transaction-posted-to-splitwise-tag-name') as HTMLElement;
	// Handle visibility with a slight delay to ensure proper animation sequencing
	const handleVisibility = (show, ...elements) => {
		// const settingName = triggerElement.dataset.settingName;
		// const storedSettings = loadSettings();
		// const settingValue = storedSettings[settingName as keyof CustomSettings];
		elements.forEach((element, index) => {
			if (element) {
				setTimeout(() => {
					if (show) {
						showSettingItem(element);
					}
					else {
						hideSettingItem(element);
					}
				}, index * 50); // Stagger animations slightly
			}
		});
	};
	// Handle split button visibility
	// If the target is null, handle the visibility of all items. This happens on initial load
	if (target === null) {
		handleVisibility(showSplitButtonCheckbox.checked, showSplitOnAllAccountsSettingItem, partnerAccountIdSettingItem);
		handleVisibility(!showAllAccountsCheckbox.checked, partnerAccountIdSettingItem);
		handleVisibility(tagTransactionsCheckbox.checked, tagSettingItem);
		handleVisibility(showPostToSplitwiseCheckbox.checked, splitwiseSettingsGroup);
		handleVisibility(handleUtilitiesCheckbox.checked, utilityCategoriesSettingItem, splitwiseUtilityGroupSettingItem);
		handleVisibility(handleCreditCardPaymentsCheckbox.checked, creditCardPaymentGroupSettingItem, transactionPostedToSplitwiseTagNameSettingItem);
	}
	// Handle split button visibility
	else if (target === showSplitButtonCheckbox) {
		if (showSplitButtonCheckbox.checked) {
			handleVisibility(showSplitButtonCheckbox.checked, showSplitOnAllAccountsSettingItem);
			handleVisibility(showAllAccountsCheckbox.checked, partnerAccountIdSettingItem);
		}
		else {
			handleVisibility(false, showSplitOnAllAccountsSettingItem, partnerAccountIdSettingItem);
		}
	}
	else if (target === showAllAccountsCheckbox) {
		handleVisibility(!showAllAccountsCheckbox.checked, partnerAccountIdSettingItem);
	}
	else if (target === tagTransactionsCheckbox) {
		handleVisibility(tagTransactionsCheckbox.checked, tagSettingItem);
	}
	// Handle Splitwise settings visibility
	else if (target === showPostToSplitwiseCheckbox) {
		handleVisibility(showPostToSplitwiseCheckbox.checked, splitwiseSettingsGroup);
	}
	else if (target === handleUtilitiesCheckbox) {
		handleVisibility(handleUtilitiesCheckbox.checked, utilityCategoriesSettingItem, splitwiseUtilityGroupSettingItem);
	}
	else if (target === handleCreditCardPaymentsCheckbox) {
		handleVisibility(handleCreditCardPaymentsCheckbox.checked, creditCardPaymentGroupSettingItem, transactionPostedToSplitwiseTagNameSettingItem);
	}
}

// Function to load the settings from local storage
// This function merges the default settings with the stored settings
export function getCustomSettings(): CustomSettings {
	const stored = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
	return { ...DEFAULT_SETTINGS, ...stored };
}

// Function to save the settings to local storage
export function saveCustomSettings(settings: CustomSettings): void {
	localStorage.setItem('mmm-settings', JSON.stringify(settings));
}

// Update function to load Splitwise friends
async function loadSplitwiseFriends(): Promise<void> {
	const friendSelect = document.getElementById('splitwise-friend-id') as HTMLSelectElement;
	if (!friendSelect) return;

	try {
		// Get friends list using helper function
		const friends = await getSplitwiseFriends();

		// Clear existing options
		friendSelect.innerHTML = '';

		// Add default option
		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.textContent = 'Select a friend';
		friendSelect.appendChild(defaultOption);

		// Add friend options
		friends.forEach((friend: any) => {
			const option = document.createElement('option');
			option.value = friend.id;
			option.textContent = `${friend.first_name} ${friend.last_name === null ? '' : friend.last_name}`;
			friendSelect.appendChild(option);
		});

		// Set selected value if exists in settings
		const settings = getCustomSettings();
		if (settings.splitwiseFriendId) {
			friendSelect.value = settings.splitwiseFriendId;
		}
	}
	catch (error) {
		console.error('Error loading Splitwise friends:', error);
		friendSelect.innerHTML = '<option value="">Error loading friends</option>';
	}
}

// Add function to load Splitwise groups
async function loadSplitwiseGroups(): Promise<void> {
	const groupSelect = document.getElementById('splitwise-utility-group-id') as HTMLSelectElement;
	const creditCardGroupSelect = document.getElementById('credit-card-payment-group-id') as HTMLSelectElement;
	if (!groupSelect && !creditCardGroupSelect) return;

	try {
		const groups = await getSplitwiseGroups();

		// Helper function to populate a group select dropdown
		const populateGroupSelect = (select: HTMLSelectElement, selectedValue: string) => {
			// Clear existing options
			select.innerHTML = '';

			// Add default option
			const defaultOption = document.createElement('option');
			defaultOption.value = '0';
			defaultOption.textContent = 'Select a group';
			select.appendChild(defaultOption);

			// Add group options
			groups.forEach((group: any) => {
				const option = document.createElement('option');
				option.value = group.id;
				option.textContent = group.name;
				select.appendChild(option);
			});

			// Set selected value
			select.value = selectedValue;
		};

		// Get current settings
		const settings = getCustomSettings();

		// Populate utility groups dropdown
		if (groupSelect) {
			populateGroupSelect(groupSelect, settings.splitwiseUtilityGroupId.toString());
		}

		// Populate credit card payment groups dropdown
		if (creditCardGroupSelect) {
			populateGroupSelect(creditCardGroupSelect, settings.creditCardPaymentGroupId.toString());
		}
	}
	catch (error) {
		console.error('Error loading Splitwise groups:', error);
		const errorOption = '<option value="0">Error loading groups</option>';
		if (groupSelect)
			groupSelect.innerHTML = errorOption;
		if (creditCardGroupSelect)
			creditCardGroupSelect.innerHTML = errorOption;
	}
}
// Update function to load Splitwise data
export async function loadSplitwiseData(): Promise<void> {
	try {
		const settings = getCustomSettings();
		// Load user ID if not already stored
		if (!settings.splitwiseUserId) {
			const userId = await getCurrentSplitwiseUser();
			if (userId) {
				setConfigValue('splitwiseUserId', userId);
			}
		}
		// Load both friends and groups lists
		await loadSplitwiseFriends();
		await loadSplitwiseGroups();
	}
	catch (error) {
		showToast("Failed to load Splitwise data. Please ensure you're logged in to Splitwise.", ToastType.ERROR);
		// Reset the Splitwise button since we couldn't load the data
		const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;
		if (showPostToSplitwiseCheckbox) {
			showPostToSplitwiseCheckbox.checked = false;
		}
		setConfigValue('showPostToSplitwiseButton', false);
	}
}
// Use the passed in settingValues object which contains the 'mmm-settings' to obtain the setting value, otherwise get from local storage
function getConfigValue(key, settingValues) {
	const customSettings = getCustomSettings();
	return settingValues?.[key] || customSettings[key] || '';
}
// Function to set all the config values
export function saveConfigValues(settings) {
	Object.keys(settings).forEach(key => {
		setConfigValue(key, settings[key]);
	});
}
// Function to set a config value
function setConfigValue(key, value) {
	const customSettings = getCustomSettings();
	customSettings[key] = value;
	saveCustomSettings(customSettings);
}
// Function to detect the current theme
function detectTheme(): 'dark' | 'light' {
	const pageRoot = document.querySelector('div[class^="Page__Root"]');
	if (pageRoot?.classList.contains('jyUbNP')) {
		return 'dark';
	}
	else if (pageRoot?.classList.contains('jAzUjM')) {
		return 'light';
	}
	return 'light'; // Default to light theme if no theme is detected
}
