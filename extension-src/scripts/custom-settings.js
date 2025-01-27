// Function to add the custom settings link
function addCustomSettingsLink() {
  
    // Add custom settings section
    const settingsContainer = document.querySelector('div[class*="Settings__SubNavCard"]').querySelector('div[class^="Menu"]');

    // Check if the settings container exists and if the custom settings link doesn't already exist
    if (settingsContainer && !document.getElementById('mmm-custom-settings-anchor')) {
        
        // Detect the current class of a child of the settings container that doesn't have the class "nav-item-active" applied to it,
        // and add it to the custom settings link
        const existingChildAnchorElementStyles = settingsContainer.querySelector('a:not([class*="nav-item-active"])');
        const existingDivElementStyles = existingChildAnchorElementStyles.querySelector('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

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
        const existingChildAnchorElementStyles = settingsContainer.querySelector('a:not([class*="nav-item-active"])');
        const existingDivElementStyles = existingChildAnchorElementStyles.querySelector('div[class^="Menu__MenuItem"]:not([class*="nav-item-active"])');

        if (existingChildAnchorElementStyles) document.getElementById('mmm-custom-settings-anchor').className = existingChildAnchorElementStyles.className;
        if (existingDivElementStyles) document.getElementById('mmm-custom-settings-div').className = existingDivElementStyles.className;
    }
}


// Function to apply the correct modal styles
function applyModalStyles(modal) {
    const theme = detectTheme();
    if (theme === 'dark') {
        modal.classList.add('mmm-modal-dark');
        modal.querySelector('.mmm-modal-content').classList.add('mmm-modal-content-dark');
        modal.querySelector('.mmm-modal-header').classList.add('mmm-modal-header-dark');
        modal.querySelector('.mmm-modal-body').classList.add('mmm-modal-body-dark');
        modal.querySelector('.mmm-modal-close').classList.add('mmm-modal-close-dark');
    } else {
        modal.classList.add('mmm-modal-light');
        modal.querySelector('.mmm-modal-content').classList.add('mmm-modal-content-light');
        modal.querySelector('.mmm-modal-header').classList.add('mmm-modal-header-light');
        modal.querySelector('.mmm-modal-body').classList.add('mmm-modal-body-light');
        modal.querySelector('.mmm-modal-close').classList.add('mmm-modal-close-light');
    }
}

// Function to create the custom settings modal
async function showCustomSettingsModal() {
    // Get the theme
    let theme = detectTheme();
    // Get all the tags
    var allTags = await graphqlHelpers.getTagIdWithTagName();
    // Get all the accounts
    var allAccounts = await graphqlHelpers.getAllAccountDetails();

    // Extract account IDs and account names, and sort by account name
    const accountIdsNames = allAccounts.accountTypeSummaries.flatMap(accountType => 
        accountType.accounts.map(account => ({ id: account.id, name: account.displayName }))
    ).sort((a, b) => a.name.localeCompare(b.name));

    // Create modal HTML
    const modalHtml = createModalHtml(allTags, accountIdsNames, theme);

    // Add modal to body if it doesn't already exist
    if (!document.getElementById("mmm-settings-modal")) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Get modal element
    const modal = document.getElementById("mmm-settings-modal");

    // Show modal with fade in
    // modal.style.display = 'flex'; // Changed to flex to match CSS
    setTimeout(() => {
        modal.classList.add('show');
        // Load settings and set the modal values
        loadSettingsAndSetModalValues();
    }, 10);

    // Attach event listeners to the modal
    attachModalEventListeners(modal);

    // Close modal on outside click with fade out
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 500); // Match the transition-slow timing
        }
    });

    // Send a message to the background script to fire an analytics event
    chrome.runtime.sendMessage({ 
        type: 'analyticsEventSuccess', 
        eventName: 'mmm_custom_settings_modal_opened',
        params: { theme: theme }
    });
}


//------------------ HELPER FUNCTIONS ------------------

// Function to attach event listeners to the modal
function attachModalEventListeners(modal) {
    // Save settings on change
    modal.addEventListener('change', (e) => {

        showHideSettingItems();

        setConfigValue('showSplitButtonForUnsplitTransactions', document.getElementById('show-split-button-for-unsplit-transactions').checked);
        setConfigValue('splitWithPartnerTagName', document.getElementById('split-with-partner-tag-name').value);
        setConfigValue('splitWithPartnerAccountId', document.getElementById('split-with-partner-account-id').value);
        setConfigValue('showSplitButtonOnAllAccounts', document.getElementById('show-split-button-on-all-accounts').checked);
        setConfigValue('showUnsplitButtonForSplitTransactions', document.getElementById('show-unsplit-button-for-split-transactions').checked);
        setConfigValue('tagSplitTransactions', document.getElementById('tag-split-transactions').checked);

    });

    // Close modal on X click with fade out
    const closeBtn = modal.querySelector('.mmm-modal-close');
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 500); // Match the transition-slow timing
    });
}

// Use the passed in settingValues object which contains the 'mmm-settings' to obtain the setting value, otherwise get from local storage
function getConfigValue(key, settingValues) {
    return settingValues?.[key] || JSON.parse(localStorage.getItem('mmm-settings') || '{}')[key] || '';
}

// Function to set a config value
function setConfigValue(key, value) {
    const settings = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
    settings[key] = value;
    localStorage.setItem('mmm-settings', JSON.stringify(settings));
}

