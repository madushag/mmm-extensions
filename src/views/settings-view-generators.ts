import { getCustomSettings, saveCustomSettings } from "./settings-view.js";
import { HouseholdTransactionTag } from "../types/entities/HouseholdTransactionTag.js";
import { getAllCategories } from "../helpers/helper-graphql.js";

// Helper function to generate tag options
export function generateTagOptions(allTags: HouseholdTransactionTag[] | undefined): string {
	return allTags ? allTags.map(tag => `
        <option value="${tag.name}" style="background-color: ${tag.color};">
            ${tag.name}
        </option>
    `).join('') : '';
}

// Helper function to generate arrow SVG
export function generateArrowSvg(): string {
	return `
    <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" size="16" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`;
}

// Generate modal structure
export function generateModalStructure(
	allTags: HouseholdTransactionTag[] | undefined,
	accountIdsNames: { id: string, name: string }[] | undefined,
	theme: 'dark' | 'light'
): string {
	return `
    <div id="mmm-settings-modal" class="mmm-modal mmm-modal-${theme}">
        <div class="mmm-modal-content mmm-modal-content-${theme}">
            ${generateModalHeader(theme)}
            <div class="mmm-modal-body mmm-modal-body-${theme}">
                ${generateSplitTransactionSection(allTags, accountIdsNames, theme)}
                ${generateSplitwiseSection(allTags, theme)}
                ${generateOtherSettingsSection(theme)}
            </div>
        </div>
    </div>`;
}

// Generate modal header
export function generateModalHeader(theme: 'dark' | 'light'): string {
	return `
    <div class="mmm-modal-header mmm-modal-header-${theme}">
        <h2>MMM Extensions Custom Settings</h2>
        <span class="mmm-modal-close mmm-modal-close-${theme}">&times;</span>
    </div>`;
}

// Generate split transaction section
export function generateSplitTransactionSection(
	allTags: HouseholdTransactionTag[] | undefined,
	accountIdsNames: { id: string, name: string }[] | undefined,
	theme: 'dark' | 'light'
): string {
	return `
    <div class="mmm-settings-section">
        <div class="mmm-setting-header-${theme} collapsed">
            <h3>Split Transaction Settings</h3>
            <span class="mmm-setting-arrow">▶</span>
        </div>
        <div class="mmm-setting-content collapsed">
            ${generateSplitButtonSettings(theme, accountIdsNames)}
            <div class="mmm-setting-divider"></div>
            ${generateUnsplitButtonSettings()}
            <div class="mmm-setting-divider"></div>
            ${generateTagSettings(allTags, accountIdsNames, theme)}
        </div>
    </div>`;
}

// Generate split button settings
export function generateSplitButtonSettings(
	theme: 'dark' | 'light',
	accountIdsNames: { id: string, name: string }[] | undefined
): string {
	return `
    <div class="mmm-setting-item">
        <div class="mmm-setting-item-content">
            <label>Show Split Button for Unsplit Transactions ✂️</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="showSplitButtonForUnsplitTransactions" id="show-split-button-for-unsplit-transactions" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Show the split button on unsplit transactions
        </div>
    </div>

    <div class="mmm-setting-item" id="mmm-setting-item-show-split-button-on-all-accounts">
        <div class="mmm-setting-item-content">
            <label>Show Split Button On All Accounts</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="showSplitButtonOnAllAccounts" id="show-split-button-on-all-accounts" />
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
                <select class="mmm-setting-dropdown" mmm-data-setting-name="splitWithPartnerAccountId" id="split-with-partner-account-id" style="max-width: 100%;">
                    ${accountIdsNames ? accountIdsNames.map(account => `
                        <option value="${account.id}">
                            ${account.name}
                        </option>
                    `).join('') : ''}
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            The account that you want to show the split button for
        </div>
    </div>`;
}

// Generate unsplit button settings
export function generateUnsplitButtonSettings(): string {
	return `
    <div class="mmm-setting-item">
        <div class="mmm-setting-item-content">
            <label>Show Unsplit Button for Split Transactions 🔀</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="showUnsplitButtonForSplitTransactions" id="show-unsplit-button-for-split-transactions" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Show the unsplit button for split transactions
        </div>
    </div>`;
}

// Generate tag settings
export function generateTagSettings(
	allTags: HouseholdTransactionTag[] | undefined,
	accountIdsNames: { id: string, name: string }[] | undefined,
	theme: 'dark' | 'light'
): string {
	return `
    <div class="mmm-setting-item">
        <div class="mmm-setting-item-content">
            <label>Tag Split Transactions</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="tagSplitTransactions" id="tag-split-transactions" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Automatically tag split transactions with a tag
        </div>
    </div>

    <div class="mmm-setting-item" id="mmm-setting-item-split-with-partner-tag-name">
        <div class="mmm-setting-item-content-input">
            <label>Tag For Split Transactions</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="splitWithPartnerTagName" id="split-with-partner-tag-name">
                    ${generateTagOptions(allTags)}
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            The name of the tag to use on split transactions
        </div>
    </div>`;
}

