import type { CustomSettings } from "./types/entities/CustomSettings.js";
import { getTagIdWithTagName, getAllAccountDetails } from "./helper-graphql.js";


const DEFAULT_SETTINGS: CustomSettings = {
    splitWithPartnerTagName: "",
    splitWithPartnerAccountId: "",
    showSplitButtonForUnsplitTransactions: true,
    showSplitButtonOnAllAccounts: true,
    showUnsplitButtonForSplitTransactions: false,
    tagSplitTransactions: false,
    rememberNetWorthDuration: false
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

		// Show modal on click. Do a fade in transition
		customSettingsDivElement.addEventListener('click', () => {
			showCustomSettingsModal();
		});

		// Add the custom settings link to the anchor element   
		customSettingsAnchorElement.appendChild(customSettingsDivElement);

		// Add the anchor element to the settings container
		settingsContainer.appendChild(customSettingsAnchorElement);

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
    const allTags = await getTagIdWithTagName();
    const accountIdsNames = await getAllAccountDetails();
    if (!accountIdsNames) return;

    // Create the modal
    createModalHtml(Array.isArray(allTags) ? allTags : [allTags], accountIdsNames, theme);

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
    chrome.runtime.sendMessage({ 
        type: 'analyticsEventSuccess', 

        eventName: 'mmm_custom_settings_modal_opened',
        params: { theme: theme }
    });

}

//------------------ HELPER FUNCTIONS ------------------

// Function to apply the correct modal styles
// function applyModalStyles(modal: HTMLElement): void {
//     const theme = detectTheme();
//     if (theme === 'dark') {
//         modal.classList.add('mmm-modal-dark');
//         modal.querySelector('.mmm-modal-content')?.classList.add('mmm-modal-content-dark');
//         modal.querySelector('.mmm-modal-header')?.classList.add('mmm-modal-header-dark');
//         modal.querySelector('.mmm-modal-body')?.classList.add('mmm-modal-body-dark');
//         modal.querySelector('.mmm-modal-close')?.classList.add('mmm-modal-close-dark');
//     } else {
//         modal.classList.add('mmm-modal-light');
//         modal.querySelector('.mmm-modal-content')?.classList.add('mmm-modal-content-light');
//         modal.querySelector('.mmm-modal-header')?.classList.add('mmm-modal-header-light');
//         modal.querySelector('.mmm-modal-body')?.classList.add('mmm-modal-body-light');
//         modal.querySelector('.mmm-modal-close')?.classList.add('mmm-modal-close-light');
//     }
// }

// Function to attach event listeners to the modal
function attachModalEventListeners(modal: HTMLElement): void {
    // Save settings on change
    modal.addEventListener('change', (e: Event) => {
        showHideSettingItems();
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
function createModalHtml(allTags: any[], accountIdsNames: {id: string, name: string}[], theme: 'dark' | 'light'): void {

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
                        <h3>Other Settings</h3>
                        <span class="mmm-setting-arrow">▶</span>
                    </div>
                    <div class="mmm-setting-content collapsed">
                        <div class="mmm-setting-item">
                            <div class="mmm-setting-item-content">
                                <label>Remember Net Worth Duration</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" data-setting-name="rememberNetWorthDuration" id="remember-net-worth-duration" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="mmm-modal-body-text-small">
                                Remember the net worth duration selected from the dropdown
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
function loadSettingsAndSetModalValues(): void {
    const settings = getCustomSettings();
    const showSplitCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
    const tagNameSelect = document.getElementById('split-with-partner-tag-name') as HTMLSelectElement;
    const accountIdSelect = document.getElementById('split-with-partner-account-id') as HTMLSelectElement;
    const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
    const showUnsplitCheckbox = document.getElementById('show-unsplit-button-for-split-transactions') as HTMLInputElement;
    const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;

    showSplitCheckbox.checked = settings.showSplitButtonForUnsplitTransactions || false;
    tagNameSelect.value = settings.splitWithPartnerTagName || '';
    accountIdSelect.value = settings.splitWithPartnerAccountId || '';
    showAllAccountsCheckbox.checked = settings.showSplitButtonOnAllAccounts || false;
    showUnsplitCheckbox.checked = settings.showUnsplitButtonForSplitTransactions || false;
    tagTransactionsCheckbox.checked = settings.tagSplitTransactions || false;

    showHideSettingItems();
}

// Function to show or hide setting items based on the settings
function showHideSettingItems(): void {
    const showSplitCheckbox = document.getElementById('show-split-button-for-unsplit-transactions') as HTMLInputElement;
    const showAllAccountsCheckbox = document.getElementById('show-split-button-on-all-accounts') as HTMLInputElement;
    const tagTransactionsCheckbox = document.getElementById('tag-split-transactions') as HTMLInputElement;

    const showSplitSettingItem = document.getElementById('mmm-setting-item-show-split-button-on-all-accounts') as HTMLElement;
    const accountIdSettingItem = document.getElementById('mmm-setting-item-split-with-partner-account-id') as HTMLElement;
    const tagSettingItem = document.getElementById('mmm-setting-item-split-with-partner-tag-name') as HTMLElement;

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