// Function to hide a setting item
function hideSettingItem(settingItem) {
    settingItem.style.maxHeight = '0';
    settingItem.style.opacity = '0';
    settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)';
    setTimeout(() => settingItem.style.display = 'none', 500);
}

// Function to show a setting item
function showSettingItem(settingItem) {
    settingItem.style.display = 'block';
    settingItem.style.maxHeight = settingItem.scrollHeight + 'px'; // Set to full height for animation
    settingItem.style.opacity = '1';
    setTimeout(() => settingItem.style.transition = 'max-height var(--transition-slow), opacity var(--transition-slow)', 500);
}

// Get the custom settings values and set defaults if they are not set, and return the values
function getCustomSettings() {
    let customSettingsValues = JSON.parse(localStorage.getItem('mmm-settings') || '{}');

    // Set defaults if the custom settings are empty
    if (Object.keys(customSettingsValues).length === 0)  {
        customSettingsValues = {
            splitWithPartnerTagName: "",
            splitWithPartnerAccountId: "",
            showSplitButtonForUnsplitTransactions: true,
            showSplitButtonOnAllAccounts: true,
            showUnsplitButtonForSplitTransactions: false,
            tagSplitTransactions: false,
        };
    }

    return customSettingsValues;
}

// Function to detect the current theme
function detectTheme() {
    const pageRoot = document.querySelector('div[class^="Page__Root"]');
    if (pageRoot.classList.contains('jyUbNP')) {
        return 'dark';
    } else if (pageRoot.classList.contains('jAzUjM')) {
        return 'light';
    }
    return 'light'; // Default to light theme if no theme is detected
}

// Function to create the modal HTML
function createModalHtml(allTags, accountIdsNames, theme) {

    const modalHtml = `
    <div id="mmm-settings-modal" class="mmm-modal mmm-modal-${theme}">
        <div class="mmm-modal-content mmm-modal-content-${theme}">
            <div class="mmm-modal-header mmm-modal-header-${theme}">
                <h2>MMM Extensions Custom Settings</h2>
                <span class="mmm-modal-close mmm-modal-close-${theme}">&times;</span>
            </div>
            <div class="mmm-modal-body mmm-modal-body-${theme}">
                <div class="mmm-settings-section">

                    <div class="mmm-setting-item">
                        <div class="mmm-setting-item-content">
                            <label>Show Split Button for Unsplit Transactions</label>
                            <label class="toggle-switch">
                                <input type="checkbox" id="show-split-button-for-unsplit-transactions" />
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
                                <input type="checkbox" id="show-split-button-on-all-accounts" />
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
                                <select class="mmm-setting-dropdown" id="split-with-partner-account-id" style="max-width: 100%;">
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
                                <input type="checkbox" id="show-unsplit-button-for-split-transactions" />
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
                                <input type="checkbox" id="tag-split-transactions" />
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
                                <select class="mmm-setting-dropdown" id="split-with-partner-tag-name">
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
        </div>
    </div>`;

    // Return the modal HTML
    return modalHtml;
}

// Function to load settings and set the modal values
function loadSettingsAndSetModalValues() {
    // Load settings when opening modal
    const settings = JSON.parse(localStorage.getItem('mmm-settings') || '{}');
    document.getElementById('show-split-button-for-unsplit-transactions').checked = settings.showSplitButtonForUnsplitTransactions || false;
    document.getElementById('split-with-partner-tag-name').value = settings.splitWithPartnerTagName || '';
    document.getElementById('split-with-partner-account-id').value = settings.splitWithPartnerAccountId || '';
    document.getElementById('show-split-button-on-all-accounts').checked = settings.showSplitButtonOnAllAccounts || false;
    document.getElementById('show-unsplit-button-for-split-transactions').checked = settings.showUnsplitButtonForSplitTransactions || false;
    document.getElementById('tag-split-transactions').checked = settings.tagSplitTransactions || false;

    showHideSettingItems();
}

// Function to show or hide setting items based on the settings
function showHideSettingItems() {

    // Get references to the setting items in the modal
    const showSplitButtonOnAllAccountsSettingItem = document.getElementById('mmm-setting-item-show-split-button-on-all-accounts');
    const splitWithPartnerAccountIdSettingItem = document.getElementById('mmm-setting-item-split-with-partner-account-id');
    const splitWithPartnerTagSettingItem = document.getElementById('mmm-setting-item-split-with-partner-tag-name');

    if (!document.getElementById('show-split-button-for-unsplit-transactions').checked) {
        hideSettingItem(showSplitButtonOnAllAccountsSettingItem);
        hideSettingItem(splitWithPartnerAccountIdSettingItem);
    }
    else {
        showSettingItem(showSplitButtonOnAllAccountsSettingItem);
        showSettingItem(splitWithPartnerAccountIdSettingItem);
    }

    if (document.getElementById('show-split-button-on-all-accounts').checked) {
        hideSettingItem(splitWithPartnerAccountIdSettingItem);
    } else {
        showSettingItem(splitWithPartnerAccountIdSettingItem);
    }

    if (!document.getElementById('tag-split-transactions').checked) {
        hideSettingItem(splitWithPartnerTagSettingItem);
    } else {
        showSettingItem(splitWithPartnerTagSettingItem);
    }
}   

// Export the functions to be used in the main script
window.customSettings = {
    addCustomSettingsLink: addCustomSettingsLink,
    applyModalStyles: applyModalStyles,
    showCustomSettingsModal: showCustomSettingsModal,
    getConfigValue: getConfigValue,
    setConfigValue: setConfigValue,
    getCustomSettings: getCustomSettings
}   