// Generate Splitwise section
export function generateSplitwiseSection(
	allTags: HouseholdTransactionTag[] | undefined,
	theme: 'dark' | 'light'
): string {
	return `
    <div class="mmm-settings-section">
        <div class="mmm-setting-header-${theme} collapsed" id="mmm-setting-header-splitwise">
            <h3>Splitwise Settings</h3>
            <span class="mmm-setting-arrow">▶</span>
        </div>
        <div class="mmm-setting-content collapsed">
            ${generateSplitwiseToggle()}
            <div id="splitwise-settings-group">
                ${generateSplitwiseFriendSettings(theme)}
                <div class="mmm-setting-divider"></div>
                ${generateUtilitySettings(theme)}
                <div class="mmm-setting-divider"></div>
                ${generateCreditCardSettings(theme, allTags)}
            </div>
        </div>
    </div>`;
}

// Generate Splitwise toggle
export function generateSplitwiseToggle(): string {
	return `
    <div class="mmm-setting-item">
        <div class="mmm-setting-item-content">
            <label>Show Split & Post to Splitwise Button 📤</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="showPostToSplitwiseButton" id="show-post-to-splitwise" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Show the split and post to Splitwise button
        </div>
    </div>`;
}

// Generate Splitwise friend settings
export function generateSplitwiseFriendSettings(theme: 'dark' | 'light'): string {
	return `
    <div class="mmm-setting-item" id="mmm-setting-item-splitwise-friend">
        <div class="mmm-setting-item-content-input">
            <label>Splitwise Friend</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="splitwiseFriendId" id="splitwise-friend-id">
                    <option value="">Loading friends...</option>
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            Select the friend to split expenses with on Splitwise
        </div>
    </div>`;
}

// Generate utility settings
export function generateUtilitySettings(theme: 'dark' | 'light'): string {
	return `
    <div class="mmm-setting-item" id="mmm-setting-item-handle-utilities">
        <div class="mmm-setting-item-content">
            <label>Handle Utilities 💡</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="handleUtilities" id="handle-utilities" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Post utility bills to the selected Splitwise group
        </div>
    </div>

    <div class="mmm-setting-item" id="mmm-setting-item-utility-categories">
        <div class="mmm-setting-item-content-column">
            <label class="mmm-setting-label">Utility Categories</label>
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

    <div class="mmm-setting-item" id="mmm-setting-item-splitwise-utility-group">
        <div class="mmm-setting-item-content-input">
            <label>Splitwise Group To Post Utility Expenses</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="splitwiseGroupId" id="splitwise-utility-group-id">
                    <option value="0">Loading groups...</option>
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            Select a group to post utility expenses to
        </div>
    </div>`;
}

// Generate credit card settings
export function generateCreditCardSettings(theme: 'dark' | 'light', allTags: HouseholdTransactionTag[] | undefined): string {
	return `
    <div class="mmm-setting-item" id="mmm-setting-item-handle-credit-card-payments">
        <div class="mmm-setting-item-content">
            <label>Handle Credit Card Payments 💳</label>
            <label class="toggle-switch">
                <input type="checkbox" mmm-data-setting-name="handleCreditCardPayments" id="handle-credit-card-payments" />
                <span class="slider"></span>
            </label>
        </div>
        <div class="mmm-modal-body-text-small">
            Post credit card payments to Splitwise
        </div>
    </div>

    <div class="mmm-setting-item" id="mmm-setting-item-credit-card-payment-group">
        <div class="mmm-setting-item-content-input">
            <label>Splitwise Group For Credit Card Payments</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="creditCardPaymentGroupId" id="credit-card-payment-group-id">
                    <option value="0">Loading groups...</option>
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            Select a group to post credit card payments to
        </div>
    </div>

    <div class="mmm-setting-item" id="mmm-setting-item-transaction-posted-to-splitwise-tag-name">
        <div class="mmm-setting-item-content-input">
            <label>Tag For Posted Transactions</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="transactionPostedToSplitwiseTagName" id="transaction-posted-to-splitwise-tag-name">
                    ${generateTagOptions(allTags)}
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            Select the tag to mark transactions posted to Splitwise
        </div>
    </div>`;
}

// Generate other settings section
export function generateOtherSettingsSection(theme: 'dark' | 'light'): string {
	return `
    <div class="mmm-settings-section">
        <div class="mmm-setting-header-${theme} collapsed">
            <h3>Other Settings</h3>
            <span class="mmm-setting-arrow">▶</span>
        </div>
        <div class="mmm-setting-content collapsed">
            ${generateNetWorthSettings(theme)}
        </div>
    </div>`;
}

