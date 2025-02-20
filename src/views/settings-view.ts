/******************************************************************************************/
/* This file handles the settings view functionality of the extension.
/* It provides:
/* - Custom settings UI and modal management
/* - Settings persistence and retrieval
/* - Configuration for split transactions, tags, and accounts
/* - Theme detection and UI customization
/* - Net worth duration preferences
/******************************************************************************************/

import type { CustomSettings } from "../types/entities/CustomSettings.js";
import { getAllAccountDetails, getAllTags, getAllCategories } from "../helpers/helper-graphql.js";
import { HouseholdTransactionTag } from "../types/entities/HouseholdTransactionTag.js";
import { getSplitwiseFriends, getCurrentUser, getSplitwiseGroups } from "../helpers/helper-splitwise.js";
import { showToast, ToastType } from "../toast.js";

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
	splitwiseGroupId: 0,
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
function addCustomSettingsLink(): void {
	// Add custom settings section
	const settingsContainer = document.querySelector('div[class*="Settings__SubNavCard"]')?.querySelector('div[class^="Menu"]');

	// Check if the settings container exists and if the custom settings link doesn't already exist
	if (settingsContainer && !document.getElementById('mmm-custom-settings-anchor')) {

		// Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
		// and add it to the custom settings link
		const existingChildAnchorElementStyles = settingsContainer.querySelector<HTMLAnchorElement>('a:not([class*="nav-item-active"])');
		const existingDivElementStyles = existingChildAnchorElementStyles?.querySelector<HTMLDivElement>('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

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
	const accountIdsNames = await getAllAccountDetails();
	if (!accountIdsNames) return;

	// Create the modal
	createModalHtml(allTags, accountIdsNames, theme);

	const modal = document.getElementById("mmm-settings-modal") as HTMLElement;

	// Show the modal
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
		const target = e.target as HTMLInputElement;
		showHideSettingItems();

		// Special handling for Splitwise toggle
		if (target.id === 'show-post-to-splitwise' && target.checked) {
			await loadSplitwiseData();
		}

		const settingElements = document.querySelectorAll<HTMLInputElement>('[data-setting-name]');
		settingElements.forEach(el => {
			const value = el.type === 'checkbox' ? el.checked : el.value;
			setConfigValue(el.dataset.settingName! as keyof CustomSettings, value);
		});
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

// Use the passed in settingValues object which contains the 'mmm-settings' to obtain the setting value, otherwise get from local storage
function getConfigValue(key: string, settingValues?: Record<string, any>): boolean | string {
	const customSettings = loadSettings();
	return settingValues?.[key] || customSettings[key as keyof CustomSettings] || '';
}

// Function to set all the config values
export function saveConfigValues(settings: CustomSettings): void {
	Object.keys(settings).forEach(key => {
		setConfigValue(key as keyof CustomSettings, settings[key as keyof CustomSettings]);
	});
}

// Function to set a config value

function setConfigValue<K extends keyof CustomSettings>(key: K, value: CustomSettings[K]): void {
	const customSettings = loadSettings();
	customSettings[key] = value;
	saveSettings(customSettings);
}


// Function to hide a setting item
function hideSettingItem(settingItem: HTMLElement): void {
	settingItem.style.maxHeight = '0';
	settingItem.style.opacity = '0';
	settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)';
	setTimeout(() => settingItem.style.display = 'none', 500);
}

// Function to show a setting item
function showSettingItem(settingItem: HTMLElement): void {
	settingItem.style.display = 'block';
	settingItem.style.maxHeight = settingItem.scrollHeight + 'px'; // Set to full height for animation
	settingItem.style.opacity = '1';
	setTimeout(() => settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)', 500);
}

// Get the custom settings values and set defaults if they are not set, and return the values
export function getCustomSettings(): CustomSettings {
	return loadSettings();
}


// Function to detect the current theme
function detectTheme(): 'dark' | 'light' {
	const pageRoot = document.querySelector<HTMLElement>('div[class^="Page__Root"]');

	if (pageRoot?.classList.contains('jyUbNP')) {
		return 'dark';
	} else if (pageRoot?.classList.contains('jAzUjM')) {
		return 'light';
	}
	return 'light'; // Default to light theme if no theme is detected
}

// Function to create the modal HTML
function createModalHtml(allTags: HouseholdTransactionTag[], accountIdsNames: { id: string, name: string }[], theme: 'dark' | 'light'): void {
	const modalHtml = `
    <div id="mmm-settings-modal" class="mmm-modal mmm-modal-${theme}">
        <div class="mmm-modal-content mmm-modal-content-${theme}">

            <div class="mmm-modal-header mmm-modal-header-${theme}">
                <h2>MMM Extensions Custom Settings</h2>
                <span class="mmm-modal-close mmm-modal-close-${theme}">&times;</span>
            </div>

            <div class="mmm-modal-body mmm-modal-body-${theme}">

                <div class="mmm-settings-section">
                    <div class="mmm-setting-header-${theme} collapsed">
                        <h3>Split Transaction Settings</h3>
                        <span class="mmm-setting-arrow">▶</span>
                    </div>
                    <div class="mmm-setting-content collapsed">
                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Show Split Button for Unsplit Transactions</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="showSplitButtonForUnsplitTransactions" id="show-split-button-for-unsplit-transactions" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the split button for transactions from the unsplit account
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-show-split-button-on-all-accounts">
                            <div class="mmm-setting-item-content">
                                <label>Show Split Button On All Accounts</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="showSplitButtonOnAllAccounts" id="show-split-button-on-all-accounts" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the split button for transactions from all accounts
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-split-with-partner-account-id">
                            <div class="mmm-setting-item-content-input">
                                <label>Select Specific Account to Split Transactions</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative; overflow: hidden;">
                                    <select class="mmm-setting-dropdown" data-setting-name="splitWithPartnerAccountId" id="split-with-partner-account-id" style="max-width: 100%;">
                                        ${accountIdsNames ? accountIdsNames.map(account => `
                                            <option value="${account.id}">
                                                ${account.name}
                                            </option>
                                        `).join('') : ''}
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                The account that you want to show the split button for
                            </div>
                        </div>

                        <div class="mmm-setting-divider"></div>

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Show Unsplit Button for Split Transactions</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="showUnsplitButtonForSplitTransactions" id="show-unsplit-button-for-split-transactions" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the unsplit button for split transactions
                            </div>
                        </div>

                        <div class="mmm-setting-divider"></div>

                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Tag Split Transactions</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="tagSplitTransactions" id="tag-split-transactions" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Tag split transactions with a tag
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-split-with-partner-tag-name">
                            <div class="mmm-setting-item-content-input">
                                <label>Split With Partner Tag Name</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="splitWithPartnerTagName" id="split-with-partner-tag-name">
                                        ${allTags ? allTags.map(tag => `
                                            <option value="${tag.name}" style="background-color: ${tag.color};">
                                                ${tag.name}
                                            </option>
                                        `).join('') : ''}
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                The name of the tag to use when splitting transactions with a partner
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mmm-settings-section">
                    <div class="mmm-setting-header-${theme} collapsed">
                        <h3>Splitwise Settings</h3>
                        <span class="mmm-setting-arrow">▶</span>
                    </div>
                    <div class="mmm-setting-content collapsed">
                        <div class="mmm-setting-item" id="mmm-setting-item-post-to-splitwise">
                            <div class="mmm-setting-item-content">
                                <label>Show Split & Post to Splitwise Button</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="showPostToSplitwiseButton" id="show-post-to-splitwise" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Show the split and post to Splitwise button
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-splitwise-friend">
                            <div class="mmm-setting-item-content-input">
                                <label>Select Splitwise Friend</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="splitwiseFriendId" id="splitwise-friend-id">
                                        <option value="">Loading friends...</option>
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                The friend to split expenses with on Splitwise
                            </div>
                        </div>

                        <div class="mmm-setting-divider"></div>

						
                        <div class="mmm-setting-item" id="mmm-setting-item-splitwise-group">
                            <div class="mmm-setting-item-content-input">
                                <label>Select Splitwise Group To Post Utility Expenses</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="splitwiseGroupId" id="splitwise-group-id">
                                        <option value="0">Loading groups...</option>
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Optional: Select a group to post expenses to
                            </div>
                        </div>

                        <div class="mmm-setting-divider"></div>

						<div class="mmm-setting-item" id="mmm-setting-item-handle-utilities">
							<div class="mmm-setting-item-content">
								<label>Handle Utilities</label>
								<label class="toggle-switch">
									<input type="checkbox" data-setting-name="handleUtilities" id="handle-utilities" />
									<span class="slider"></span>
								</label>
							</div>
							<div class="mmm-modal-body-text-small">
								Automatically post utility bills to the selected Splitwise group
							</div>
						</div>

						<div class="mmm-setting-item" id="mmm-setting-item-utility-categories">
							<div class="mmm-setting-item-content-column">
								<label class="mmm-setting-label">Select Utility Categories</label>
								<div class="mmm-modal-body-text-small">
									Select which categories should be considered utilities. Use the search box to filter categories.
								</div>
								<div class="mmm-setting-categories-container" id="utility-categories-container">
									<div class="mmm-categories-search">
										<input type="text" id="categories-search" placeholder="Search categories..." />
									</div>
									<div class="mmm-categories-grid">Loading categories...</div>
								</div>
							</div>
						</div>

                        <div class="mmm-setting-divider"></div>

                        <div class="mmm-setting-item" id="mmm-setting-item-handle-credit-card-payments">
                            <div class="mmm-setting-item-content">
                                <label>Handle Credit Card Payments</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="handleCreditCardPayments" id="handle-credit-card-payments" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Automatically post credit card payments to a Splitwise group
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-credit-card-payment-group">
                            <div class="mmm-setting-item-content-input">
                                <label>Select Splitwise Group For Credit Card Payments</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="creditCardPaymentGroupId" id="credit-card-payment-group-id">
                                        <option value="0">Loading groups...</option>
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Select a group to post credit card payments to
                            </div>
                        </div>

                        <div class="mmm-setting-item" id="mmm-setting-item-transaction-posted-to-splitwise-tag-name">
                            <div class="mmm-setting-item-content-input">
                                <label>Select Tag For Credit Card Payments</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="transactionPostedToSplitwiseTagName" id="transaction-posted-to-splitwise-tag-name">
                                        ${allTags ? allTags.map(tag => `
                                            <option value="${tag.name}" style="background-color: ${tag.color};">
                                                ${tag.name}
                                            </option>
                                        `).join('') : ''}
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Select a tag to mark credit card payment transactions
                            </div>
                        </div>

                	</div>
				</div>

                <div class="mmm-settings-section">
                    <div class="mmm-setting-header-${theme} collapsed">
                        <h3>Other Settings</h3>
                        <span class="mmm-setting-arrow">▶</span>
                    </div>
                    <div class="mmm-setting-content collapsed">
                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content-input">
                                <label>Default Net Worth Duration</label>
                                <div class="mmm-setting-input-${theme}" style="position: relative;">
                                    <select class="mmm-setting-dropdown" data-setting-name="defaultNetWorthDuration" id="default-net-worth-duration">
                                        <option value="1M">1 Month</option>
                                        <option value="3M">3 Months</option>
                                        <option value="6M">6 Months</option>
                                        <option value="YTD">Year to date</option>
                                        <option value="1Y">1 Year</option>
                                        <option value="ALL">All time</option>
                                    </select>
                                    <span class="mmm-setting-input-arrow">
                                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Default net worth duration to display on the accounts page
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>`;

	// Add modal to body if it doesn't already exist
	if (!document.getElementById("mmm-settings-modal")) {
		document.body.insertAdjacentHTML('beforeend', modalHtml);
	}

	// Handle setting section collapse. When one of the headers is clicked, expans/collapse just that header
	// and all other headers should collapse
	document.querySelectorAll(`.mmm-setting-header-${theme}`).forEach(header => {
		header.addEventListener('click', () => {
			// Collapse all other headers
			document.querySelectorAll(`.mmm-setting-header-${theme}`).forEach(otherHeader => {
				if (otherHeader !== header) {
					otherHeader.classList.add('collapsed');
					otherHeader.nextElementSibling?.classList.add('collapsed');
					otherHeader.querySelector('.mmm-setting-arrow')!.textContent = '▶';
				}
			});

			// Toggle clicked header
			header.classList.toggle('collapsed');
			const content = header.nextElementSibling;
			const arrow = header.querySelector('.mmm-setting-arrow');
			if (content && arrow) {
				content.classList.toggle('collapsed');
				arrow.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
			}
		});
	});
}

// Function to load settings and set the modal values
async function loadSettingsAndSetModalValues(): Promise<void> {
	const settings = getCustomSettings();

	const showSplitCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
	const tagNameSelect = document.getElementById('split-with-partner-tag-name') as HTMLSelectElement;
	const accountIdSelect = document.getElementById('split-with-partner-account-id') as HTMLSelectElement;
	const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
	const showUnsplitCheckbox = document.getElementById('show-unsplit-button-for-split-transactions') as HTMLInputElement;
	const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;
	const defaultNetWorthDurationSelect = document.getElementById('default-net-worth-duration') as HTMLSelectElement;
	const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;
	const splitwiseGroupSelect = document.getElementById('splitwise-group-id') as HTMLSelectElement;

	showSplitCheckbox.checked = settings.showSplitButtonForUnsplitTransactions || false;
	tagNameSelect.value = settings.splitWithPartnerTagName || '';
	accountIdSelect.value = settings.splitWithPartnerAccountId || '';
	showAllAccountsCheckbox.checked = settings.showSplitButtonOnAllAccounts || false;
	showUnsplitCheckbox.checked = settings.showUnsplitButtonForSplitTransactions || false;
	tagTransactionsCheckbox.checked = settings.tagSplitTransactions || false;
	defaultNetWorthDurationSelect.value = settings.defaultNetWorthDuration || 'YTD';
	showPostToSplitwiseCheckbox.checked = settings.showPostToSplitwiseButton || false;
	splitwiseGroupSelect.value = settings.splitwiseGroupId.toString() || '0';

	const handleUtilitiesCheckbox = document.getElementById('handle-utilities') as HTMLInputElement;
	handleUtilitiesCheckbox.checked = settings.handleUtilities || false;

	// Load categories for utilities
	const categoriesContainer = document.getElementById('utility-categories-container');
	if (categoriesContainer) {
		try {
			const categories = await getAllCategories();
			const categoriesGridDiv = document.createElement('div');
			categoriesGridDiv.className = 'mmm-categories-grid';

			categoriesGridDiv.innerHTML = categories.map(category => `
				<div class="mmm-category-checkbox-wrapper">
					<label class="mmm-category-checkbox">
						<input type="checkbox" 
							id="category-${category.id}" 
							value="${category.id}"
							${settings.utilityCategories.includes(category.id) ? 'checked' : ''}
							class="utility-category-checkbox"
						/>
						<span class="mmm-checkbox-custom"></span>
						<span class="mmm-category-label">${category.name}</span>
					</label>
				</div>
			`).join('');

			// Add search functionality - use existing search input if it exists
			const existingSearch = document.getElementById('categories-search');
			let searchInput: HTMLInputElement;

			if (existingSearch) {
				searchInput = existingSearch as HTMLInputElement;
			} else {
				searchInput = document.createElement('input');
				searchInput.type = 'text';
				searchInput.id = 'categories-search';
				searchInput.className = 'mmm-categories-search-input';
				searchInput.placeholder = 'Search categories...';
			}

			searchInput.addEventListener('input', (e) => {
				const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
				const checkboxWrappers = categoriesGridDiv.querySelectorAll('.mmm-category-checkbox-wrapper');

				checkboxWrappers.forEach(wrapper => {
					const label = wrapper.querySelector('.mmm-category-label');
					if (label) {
						const text = label.textContent?.toLowerCase() || '';
						(wrapper as HTMLElement).style.display = text.includes(searchTerm) ? '' : 'none';
					}
				});
			});

			const searchDiv = document.createElement('div');
			searchDiv.className = 'mmm-categories-search';
			if (!existingSearch) {
				searchDiv.appendChild(searchInput);
			}

			categoriesContainer.innerHTML = '';
			categoriesContainer.appendChild(searchDiv);
			categoriesContainer.appendChild(categoriesGridDiv);

			// Add event listeners to checkboxes
			const checkboxes = categoriesGridDiv.querySelectorAll('.utility-category-checkbox');
			checkboxes.forEach(checkbox => {
				checkbox.addEventListener('change', (e) => {
					const target = e.target as HTMLInputElement;
					const settings = loadSettings();
					const categories = settings.utilityCategories || [];

					if (target.checked && !categories.includes(target.value)) {
						categories.push(target.value);
					} else if (!target.checked) {
						const index = categories.indexOf(target.value);
						if (index > -1) {
							categories.splice(index, 1);
						}
					}

					setConfigValue('utilityCategories', categories);
				});
			});
		} catch (error) {
			console.error('Error loading categories:', error);
			categoriesContainer.innerHTML = 'Error loading categories';
		}
	}

	const handleCreditCardPaymentsCheckbox = document.getElementById('handle-credit-card-payments') as HTMLInputElement;
	const creditCardPaymentGroupSelect = document.getElementById('credit-card-payment-group-id') as HTMLSelectElement;
	const transactionPostedToSplitwiseTagName = document.getElementById('transaction-posted-to-splitwise-tag-name') as HTMLSelectElement;

	handleCreditCardPaymentsCheckbox.checked = settings.handleCreditCardPayments || false;
	creditCardPaymentGroupSelect.value = settings.creditCardPaymentGroupId.toString() || '0';
	transactionPostedToSplitwiseTagName.value = settings.transactionPostedToSplitwiseTagName || '';

	showHideSettingItems();

	// Load Splitwise data if button is checked
	if (showPostToSplitwiseCheckbox.checked) {
		await loadSplitwiseData();
	}
}

// Function to show or hide setting items based on the settings
function showHideSettingItems(): void {
	const showSplitCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
	const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
	const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;
	const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;

	const showSplitSettingItem = document.getElementById('mmm-setting-item-show-split-button-on-all-accounts') as HTMLElement;
	const accountIdSettingItem = document.getElementById('mmm-setting-item-split-with-partner-account-id') as HTMLElement;
	const tagSettingItem = document.getElementById('mmm-setting-item-split-with-partner-tag-name') as HTMLElement;
	const splitwiseFriendSettingItem = document.getElementById('mmm-setting-item-splitwise-friend') as HTMLElement;
	const splitwiseGroupSettingItem = document.getElementById('mmm-setting-item-splitwise-group') as HTMLElement;

	const handleUtilitiesCheckbox = document.getElementById('handle-utilities') as HTMLInputElement;
	const utilityCategoriesSettingItem = document.getElementById('mmm-setting-item-utility-categories') as HTMLElement;

	const handleCreditCardPaymentsCheckbox = document.getElementById('handle-credit-card-payments') as HTMLInputElement;
	const creditCardPaymentGroupSettingItem = document.getElementById('mmm-setting-item-credit-card-payment-group') as HTMLElement;
	const transactionPostedToSplitwiseTagNameSettingItem = document.getElementById('mmm-setting-item-transaction-posted-to-splitwise-tag-name') as HTMLElement;

	if (!showSplitCheckbox.checked) {
		hideSettingItem(showSplitSettingItem);
		hideSettingItem(accountIdSettingItem);
	} else {
		showSettingItem(showSplitSettingItem);
		showSettingItem(accountIdSettingItem);
	}

	if (showAllAccountsCheckbox.checked) {
		hideSettingItem(accountIdSettingItem);
	} else {
		showSettingItem(accountIdSettingItem);
	}

	if (!tagTransactionsCheckbox.checked) {
		hideSettingItem(tagSettingItem);
	} else {
		showSettingItem(tagSettingItem);
	}

	if (!showPostToSplitwiseCheckbox.checked) {
		hideSettingItem(splitwiseFriendSettingItem);
		hideSettingItem(splitwiseGroupSettingItem);
	} else {
		showSettingItem(splitwiseFriendSettingItem);
		showSettingItem(splitwiseGroupSettingItem);
	}

	if (!handleUtilitiesCheckbox.checked) {
		hideSettingItem(utilityCategoriesSettingItem);
	} else {
		showSettingItem(utilityCategoriesSettingItem);
	}

	if (!handleCreditCardPaymentsCheckbox.checked) {
		hideSettingItem(creditCardPaymentGroupSettingItem);
		hideSettingItem(transactionPostedToSplitwiseTagNameSettingItem);
	} else {
		showSettingItem(creditCardPaymentGroupSettingItem);
		showSettingItem(transactionPostedToSplitwiseTagNameSettingItem);
	}
}

// Function to load the settings from local storage
function loadSettings(): CustomSettings {
	const stored = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
	return { ...DEFAULT_SETTINGS, ...stored };
}

// Function to save the settings to local storage
function saveSettings(settings: CustomSettings): void {
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
		const settings = loadSettings();
		if (settings.splitwiseFriendId) {
			friendSelect.value = settings.splitwiseFriendId;
		}
	} catch (error) {
		console.error('Error loading Splitwise friends:', error);
		friendSelect.innerHTML = '<option value="">Error loading friends</option>';
	}
}

// Add function to load Splitwise groups
async function loadSplitwiseGroups(): Promise<void> {
	const groupSelect = document.getElementById('splitwise-group-id') as HTMLSelectElement;
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
		const settings = loadSettings();

		// Populate utility groups dropdown
		if (groupSelect) {
			populateGroupSelect(groupSelect, settings.splitwiseGroupId.toString());
		}

		// Populate credit card payment groups dropdown
		if (creditCardGroupSelect) {
			populateGroupSelect(creditCardGroupSelect, settings.creditCardPaymentGroupId.toString());
		}
	} catch (error) {
		console.error('Error loading Splitwise groups:', error);
		const errorOption = '<option value="0">Error loading groups</option>';
		if (groupSelect) groupSelect.innerHTML = errorOption;
		if (creditCardGroupSelect) creditCardGroupSelect.innerHTML = errorOption;
	}
}

// Update function to load Splitwise data
async function loadSplitwiseData(): Promise<void> {
	try {
		// Load user ID if not already stored
		const settings = getCustomSettings();
		if (!settings.splitwiseUserId) {
			const userId = await getCurrentUser();
			if (userId) {
				setConfigValue('splitwiseUserId', userId);
			}
		}

		// Load both friends and groups lists
		await Promise.all([
			loadSplitwiseFriends(),
			loadSplitwiseGroups()
		]);

	} catch (error) {
		showToast("Failed to load Splitwise data. Please ensure you're logged in to Splitwise.", ToastType.ERROR);
		// Reset the Splitwise button since we couldn't load the data
		const showPostToSplitwiseCheckbox = document.getElementById('show-post-to-splitwise') as HTMLInputElement;
		if (showPostToSplitwiseCheckbox) {
			showPostToSplitwiseCheckbox.checked = false;
		}
		setConfigValue('showPostToSplitwiseButton', false);
	}
}