// Generate net worth settings
export function generateNetWorthSettings(theme: 'dark' | 'light'): string {
	return `
    <div class="mmm-setting-item">
        <div class="mmm-setting-item-content-input">
            <label>Default Net Worth Duration</label>
            <div class="mmm-setting-input-${theme}" style="position: relative;">
                <select class="mmm-setting-dropdown" mmm-data-setting-name="defaultNetWorthDuration" id="default-net-worth-duration">
                    <option value="1M">1 Month</option>
                    <option value="3M">3 Months</option>
                    <option value="6M">6 Months</option>
                    <option value="YTD">Year to date</option>
                    <option value="1Y">1 Year</option>
                    <option value="ALL">All time</option>
                </select>
                <span class="mmm-setting-input-arrow">
                    ${generateArrowSvg()}
                </span>
            </div>
        </div>
        <div class="mmm-modal-body-text-small">
            Default net worth duration to display on the accounts page
        </div>
    </div>`;
}

// Function to create the modal HTML
export async function createModalHtml(
	allTags: HouseholdTransactionTag[] | undefined,
	accountIdsNames: { id: string, name: string }[] | undefined,
	theme: 'dark' | 'light'
): Promise<void> {
	const modalHtml = generateModalStructure(allTags, accountIdsNames, theme);
	// Add modal to body if it doesn't already exist
	if (!document.getElementById("mmm-settings-modal")) {
		document.body.insertAdjacentHTML('beforeend', modalHtml);
	}
	await attachSectionEventListeners(theme);
}

// Function to attach section event listeners
async function attachSectionEventListeners(theme: 'dark' | 'light'): Promise<void> {
	document.querySelectorAll(`.mmm-setting-header-${theme}`).forEach(async (header) => {
		header.addEventListener('click', async () => {
			const sectionId = header.id;
			if (sectionId === 'mmm-setting-header-splitwise') {
				const settings = getCustomSettings();
				if (settings.showPostToSplitwiseButton) {
					// Since loadSplitwiseData is not exported, we'll let the settings-view handle this
					document.dispatchEvent(new CustomEvent('LOAD-SPLITWISE-DATA'));
				}
			}
			const h = header as HTMLElement;
			const content = h.nextElementSibling as HTMLElement;
			const arrow = h.querySelector('.mmm-setting-arrow');
			// First collapse all sections
			document.querySelectorAll('.mmm-setting-content').forEach(section => {
				if (section !== content) {
					section.classList.add('collapsed');
					const sectionHeader = section.previousElementSibling;
					if (sectionHeader) {
						const sectionArrow = sectionHeader.querySelector('.mmm-setting-arrow');
						if (sectionArrow)
							sectionArrow.textContent = '▶';
					}
				}
			});
			// Then toggle the clicked section
			if (content && arrow) {
				content.classList.toggle('collapsed');
				arrow.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
			}
		});
	});
}



// New function to handle utility categories loading
export async function loadUtilityCategories(selectedCategories: string[]): Promise<void> {
	const categoriesGridDiv = document.querySelector('.mmm-categories-grid');
	if (!categoriesGridDiv)
		return;

	try {
		const categories = await getAllCategories();
		// Generate categories HTML
		const categoriesHtml = categories.map(category => `
			<div class="mmm-category-checkbox-wrapper" data-category-name="${category.name.toLowerCase()}">
				<label class="mmm-category-checkbox">
					<input type="checkbox" 
						id="category-${category.id}" 
						value="${category.id}"
						${selectedCategories.includes(category.id) ? 'checked' : ''}
						class="utility-category-checkbox"
						mmm-data-setting-name="utilityCategories"
					/>
					<span class="mmm-checkbox-custom"></span>
					<span class="mmm-category-label">${category.name}</span>
				</label>
			</div>
		`).join('');

		// Update grid content
		categoriesGridDiv.innerHTML = categoriesHtml;

		// Add event listeners to checkboxes
		const checkboxes = categoriesGridDiv.querySelectorAll<HTMLInputElement>('.utility-category-checkbox');
		checkboxes.forEach(checkbox => {

			checkbox.addEventListener('change', (e) => {

				// Stop the event from bubbling up to the modal
				e.stopPropagation();

				const target = e.target as HTMLInputElement;
				const settings = getCustomSettings();
				const categories = settings.utilityCategories || [];

				if (target.checked && !categories.includes(target.value)) {
					categories.push(target.value);
				}
				else if (!target.checked) {
					const index = categories.indexOf(target.value);
					if (index > -1) {
						categories.splice(index, 1);
					}
				}
				// Directly save the setting without triggering the modal change event
				saveCustomSettings({
					...settings,
					utilityCategories: categories
				});
			});
		});

		// Add search functionality
		const searchInput = document.getElementById('categories-search') as HTMLInputElement;
		if (searchInput) {
			searchInput.addEventListener('input', (e) => {

				e.stopPropagation();

				const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
				const checkboxWrappers = categoriesGridDiv.querySelectorAll<HTMLElement>('.mmm-category-checkbox-wrapper');
				checkboxWrappers.forEach(wrapper => {
					const categoryName = wrapper.getAttribute('data-category-name') || '';
					wrapper.style.display = categoryName.includes(searchTerm) ? '' : 'none';
				});
			});
		}
	}
	catch (error) {
		console.error('Error loading categories:', error);
		categoriesGridDiv.innerHTML = 'Error loading categories';
	}
}