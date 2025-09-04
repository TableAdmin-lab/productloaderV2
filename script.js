// --- CONFIG & GLOBAL STATE ---
const HOW_TO_GUIDE_URL = 'https://drive.google.com/file/d/1zr3CDygB280p1GScFaadRkMBeLGUM8jp/view?usp=drive_link'; // <-- ADJUST THIS LINK AS NEEDED

let products = [];
let pluCounter = 1000;
let currentModifierGroups = [];
let currentModifierLinks = {};
let currentVariantGroups = [];
let currentVariantPricing = [];
let sessionSite = '';
let sessionDefinePlu = 'no';
let defaultsSet = false;
let loaderInterval = null;
let rememberCategoriesChecked = true;
let lastUsedCategories = { prep: '', menu: '', inv: '' };

const categoryMap = {
    "Food": ["Meat", "Dairy", "Produce", "Bakery", "Dry Goods", "Frozen"],
    "Beverages": ["Sodas", "Juices", "Alcohol", "Coffee & Tea", "Water"],
    "Packaging": ["Containers", "Bags", "Cutlery", "Napkins"], "Supplies": ["Cleaning", "Office", "Uniforms"]
};
const uomMap = {
    'ea': 'Each', 'kg': 'Kilograms', 'g': 'Grams', 'l': 'Litres',
    'ml': 'Millilitres', 'm': 'Meters', 'mm': 'Millimeters', 'cm': 'Centimeters'
};


// --- DOM Elements ---
const exportSoundElement = document.getElementById('exportSound');
const sessionSiteInput = document.getElementById('sessionSite');
const sessionDefinePluSelect = document.getElementById('sessionDefinePlu');
const defaultsButton = document.getElementById('defaultsButton');
const pluEntryGroup = document.getElementById('pluEntryGroup');
const productTypeSelect = document.getElementById('productType');
const costPriceGroup = document.getElementById('costPriceGroup');
const sellingPriceGroup = document.getElementById('sellingPriceGroup');
const inventoryCategoryInput = document.getElementById('inventoryCategory');
const hasBarcodeSelect = document.getElementById('hasBarcode');
const barcodeEntryGroup = document.getElementById('barcodeEntryGroup');
const saveStatus = document.getElementById('saveStatus');
const variantGroupsContainer = document.getElementById('variantGroupsContainer');
const pricingColumn = document.getElementById('pricing-column');
const variantPricingContainer = document.getElementById('variantPricingContainer');
const addVariantGroupBtn = document.getElementById('addVariantGroupBtn');
const customModal = document.getElementById('customModal');
const modalMessage = document.getElementById('modalMessage');
const modalActions = document.getElementById('modalActions');
const mainActionButton = document.getElementById('mainActionButton');
const editingIndexInput = document.getElementById('editingIndex');
const modifierModal = document.getElementById('modifierModal');
const newModifierGroupForm = document.getElementById('newModifierGroupForm');
const editModifierGroupsContainer = document.getElementById('editModifierGroupsContainer');
const linkModifierModal = document.getElementById('linkModifierModal');
const linkModifierModalTitle = document.getElementById('linkModifierModalTitle');
const linkModifierListContainer = document.getElementById('linkModifierListContainer');
const singleProductModifierControls = document.getElementById('single-product-modifier-controls');
const uomSelect = document.getElementById('uom');
const suppliedQuantityInput = document.getElementById('suppliedQuantity');
const yieldQuantityInput = document.getElementById('yieldQuantity');
const rememberCategoriesCheckbox = document.getElementById('rememberCategories');


// --- Search and Filter Logic ---
const filterTable = (searchInput, tableId) => {
    const query = searchInput.value.toLowerCase();
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('howToGuideLink').href = HOW_TO_GUIDE_URL;

    loadState();
    updateRequiredFields();
    setupInlineValidation();

    const secretTrigger = document.getElementById('secretTrigger');
    if (secretTrigger) {
        secretTrigger.addEventListener('click', () => {
            const secretContainer = document.getElementById('secretActionsContainer');
            if (secretContainer.style.display === 'none') {
                secretContainer.style.display = 'flex';
            } else {
                secretContainer.style.display = 'none';
            }
        });
    }

    document.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Scroll to Top button
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Search bars
    const productSearch = document.getElementById('productSearch');
    const stockSearch = document.getElementById('stockSearch');
    productSearch.addEventListener('input', () => filterTable(productSearch, 'productTable'));
    stockSearch.addEventListener('input', () => filterTable(stockSearch, 'stockTable'));
});

mainActionButton.addEventListener('click', handleMainAction);
sessionDefinePluSelect.addEventListener('change', () => { if (defaultsSet) { sessionDefinePlu = sessionDefinePluSelect.value; handlePluVisibility(); } });
productTypeSelect.addEventListener('change', () => {
    updateRequiredFields();
    renderVariantGroups();
});
inventoryCategoryInput.addEventListener('input', handleInventoryCategoryChange);
hasBarcodeSelect.addEventListener('change', handleBarcodeVisibility);

document.getElementById('openModifierModalBtn').addEventListener('click', () => {
    renderModifierModal();
    modifierModal.classList.add('show');
});
document.getElementById('linkSingleModifierBtn').addEventListener('click', () => openLinkModifierModal(''));
document.getElementById('closeModifierModalBtn').addEventListener('click', () => {
    modifierModal.classList.remove('show');
});
document.getElementById('saveModifiersBtn').addEventListener('click', () => saveModifiersFromModal(true));
document.getElementById('closeLinkModifierModalBtn').addEventListener('click', () => {
    linkModifierModal.classList.remove('show');
    updateSingleProductModifierIndicator();
    generateAndRenderPricing(); // Refresh pricing to show new indicators
});


// GHOST TEXT EVENT LISTENERS
suppliedQuantityInput.addEventListener('input', updateGhostText);
suppliedQuantityInput.addEventListener('focus', updateGhostText);
suppliedQuantityInput.addEventListener('blur', updateGhostText);
yieldQuantityInput.addEventListener('input', updateYieldGhostText);
yieldQuantityInput.addEventListener('focus', updateYieldGhostText);
yieldQuantityInput.addEventListener('blur', updateYieldGhostText);
uomSelect.addEventListener('change', () => {
    updateGhostText();
    updateYieldGhostText();
});
rememberCategoriesCheckbox.addEventListener('change', (e) => {
    rememberCategoriesChecked = e.target.checked;
    saveState();
});

// --- HELPER FUNCTIONS ---
function sanitizeInput(str) {
    if (!str) return '';
    // Allow letters, numbers, spaces, and a curated list of safe punctuation.
    const allowedCharsRegex = /[^a-zA-Z0-9 \-.,&()R]/g;
    return str.toString().replace(allowedCharsRegex, '');
}

// --- MODIFIER MODAL & LINKING LOGIC ---
function renderModifierModal() {
    renderNewModifierGroupForm();
    renderExistingModifierGroups();
}

function renderNewModifierGroupForm() {
    newModifierGroupForm.innerHTML = `
        <div class="modifier-group-header">
            <input type="text" placeholder="New Group Name (e.g., Add-ons)" id="newModifierGroupName">
        </div>
        <div id="new-modifier-options-container">
            <div class="modifier-option-row">
                <input type="text" placeholder="Option Name" class="new-modifier-option-name">
                <input type="number" step="0.01" placeholder="Price" value="0" class="new-modifier-option-price">
                <button type="button" class="btn-remove" disabled>&ndash;</button>
            </div>
        </div>
        <button type="button" id="addNewModifierOptionBtn" class="btn-add-dynamic">Add Option</button>
        <button type="button" id="commitNewModifierGroupBtn" class="btn-add" style="margin-top:10px; width: 100%;">Add Group to Library</button>
    `;

    newModifierGroupForm.querySelector('#addNewModifierOptionBtn').onclick = () => {
        const container = newModifierGroupForm.querySelector('#new-modifier-options-container');
        const optionRow = document.createElement('div');
        optionRow.className = 'modifier-option-row';
        optionRow.innerHTML = `
            <input type="text" placeholder="Option Name" class="new-modifier-option-name">
            <input type="number" step="0.01" placeholder="Price" value="0" class="new-modifier-option-price">
            <button type="button" class="btn-remove">&ndash;</button>
        `;
        optionRow.querySelector('.btn-remove').onclick = () => optionRow.remove();
        container.appendChild(optionRow);
    };

    newModifierGroupForm.querySelector('#commitNewModifierGroupBtn').onclick = () => {
        const groupName = sanitizeInput(newModifierGroupForm.querySelector('#newModifierGroupName').value.trim());
        if (!groupName) {
            showModal("Please enter a group name for the new modifier.", "error");
            return;
        }
        if(currentModifierGroups.some(g => g.groupName.toLowerCase() === groupName.toLowerCase())) {
            showModal(`A modifier group named "${groupName}" already exists.`, "error");
            return;
        }

        const options = [];
        newModifierGroupForm.querySelectorAll('.modifier-option-row').forEach(row => {
            const name = sanitizeInput(row.querySelector('.new-modifier-option-name').value.trim());
            const price = row.querySelector('.new-modifier-option-price').value;
            if (name) {
                options.push({ name, price: parseFloat(price) || 0 });
            }
        });

        if (options.length === 0) {
            showModal("Please add at least one option to the new modifier group.", "error");
            return;
        }
        currentModifierGroups.push({ groupName, options });
        renderModifierModal();
    };
}

function renderExistingModifierGroups() {
    editModifierGroupsContainer.innerHTML = '';
    currentModifierGroups.forEach((group, groupIndex) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'modifier-group-row';
        groupEl.innerHTML = `
            <div class="modifier-group-header">
                <input type="text" value="${group.groupName}" data-group-index="${groupIndex}" class="modifier-group-name-edit">
                <button type="button" class="btn-remove remove-modifier-group" data-group-index="${groupIndex}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M3 6v18h18v-18h-18zm5 14c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18h-20v-2h6v-1.5c0-.827.673-1.5 1.5-1.5h5c.825 0 1.5.671 1.5 1.5v1.5h6v2z"/></svg>
                </button>
            </div>
        `;
        
        group.options.forEach((option, optionIndex) => {
            const optionRow = document.createElement('div');
            optionRow.className = 'modifier-option-row';
            optionRow.innerHTML = `
                <input type="text" value="${option.name}" data-group-index="${groupIndex}" data-option-index="${optionIndex}" class="modifier-option-name-edit">
                <input type="number" step="0.01" value="${option.price}" data-group-index="${groupIndex}" data-option-index="${optionIndex}" class="modifier-option-price-edit">
                <button type="button" class="btn-remove remove-modifier-option" data-group-index="${groupIndex}" data-option-index="${optionIndex}">&ndash;</button>
            `;
            groupEl.appendChild(optionRow);
        });

        const addOptionBtn = document.createElement('button');
        addOptionBtn.type = 'button';
        addOptionBtn.textContent = 'Add Option';
        addOptionBtn.className = 'btn-add-dynamic add-modifier-option';
        addOptionBtn.dataset.groupIndex = groupIndex;
        groupEl.appendChild(addOptionBtn);
        
        editModifierGroupsContainer.appendChild(groupEl);
    });

    editModifierGroupsContainer.querySelectorAll('.add-modifier-option').forEach(btn => btn.onclick = (e) => {
        saveModifiersFromModal(false); 
        currentModifierGroups[e.target.dataset.groupIndex].options.push({ name: '', price: 0 });
        renderExistingModifierGroups();
    });
    editModifierGroupsContainer.querySelectorAll('.remove-modifier-group').forEach(btn => btn.onclick = (e) => {
        currentModifierGroups.splice(e.currentTarget.dataset.groupIndex, 1);
        renderExistingModifierGroups();
    });
    editModifierGroupsContainer.querySelectorAll('.remove-modifier-option').forEach(btn => btn.onclick = (e) => {
        currentModifierGroups[e.currentTarget.dataset.groupIndex].options.splice(e.currentTarget.dataset.optionIndex, 1);
        renderExistingModifierGroups();
    });
}

function saveModifiersFromModal(closeModal = true) {
    const tempGroups = [];
    const groupNames = new Set();
    let hasError = false;

    editModifierGroupsContainer.querySelectorAll('.modifier-group-row').forEach((groupEl) => {
        const groupName = sanitizeInput(groupEl.querySelector('.modifier-group-name-edit').value.trim());
        if (groupName && groupNames.has(groupName.toLowerCase())) {
            showModal(`Duplicate modifier group name found: "${groupName}". Please use unique names.`, "error");
            hasError = true;
            return;
        }
        if (groupName) groupNames.add(groupName.toLowerCase());

        const options = [];
        groupEl.querySelectorAll('.modifier-option-row').forEach(optionEl => {
            const optionName = sanitizeInput(optionEl.querySelector('.modifier-option-name-edit').value.trim());
            const optionPrice = optionEl.querySelector('.modifier-option-price-edit').value;
            if (optionName) {
                options.push({ name: optionName, price: parseFloat(optionPrice) || 0 });
            }
        });
        if (groupName && options.length > 0) {
            tempGroups.push({ groupName, options });
        }
    });

    if (hasError) return;

    currentModifierGroups = tempGroups;
    if (closeModal) {
        modifierModal.classList.remove('show');
        showModal('Modifiers library updated.', 'warning');
    }
    generateAndRenderPricing();
}

function openLinkModifierModal(variantCombination) {
    linkModifierModal.dataset.activeVariant = variantCombination;
    linkModifierModalTitle.textContent = `Link Modifiers for: ${variantCombination || document.getElementById('productName').value || 'this product'}`;
    
    linkModifierListContainer.innerHTML = '';
    const linkedGroups = currentModifierLinks[variantCombination] || [];

    if (currentModifierGroups.length === 0) {
        linkModifierListContainer.innerHTML = `<p style="color: var(--yoco-text-secondary);">No modifier groups have been created yet. Close this and use the "Add/Edit Modifiers" button to create some.</p>`;
    }

    currentModifierGroups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'modifier-link-item';
        const isChecked = linkedGroups.includes(group.groupName);
        const sanitizedGroupName = group.groupName.replace(/\s+/g, '-');
        item.innerHTML = `
            <input type="checkbox" id="mod-${sanitizedGroupName}" value="${group.groupName}" ${isChecked ? 'checked' : ''}>
            <label for="mod-${sanitizedGroupName}">${group.groupName}</label>
        `;
        linkModifierListContainer.appendChild(item);
        
        item.querySelector('input').onchange = (e) => {
            const groupName = e.target.value;
            const isAdding = e.target.checked;
            let currentLinks = currentModifierLinks[variantCombination] || [];
            
            if (isAdding) {
                if (!currentLinks.includes(groupName)) {
                    currentLinks.push(groupName);
                }
            } else {
                currentLinks = currentLinks.filter(name => name !== groupName);
            }
            currentModifierLinks[variantCombination] = currentLinks;
        };
    });

    const bulkSelect = document.getElementById('bulkModifierSelect');
    const bulkApplyBtn = document.getElementById('bulkApplyModifierBtn');
    bulkSelect.innerHTML = '<option value="">-- Select Group to Bulk Apply --</option>';

    currentModifierGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.groupName;
        option.textContent = group.groupName;
        bulkSelect.appendChild(option);
    });

    bulkApplyBtn.onclick = () => {
        const selectedGroup = bulkSelect.value;
        if (!selectedGroup) {
            showModal("Please select a modifier group to apply.", "error");
            return;
        }

        currentVariantPricing.forEach(priceItem => {
            let currentLinks = currentModifierLinks[priceItem.combination] || [];
            if (!currentLinks.includes(selectedGroup)) {
                currentLinks.push(selectedGroup);
            }
            currentModifierLinks[priceItem.combination] = currentLinks;
        });

        showModal(`"${selectedGroup}" was applied to all variants on the current form.`, 'warning');
        openLinkModifierModal(variantCombination); 
    };

    linkModifierModal.classList.add('show');
}


// --- DATA PERSISTENCE & STATE MANAGEMENT ---
function saveState() {
  const state = { 
      products, pluCounter, sessionSite, sessionDefinePlu, defaultsSet,
      currentModifierGroups, rememberCategoriesChecked, lastUsedCategories
  };
  localStorage.setItem('productData', JSON.stringify(state));
  showSaveStatus();
}

function loadState() {
  const savedData = localStorage.getItem('productData');
  if (savedData) {
    const state = JSON.parse(savedData);
    products = state.products || [];
    pluCounter = state.pluCounter || 1000;
    sessionSite = state.sessionSite || '';
    sessionDefinePlu = state.sessionDefinePlu || 'no';
    defaultsSet = state.defaultsSet || false;
    currentModifierGroups = state.currentModifierGroups || [];
    rememberCategoriesChecked = state.rememberCategoriesChecked !== false; // Default to true if not set
    lastUsedCategories = state.lastUsedCategories || { prep: '', menu: '', inv: '' };

    rememberCategoriesCheckbox.checked = rememberCategoriesChecked;

    if (defaultsSet) {
        sessionSiteInput.value = sessionSite;
        sessionDefinePluSelect.value = sessionDefinePlu;
        setDefaults(true);
    }
    const sites = new Set(products.map(p => p.Site));
    const preps = new Set(products.map(p => p["Preparation Location"]));
    const menuCategories = new Set(products.map(p => p["Menu Category"]));
    const invCategories = new Set(products.map(p => p["Inventory Category"]));
    const invSubCategories = new Set(products.map(p => p["Inventory Sub-Category"]));
    
    sites.forEach(site => addToDatalist("siteList", site));
    preps.forEach(prep => addToDatalist("prepList", prep));
    menuCategories.forEach(menu => addToDatalist("menuList", menu));
    invCategories.forEach(cat => addToDatalist("inventoryCategoryList", cat));
    invSubCategories.forEach(sub => addToDatalist("inventorySubCategoryList", sub));
    updateTable();
  }
}

function clearAllData() {
    products = []; pluCounter = 1000; sessionSite = ''; sessionDefinePlu = 'no'; defaultsSet = false; currentModifierGroups = [];
    lastUsedCategories = { prep: '', menu: '', inv: '' };
    localStorage.removeItem('productData');
    sessionSiteInput.value = ''; sessionDefinePluSelect.value = 'no';
    editDefaults(true);
    updateTable();
}


// --- UI LOGIC & FORM HANDLING ---
function showSaveStatus() {
    saveStatus.style.opacity = '1';
    setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
}
function showModal(message, type = 'error', onConfirm = null, showCancel = false) {
    modalMessage.innerHTML = message;
    customModal.querySelector('.modal-content').className = 'modal-content ' + type;
    modalActions.innerHTML = '';
    if (onConfirm) {
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Continue'; confirmBtn.className = 'btn-add';
        confirmBtn.onclick = () => { onConfirm(); customModal.classList.remove('show'); };
        modalActions.appendChild(confirmBtn);
    }
    if (showCancel || !onConfirm) {
        const closeBtn = document.createElement('button');
        closeBtn.textContent = onConfirm ? 'Cancel' : 'Close'; closeBtn.className = 'btn-export';
        closeBtn.onclick = () => customModal.classList.remove('show');
        modalActions.appendChild(closeBtn);
    }
    customModal.classList.add('show');
}
function confirmClearAll() {
    showModal('Are you sure you want to clear all products and session defaults?', 'warning', () => {
            clearAllData(); showModal('All data has been cleared.', 'warning');
        }, true
    );
}
function setDefaults(isLoading = false) {
    const siteValue = sessionSiteInput.value.trim();
    if (!isLoading && siteValue === "") { showModal("Please enter a Site for this session.", "error"); return; }
    sessionSite = siteValue; sessionDefinePlu = sessionDefinePluSelect.value;
    sessionSiteInput.disabled = true; sessionDefinePluSelect.disabled = true;
    defaultsButton.textContent = "Edit Defaults"; defaultsButton.onclick = editDefaults;
    defaultsSet = true; handlePluVisibility(); if (!isLoading) saveState();
}
function editDefaults(isClearing = false) {
    sessionSiteInput.disabled = false; sessionDefinePluSelect.disabled = false;
    defaultsButton.textContent = "Set Defaults"; defaultsButton.onclick = setDefaults;
    defaultsSet = false; if (!isClearing) saveState();
}
function updateGhostText() {
    const uomValue = uomSelect.value;
    const quantityValue = suppliedQuantityInput.value;
    const ghostTextSpan = document.getElementById('quantityGhostText');

    if (uomValue && quantityValue) {
        ghostTextSpan.textContent = uomMap[uomValue] || '';
        ghostTextSpan.style.visibility = 'visible';
    } else {
        ghostTextSpan.style.visibility = 'hidden';
    }
}
function updateYieldGhostText() {
    const uomValue = uomSelect.value;
    const quantityValue = yieldQuantityInput.value;
    const ghostTextSpan = document.getElementById('yieldGhostText');

    if (uomValue && quantityValue) {
        ghostTextSpan.textContent = uomMap[uomValue] || '';
        ghostTextSpan.style.visibility = 'visible';
    } else {
        ghostTextSpan.style.visibility = 'hidden';
    }
}
function handlePluVisibility() {
    pluEntryGroup.style.display = (sessionDefinePlu === 'yes') ? 'flex' : 'none';
    const pluLabel = pluEntryGroup.querySelector('label .label-text');
    const hasVariants = currentVariantGroups.length > 0;

    // The user can set a custom base PLU for items with variants
    pluLabel.textContent = 'Custom Base PLU/SKU';
    document.getElementById("customPlu").placeholder = 'e.g., PIZZA-CHE';
}
function updateRequiredFields() {
    const selectedType = productTypeSelect.value;
    const inventoryCategoryLabel = document.getElementById('inventoryCategoryLabel').querySelector('.label-text');
    const inventorySubCategoryLabel = document.getElementById('inventorySubCategoryLabel').querySelector('.label-text');
    const costPriceLabel = document.getElementById('costPriceLabel').querySelector('.label-text');
    const suppliedQuantityGroup = document.getElementById('suppliedQuantityGroup');
    const suppliedQuantityLabel = document.getElementById('suppliedQuantityLabel').querySelector('.label-text');
    const yieldQuantityGroup = document.getElementById('yieldQuantityGroup');
    const yieldQuantityLabel = document.getElementById('yieldQuantityLabel').querySelector('.label-text');
    const addModifierButton = document.getElementById('openModifierModalBtn');
    const prepLocationGroup = document.getElementById('prepLocationGroup');
    const menuCategoryGroup = document.getElementById('menuCategoryGroup');
    const prepLocationInput = document.getElementById('prepLocation');
    const menuCategoryInput = document.getElementById('menuCategory');

    // --- Reset visibility of all conditional fields ---
    costPriceGroup.style.display = 'none';
    sellingPriceGroup.style.display = 'flex';
    prepLocationGroup.style.display = 'flex';
    menuCategoryGroup.style.display = 'flex';
    inventoryCategoryLabel.innerHTML = `Inventory Category`;
    inventorySubCategoryLabel.innerHTML = `Inventory Sub-Category`;
    costPriceLabel.innerHTML = `Default Cost Price (ex. Vat)`;
    suppliedQuantityGroup.style.display = 'none';
    yieldQuantityGroup.style.display = 'none';
    singleProductModifierControls.style.display = 'none';

    // Show single modifier button if there are no variants
    if(currentVariantGroups.length === 0) {
        singleProductModifierControls.style.display = 'flex';
    }
    
    // Hide default price fields if variants exist
    if (currentVariantGroups.length > 0) {
        sellingPriceGroup.style.display = 'none';
    }
    
    // --- Apply rules based on product type ---
    if (selectedType === 'finishedGood') {
        inventoryCategoryLabel.innerHTML = `Inventory Category (Not Required)`;
        inventorySubCategoryLabel.innerHTML = `Inventory Sub-Category (Not Required)`;
    } else if (selectedType === 'rawMaterial') {
        sellingPriceGroup.style.display = 'none';
        prepLocationGroup.style.display = 'none';
        prepLocationInput.value = '';
        menuCategoryGroup.style.display = 'none';
        menuCategoryInput.value = '';
        inventoryCategoryLabel.innerHTML = `Inventory Category <span class="required-star">*</span>`;
        costPriceGroup.style.display = 'flex';
        costPriceLabel.innerHTML = `Total Cost Price (ex. Vat) <span class="required-star">*</span>`;
        suppliedQuantityGroup.style.display = 'flex';
        suppliedQuantityLabel.innerHTML = `Supplied Quantity <span class="required-star">*</span>`;
    } else if (selectedType === 'finishedGood & rawMaterial') {
        inventoryCategoryLabel.innerHTML = `Inventory Category <span class="required-star">*</span>`;
        costPriceGroup.style.display = 'flex';
        costPriceLabel.innerHTML = `Total Cost Price (ex. Vat) <span class="required-star">*</span>`;
        suppliedQuantityGroup.style.display = 'flex';
        suppliedQuantityLabel.innerHTML = `Supplied Quantity <span class="required-star">*</span>`;
    }
    else if (selectedType === 'Manufactured') {
        sellingPriceGroup.style.display = 'none';
        prepLocationGroup.style.display = 'none';
        prepLocationInput.value = '';
        menuCategoryGroup.style.display = 'none';
        menuCategoryInput.value = '';
        inventoryCategoryLabel.innerHTML = `Inventory Category <span class="required-star">*</span>`;
        yieldQuantityGroup.style.display = 'flex';
        yieldQuantityLabel.innerHTML = `Yield Quantity <span class="required-star">*</span>`;
    }

    // Disable variant/modifier buttons for non-sellable items
    const isDisabled = selectedType === 'rawMaterial' || selectedType === 'Manufactured';
    addModifierButton.disabled = isDisabled;
    addVariantGroupBtn.disabled = isDisabled;
    document.getElementById('linkSingleModifierBtn').disabled = isDisabled;

    updateSingleProductModifierIndicator();
}

function updateSingleProductModifierIndicator() {
    const indicatorWrapper = document.getElementById('singleModifierIndicator');
    indicatorWrapper.innerHTML = ''; // Clear previous content
    const count = currentModifierLinks['']?.length || 0;
    
    if (count > 0) {
        const tooltipDiv = document.createElement('div');
        tooltipDiv.className = 'tooltip modifier-indicator-wrapper';

        const indicator = document.createElement('span');
        indicator.className = 'modifier-indicator';
        indicator.textContent = count;
        
        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltiptext';
        tooltipText.innerHTML = (currentModifierLinks[''] || []).join('<br>');

        tooltipDiv.appendChild(indicator);
        tooltipDiv.appendChild(tooltipText);
        indicatorWrapper.appendChild(tooltipDiv);
    }
}
function handleInventoryCategoryChange(event) {
    const subCategories = categoryMap[event.target.value];
    if (subCategories) { subCategories.forEach(sub => addToDatalist("inventorySubCategoryList", sub)); }
}
function handleBarcodeVisibility() {
    barcodeEntryGroup.style.display = (hasBarcodeSelect.value === 'yes') ? 'flex' : 'none';
}

function addVariantGroup() {
    currentVariantGroups.push({ groupName: '', options: [{ name: '' }] });
    updateRequiredFields();
    renderVariantGroups();
}
function removeVariantGroup(groupIndex) {
    currentVariantGroups.splice(groupIndex, 1);
    updateRequiredFields();
    renderVariantGroups();
}
function addVariantOption(groupIndex) {
    currentVariantGroups[groupIndex].options.push({ name: '' });
    renderVariantGroups();
}
function removeVariantOption(groupIndex, optionIndex) {
    currentVariantGroups[groupIndex].options.splice(optionIndex, 1);
    if (currentVariantGroups[groupIndex].options.length === 0) {
        removeVariantGroup(groupIndex);
    } else {
        renderVariantGroups();
    }
}
function renderVariantGroups() {
    variantGroupsContainer.innerHTML = '';
    currentVariantGroups.forEach((group, groupIndex) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'variant-group-row';

        const header = document.createElement('div');
        header.className = 'variant-group-header';
        const groupNameInput = document.createElement('input');
        groupNameInput.type = 'text';
        groupNameInput.placeholder = 'Group Name (e.g., Size)';
        groupNameInput.value = group.groupName;
        groupNameInput.oninput = (e) => {
            currentVariantGroups[groupIndex].groupName = e.target.value;
            generateAndRenderPricing();
        };
        header.appendChild(groupNameInput);
        const removeGroupBtn = document.createElement('button');
        removeGroupBtn.type = 'button';
        removeGroupBtn.className = 'btn-remove';
        removeGroupBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M3 6v18h18v-18h-18zm5 14c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18h-20v-2h6v-1.5c0-.827.673-1.5 1.5-1.5h5c.825 0 1.5.671 1.5 1.5v1.5h6v2z"/></svg>`;
        removeGroupBtn.onclick = () => removeVariantGroup(groupIndex);
        header.appendChild(removeGroupBtn);
        groupEl.appendChild(header);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'variant-options-container';
        optionsContainer.dataset.groupIndex = groupIndex;
        
        group.options.forEach((option, optionIndex) => {
            const optionRow = document.createElement('div');
            optionRow.className = 'variant-option-row';
            const optionNameInput = document.createElement('input');
            optionNameInput.type = 'text';
            optionNameInput.placeholder = `Option ${optionIndex + 1} Name (e.g., Small)`;
            optionNameInput.value = option.name;
            optionNameInput.oninput = (e) => {
                currentVariantGroups[groupIndex].options[optionIndex].name = e.target.value;
                generateAndRenderPricing();
            };
            optionRow.appendChild(optionNameInput);
            const removeOptionBtn = document.createElement('button');
            removeOptionBtn.type = 'button';
            removeOptionBtn.className = 'btn-remove';
            removeOptionBtn.innerHTML = `&ndash;`;
            removeOptionBtn.onclick = () => removeVariantOption(groupIndex, optionIndex);
            optionRow.appendChild(removeOptionBtn);
            optionsContainer.appendChild(optionRow);
        });

        groupEl.appendChild(optionsContainer);

        const addOptionBtn = document.createElement('button');
        addOptionBtn.type = 'button';
        addOptionBtn.textContent = 'Add Option';
        addOptionBtn.className = 'btn-add-dynamic';
        addOptionBtn.style.alignSelf = 'flex-start';
        addOptionBtn.style.marginLeft = '20px';
        addOptionBtn.onclick = () => addVariantOption(groupIndex);
        groupEl.appendChild(addOptionBtn);

        variantGroupsContainer.appendChild(groupEl);
    });
    
    // Initialize SortableJS after elements are in the DOM
    new Sortable(variantGroupsContainer, {
        animation: 150,
        handle: '.variant-group-row',
        onEnd: (evt) => {
            const movedItem = currentVariantGroups.splice(evt.oldIndex, 1)[0];
            currentVariantGroups.splice(evt.newIndex, 0, movedItem);
            renderVariantGroups(); // Re-render to update indices and listeners
        }
    });

    document.querySelectorAll('.variant-options-container').forEach(container => {
        new Sortable(container, {
            animation: 150,
            onEnd: (evt) => {
                const groupIndex = evt.from.dataset.groupIndex;
                const movedOption = currentVariantGroups[groupIndex].options.splice(evt.oldIndex, 1)[0];
                currentVariantGroups[groupIndex].options.splice(evt.newIndex, 0, movedOption);
                renderVariantGroups(); // Re-render is safest to maintain state
            }
        });
    });


    generateAndRenderPricing();
    handlePluVisibility();
    updateRequiredFields();
}
function generateAndRenderPricing() {
    const validGroups = currentVariantGroups.filter(g => g.groupName.trim() && g.options.some(o => o.name.trim()));
    pricingColumn.style.display = (validGroups.length > 0) ? 'block' : 'none';
    variantPricingContainer.innerHTML = '';

    if (validGroups.length === 0) {
        currentVariantPricing = [];
        updateRequiredFields();
        return;
    }

    const defaultPrice = document.getElementById('sellingPrice').value;

    // Add "Apply Price to All" controls
    const pricingControls = document.createElement('div');
    pricingControls.className = 'pricing-controls';
    pricingControls.innerHTML = `
        <input type="number" id="bulkPriceInput" placeholder="Set price for all" step="0.01" value="${defaultPrice || ''}">
        <button type="button" id="applyBulkPriceBtn" class="btn-add btn-add-dynamic">Apply to all</button>
    `;
    variantPricingContainer.appendChild(pricingControls);
    document.getElementById('applyBulkPriceBtn').onclick = () => {
        const price = document.getElementById('bulkPriceInput').value;
        if (price !== '' && !isNaN(price)) {
            currentVariantPricing.forEach(p => p.sellingPrice = parseFloat(price));
            generateAndRenderPricing(); // Re-render to update fields
        }
    };


    const arraysToCombine = validGroups.map(g => g.options.filter(o => o.name.trim()).map(o => ({ groupName: g.groupName.trim(), optionName: o.name.trim() })));
    
    const cartesian = (...a) => a.reduce((A, B) => A.flatMap(x => B.map(y => [...x, y])), [[]]);
    const combinations = cartesian(...arraysToCombine);

    const newPricingData = combinations.map(combo => {
        const combinationString = combo.map(c => `${c.groupName}: ${c.optionName}`).join('; ');
        const existing = currentVariantPricing.find(p => p.combination === combinationString);
        return {
            combination: combinationString,
            sellingPrice: existing ? existing.sellingPrice : '',
        };
    });
    currentVariantPricing = newPricingData;

    currentVariantPricing.forEach((priceItem, index) => {
        const row = document.createElement('div');
        row.className = 'variant-pricing-row';
        row.style.gridTemplateColumns = '2fr 1fr auto';
        
        const nameEl = document.createElement('span');
        nameEl.className = 'combo-name';
        nameEl.textContent = priceItem.combination;
        
        const spInput = document.createElement('input');
        spInput.type = 'number'; spInput.step = '0.01'; spInput.placeholder = 'Selling Price*';
        spInput.value = priceItem.sellingPrice;
        spInput.oninput = (e) => currentVariantPricing[index].sellingPrice = e.target.value;
        
        const actionsWrapper = document.createElement('div');
        actionsWrapper.style.display = 'flex';
        actionsWrapper.style.alignItems = 'center';
        actionsWrapper.style.gap = '8px';

        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.textContent = 'Link Modifier';
        linkBtn.title = 'Link Modifiers';
        linkBtn.className = 'btn-add btn-add-dynamic';
        linkBtn.onclick = () => openLinkModifierModal(priceItem.combination);
        
        row.appendChild(nameEl);
        row.appendChild(spInput);
        
        const linkedModifiers = currentModifierLinks[priceItem.combination] || [];
        if (linkedModifiers.length > 0) {
            const tooltipDiv = document.createElement('div');
            tooltipDiv.className = 'tooltip modifier-indicator-wrapper';

            const indicator = document.createElement('span');
            indicator.className = 'modifier-indicator';
            indicator.textContent = linkedModifiers.length;
            
            const tooltipText = document.createElement('span');
            tooltipText.className = 'tooltiptext';
            tooltipText.innerHTML = linkedModifiers.join('<br>');

            tooltipDiv.appendChild(indicator);
            tooltipDiv.appendChild(tooltipText);
            actionsWrapper.appendChild(tooltipDiv);
        }
        
        actionsWrapper.appendChild(linkBtn);
        row.appendChild(actionsWrapper);
        variantPricingContainer.appendChild(row);
    });
    updateRequiredFields();
}


// --- MAIN FORM ACTIONS, PRODUCT HANDLING ---
function handleMainAction() {
    clearAllValidationErrors();
    const errors = validateForm(true); // pass true to trigger inline validation
    if (errors.length > 0) { 
        showModal("Please fix the errors highlighted on the form before continuing.", "error"); 
        return; 
    }
    
    const editingIndex = parseInt(editingIndexInput.value, 10);
    if (editingIndex > -1) {
        updateProduct(editingIndex);
    } else {
        addProduct();
    }
}
function validateForm(showInlineErrors = false) {
    const getEl = (id) => document.getElementById(id);
    const elements = {
        productName: getEl("productName"),
        uom: getEl("uom"),
        prepLocation: getEl("prepLocation"),
        menuCategory: getEl("menuCategory"),
        productType: getEl("productType"),
        invCategory: getEl("inventoryCategory"),
        suppliedQuantity: getEl("suppliedQuantity"),
        yieldQuantity: getEl("yieldQuantity"),
        costPrice: getEl("costPrice"),
        sellingPrice: getEl("sellingPrice"),
        taxApplicable: getEl("taxApplicable"),
        barcode: getEl("barcode"),
        customPlu: getEl("customPlu"),
    };
    
    const values = {
        baseProductName: elements.productName.value.trim(),
        uom: elements.uom.value,
        prep: elements.prepLocation.value.trim(),
        menu: elements.menuCategory.value.trim(),
        productType: elements.productType.value,
        invCat: elements.invCategory.value.trim(),
        suppliedQuantity: elements.suppliedQuantity.value.trim(),
        yieldQuantity: elements.yieldQuantity.value.trim(),
        defaultCost: parseFloat(elements.costPrice.value),
        defaultPrice: parseFloat(elements.sellingPrice.value),
        taxApplicable: elements.taxApplicable.value,
        hasBarcode: hasBarcodeSelect.value,
        barcode: elements.barcode.value.trim(),
        customPlu: elements.customPlu.value.trim(),
    };

    const editingIndex = parseInt(editingIndexInput.value, 10);
    let errors = [];

    const check = (condition, element, message) => {
        if (condition) {
            errors.push(message);
            if (showInlineErrors) showValidationError(element, message);
        }
    };

    check(values.baseProductName === "", elements.productName, "Product Name is required.");
    check(!values.uom, elements.uom, "Selling UOM is required.");
    check(!values.productType, elements.productType, "Product Type is required.");
    check(!values.taxApplicable, elements.taxApplicable, "Tax Applicable is required.");
    
    if (values.productType === 'finishedGood' || values.productType === 'finishedGood & rawMaterial') {
        check(values.prep === "", elements.prepLocation, "Preparation Location is required.");
        check(values.menu === "", elements.menuCategory, "Menu Category is required.");
    }
    if (values.productType === 'rawMaterial' || values.productType === 'finishedGood & rawMaterial') {
        check(values.invCat === "", elements.invCategory, "Inventory Category is required.");
        check(values.suppliedQuantity === "", elements.suppliedQuantity, "Supplied Quantity is required.");
        check(isNaN(values.defaultCost), elements.costPrice, "Total Cost Price is required.");
    }
    if (values.productType === 'Manufactured') {
         check(values.invCat === "", elements.invCategory, "Inventory Category is required.");
         check(values.yieldQuantity === "", elements.yieldQuantity, "Yield Quantity is required.");
    }
    
    if (currentVariantGroups.length === 0 && (values.productType === 'finishedGood' || values.productType === 'finishedGood & rawMaterial')) {
        check(isNaN(values.defaultPrice), elements.sellingPrice, "A Default Selling Price is required if no variants are added.");
    }

    check(values.hasBarcode === 'yes' && values.barcode === "", elements.barcode, "Barcode is required.");
    check(sessionDefinePlu === 'yes' && values.customPlu === "", elements.customPlu, "Custom Base PLU/SKU is required.");
    
    const pluExists = products.some((p, i) => {
        const pGroupId = p.productGroupId;
        const editingGroupId = editingIndex > -1 ? products[editingIndex].productGroupId : null;
        return pGroupId === values.customPlu && pGroupId !== editingGroupId;
    });
    check(sessionDefinePlu === 'yes' && pluExists, elements.customPlu, `Base PLU/SKU "${values.customPlu}" already exists.`);
        
    return errors;
}

function gatherProductData() {
    return {
        productName: sanitizeInput(document.getElementById("productName").value.trim()),
        uom: document.getElementById("uom").value,
        prepLocation: sanitizeInput(document.getElementById("prepLocation").value.trim()),
        menuCategory: sanitizeInput(document.getElementById("menuCategory").value.trim()),
        productType: document.getElementById("productType").value,
        invCategory: sanitizeInput(document.getElementById("inventoryCategory").value.trim()),
        invSubCategory: sanitizeInput(document.getElementById("inventorySubCategory").value.trim()),
        suppliedQuantity: document.getElementById("suppliedQuantity").value.trim(),
        yieldQuantity: document.getElementById("yieldQuantity").value.trim(),
        defaultCost: parseFloat(document.getElementById("costPrice").value),
        defaultPrice: parseFloat(document.getElementById("sellingPrice").value),
        taxApplicable: document.getElementById("taxApplicable").value,
        hasBarcode: document.getElementById("hasBarcode").value,
        barcode: sanitizeInput((document.getElementById("hasBarcode").value === 'yes') ? document.getElementById("barcode").value.trim() : ""),
        customPlu: sanitizeInput(document.getElementById("customPlu").value.trim()),
        variantGroups: JSON.parse(JSON.stringify(currentVariantGroups)),
        variantPricing: JSON.parse(JSON.stringify(currentVariantPricing)),
        modifierGroups: JSON.parse(JSON.stringify(currentModifierGroups)),
        modifierLinks: JSON.parse(JSON.stringify(currentModifierLinks))
    };
}

function addProduct() {
    if (!defaultsSet) { showModal("Please set Session Defaults first.", "error"); return; }
    
    const data = gatherProductData();
    const hasZeroPriceVariant = data.variantPricing.length > 0 && data.variantPricing.some(v => parseFloat(v.sellingPrice) === 0);
    if (hasZeroPriceVariant) {
        showModal('Some variants have R0.00 price. Continue?', 'warning', () => createAndAddProducts(data), true);
    } else {
        createAndAddProducts(data);
    }
}

function createAndAddProducts(data, existingGroupId = null, isBatch = false) {
    if (rememberCategoriesChecked && !isBatch) {
        lastUsedCategories.prep = data.prepLocation;
        lastUsedCategories.menu = data.menuCategory;
        lastUsedCategories.inv = data.invCategory;
    }

    const isFinishedAndRaw = data.productType === 'finishedGood & rawMaterial';
    const newProductStartIndex = products.length;

    if (isFinishedAndRaw) {
        const groupId = existingGroupId || (sessionDefinePlu === 'yes' && data.customPlu ? data.customPlu : ++pluCounter);
        
        const rawPluBase = `RAW-${groupId}`;
        const rawProduct = {
            productGroupId: groupId,
            pluBase: rawPluBase,
            _source: data,
            "Product PLU": rawPluBase, "Product Name & Variant": `(Raw) ${data.productName}`, "Base Name": `(Raw) ${data.productName}`,
            "Variant Name": '', "Original Product Type": 'rawMaterial', "Site": sessionSite,
            "GP": 0, "Selling UOM": data.uom, "Preparation Location": '', "Menu Category": '',
            "Inventory Category": data.invCategory, "Inventory Sub-Category": data.invSubCategory,
            "Product Type": 'single', "Supplied Quantity": data.suppliedQuantity, "Manufactured Yield": '',
            "Enabled": true, "Cost Price": data.defaultCost || 0, "Selling Price": 0, "Tax Applicable": false,
            "Modifier": '', "Barcode": ''
        };
        products.push(rawProduct);

        const unitCost = (data.defaultCost && data.suppliedQuantity > 0) ? data.defaultCost / data.suppliedQuantity : 0;
        const finishedPluBase = `PLU-${groupId}`;
        const combinationsToProcess = data.variantPricing.length > 0 
            ? data.variantPricing 
            : [{ combination: '', sellingPrice: data.defaultPrice }];
        
        combinationsToProcess.forEach((combo, index) => {
            const finalName = combo.combination ? `${data.productName} - ${combo.combination}` : data.productName;
            const finalPrice = isNaN(combo.sellingPrice) ? 0 : combo.sellingPrice;
            const gp = (finalPrice > 0 && finalPrice > unitCost) ? ((finalPrice - unitCost) / finalPrice) * 100 : 0;
            const productPlu = (combinationsToProcess.length > 1) ? `${finishedPluBase}-${index + 1}` : finishedPluBase;

            const linkedModifierGroupNames = data.modifierLinks[combo.combination || ''] || [];
            const modifierString = currentModifierGroups
                .filter(group => linkedModifierGroupNames.includes(group.groupName))
                .flatMap(group => group.options.map(opt => `${group.groupName}: ${opt.name} (${(opt.price || 0).toFixed(2)})`))
                .join(', ');

            const finishedProduct = {
                productGroupId: groupId,
                pluBase: finishedPluBase,
                _source: data,
                "Product PLU": productPlu, "Product Name & Variant": finalName, "Base Name": data.productName,
                "Variant Name": combo.combination || '', "Original Product Type": 'finishedGood', "Site": sessionSite,
                "GP": gp, "Selling UOM": "ea", "Preparation Location": data.prepLocation, "Menu Category": data.menuCategory,
                "Inventory Category": '', "Inventory Sub-Category": '', "Product Type": 'single', "Supplied Quantity": '',
                "Manufactured Yield": '', "Enabled": true, "Cost Price": unitCost, "Selling Price": finalPrice,
                "Tax Applicable": data.taxApplicable === 'true', "Modifier": modifierString, "Barcode": data.barcode
            };
            products.push(finishedProduct);
        });

    } else {
        const groupId = existingGroupId || (sessionDefinePlu === 'yes' && data.customPlu ? data.customPlu : ++pluCounter);
        const pluBase = `PLU-${groupId}`;
        const combinationsToProcess = data.variantPricing.length > 0 
            ? data.variantPricing 
            : [{ combination: '', sellingPrice: data.defaultPrice, costPrice: data.defaultCost }];
        
        combinationsToProcess.forEach((combo, index) => {
            let prefixedBaseName = data.productName;
            if (data.productType === "rawMaterial") prefixedBaseName = "(Raw) " + data.productName;
            else if (data.productType === "Manufactured") prefixedBaseName = "(MAN) " + data.productName;

            const finalName = (combo.combination) ? `${prefixedBaseName} - ${combo.combination}` : prefixedBaseName;
            const finalPrice = isNaN(combo.sellingPrice) ? 0 : combo.sellingPrice;
            const finalCost = isNaN(combo.costPrice) ? 0 : combo.costPrice;
            const gp = (finalPrice > 0 && finalPrice > finalCost) ? ((finalPrice - finalCost) / finalPrice) * 100 : 0;
            const productPlu = (combinationsToProcess.length > 1) ? `${pluBase}-${index + 1}` : pluBase;

            const linkedModifierGroupNames = data.modifierLinks[combo.combination || ''] || [];
            const modifierString = currentModifierGroups
                .filter(group => linkedModifierGroupNames.includes(group.groupName))
                .flatMap(group => group.options.map(opt => `${group.groupName}: ${opt.name} (${(opt.price || 0).toFixed(2)})`))
                .join(', ');

            const product = {
                productGroupId: groupId,
                pluBase: pluBase,
                _source: data,
                "Product PLU": productPlu, "Product Name & Variant": finalName, "Base Name": prefixedBaseName,
                "Variant Name": combo.combination || '', "Original Product Type": data.productType, "Site": sessionSite,
                "GP": gp, "Selling UOM": data.uom, "Preparation Location": data.prepLocation, "Menu Category": data.menuCategory,
                "Inventory Category": data.invCategory, "Inventory Sub-Category": data.invSubCategory,
                "Product Type": data.productType === 'Manufactured' ? 'preparation' : 'single',
                "Supplied Quantity": (data.productType === 'rawMaterial') ? data.suppliedQuantity : '',
                "Manufactured Yield": (data.productType === 'Manufactured') ? data.yieldQuantity : '',
                "Enabled": true, "Cost Price": finalCost, "Selling Price": finalPrice,
                "Tax Applicable": data.taxApplicable === 'true',
                "Modifier": modifierString, "Barcode": data.barcode
            };
            products.push(product);
        });
    }

    if (!isBatch) {
        saveState();
        updateTable(newProductStartIndex);
        addToDatalist("prepList", data.prepLocation); 
        addToDatalist("menuList", data.menuCategory);
        addToDatalist("inventoryCategoryList", data.invCategory); 
        addToDatalist("inventorySubCategoryList", data.invSubCategory);
        resetForm();
        document.getElementById("productName").focus();
        document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function updateProduct(index) {
    const data = gatherProductData();
    const originalProduct = products[index];
    const groupIdToUpdate = originalProduct.productGroupId;

    if (!groupIdToUpdate) {
        showModal('This is an older product without a Group ID. It cannot be safely edited. Please remove and re-add it.', 'error');
        return;
    }

    products = products.filter(p => p.productGroupId !== groupIdToUpdate);
    createAndAddProducts(data, groupIdToUpdate);
    resetForm();
    showModal('Product updated successfully!', 'warning');
}

function editProduct(index) {
    const product = products[index];
    if (!product || !product._source) {
        showModal('This product cannot be edited as it was created with an older version.', 'error');
        return;
    }
    if (!product.productGroupId) {
         showModal('This is an older product without a Group ID. It cannot be safely edited. Please remove and re-add it.', 'error');
        return;
    }
    
    const relatedProducts = products.filter(p => p.productGroupId === product.productGroupId);
    if (relatedProducts.length > 1) {
        const otherVariants = relatedProducts.length - 1;
        let message = `This product has ${otherVariants} other related component(s)/variant(s). Editing it will affect all of them. Do you want to continue?`;
        showModal(message, 'warning', () => proceedWithEdit(product, index), true);
    } else {
        proceedWithEdit(product, index);
    }
}

function proceedWithEdit(product, index) {
    const source = product._source;
    editingIndexInput.value = index;

    document.getElementById("productName").value = source.productName;
    document.getElementById("taxApplicable").value = source.taxApplicable;
    document.getElementById("productType").value = source.productType;
    document.getElementById("uom").value = source.uom;
    document.getElementById("prepLocation").value = source.prepLocation;
    document.getElementById("menuCategory").value = source.menuCategory;
    document.getElementById("inventoryCategory").value = source.invCategory;
    document.getElementById("inventorySubCategory").value = source.invSubCategory;
    document.getElementById("suppliedQuantity").value = source.suppliedQuantity;
    document.getElementById("yieldQuantity").value = source.yieldQuantity;
    document.getElementById("costPrice").value = isNaN(source.defaultCost) ? '' : source.defaultCost;
    document.getElementById("sellingPrice").value = isNaN(source.defaultPrice) ? '' : source.defaultPrice;
    document.getElementById("hasBarcode").value = source.hasBarcode;
    document.getElementById("barcode").value = source.barcode;
    
    document.getElementById("customPlu").value = product.productGroupId;
    
    currentVariantGroups = JSON.parse(JSON.stringify(source.variantGroups || []));
    currentVariantPricing = JSON.parse(JSON.stringify(source.variantPricing || []));
    currentModifierGroups = JSON.parse(JSON.stringify(source.modifierGroups || []));
    currentModifierLinks = JSON.parse(JSON.stringify(source.modifierLinks || {}));
    
    updateRequiredFields();
    renderVariantGroups();
    handleBarcodeVisibility();
    handlePluVisibility();

    mainActionButton.textContent = 'Update Product';
    mainActionButton.classList.replace('btn-add', 'btn-update');

    document.querySelectorAll('#productTable tbody tr, #stockTable tbody tr').forEach(row => row.classList.remove('editing-row'));
    
    const rowsToHighlight = products.filter(p => p.productGroupId === product.productGroupId).map(p => p['Product PLU']);
    document.querySelectorAll('#productTable tbody tr, #stockTable tbody tr').forEach(row => {
        const rowPlu = row.cells[0].textContent;
        if (rowsToHighlight.includes(rowPlu)) {
            row.classList.add('editing-row');
        }
    });

    window.scrollTo({ top: document.getElementById('productForm').offsetTop, behavior: 'smooth' });
}


function resetForm() {
    clearAllValidationErrors();
    document.getElementById('productForm').reset();
    document.getElementById('uom').value = 'ea';
    editingIndexInput.value = '-1';
    currentVariantGroups = [];
    currentVariantPricing = [];
    currentModifierLinks = {};
    
    if (rememberCategoriesCheckbox.checked) {
        document.getElementById('prepLocation').value = lastUsedCategories.prep || '';
        document.getElementById('menuCategory').value = lastUsedCategories.menu || '';
        document.getElementById('inventoryCategory').value = lastUsedCategories.inv || '';
    }
    
    mainActionButton.textContent = 'Add Product';
    mainActionButton.classList.replace('btn-update', 'btn-add');
    
    document.querySelectorAll('#productTable tbody tr, #stockTable tbody tr').forEach(row => row.classList.remove('editing-row'));
    
    renderVariantGroups();
    updateRequiredFields();
    handleBarcodeVisibility();
}

function navigateToRaw(groupId) {
    const rawProduct = products.find(p => p.productGroupId === groupId && p["Original Product Type"] === 'rawMaterial');
    if (!rawProduct) return;

    const rawPlu = rawProduct["Product PLU"];

    // Switch tabs
    document.querySelector('.tab-link[data-tab="products"]').classList.remove('active');
    document.querySelector('.tab-content#products').classList.remove('active');
    document.querySelector('.tab-link[data-tab="stock"]').classList.add('active');
    document.querySelector('.tab-content#stock').classList.add('active');

    // Find and highlight row
    const stockTable = document.getElementById('stockTable');
    const rowToHighlight = stockTable.querySelector(`tr[data-plu="${rawPlu}"]`);

    if (rowToHighlight) {
        rowToHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rowToHighlight.classList.add('highlight-row');
        setTimeout(() => {
            rowToHighlight.classList.remove('highlight-row');
        }, 3000);
    }
}

function updateTable(newProductStartIndex = -1) {
  const productTbody = document.querySelector("#productTable tbody");
  const stockTbody = document.querySelector("#stockTable tbody");
  productTbody.innerHTML = "";
  stockTbody.innerHTML = "";

  let lastGroupId = null;
  let groupClassToggle = false;

  const createActionsCell = (p, index) => {
      const actionsCell = document.createElement("td");
      actionsCell.className = "actions-cell";
      
      const editBtn = document.createElement("button");
      editBtn.className = "btn-edit";
      editBtn.title = "Edit Product";
      editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M19.769 9.923l-12.642 12.639-7.127 1.438 1.438-7.127 12.641-12.64 5.69 5.691zm1.414-1.414l2.817-2.817-5.691-5.69-2.816 2.817 5.69 5.69z"/></svg>`;
      editBtn.onclick = () => editProduct(index);
      
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-remove";
      removeBtn.title = "Remove Product";
      removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M3 6v18h18v-18h-18zm5 14c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18h-20v-2h6v-1.5c0-.827.673-1.5 1.5-1.5h5c.825 0 1.5.671 1.5 1.5v1.5h6v2z"/></svg>`;
      removeBtn.onclick = () => { 
          const groupIdToRemove = p.productGroupId;
          if (!groupIdToRemove) {
              showModal("This is an old product and cannot be removed safely. Please clear all data if you wish to remove it.", "error");
              return;
          }
          
          const productsInGroup = products.filter(prod => prod.productGroupId === groupIdToRemove);
          const baseNameForMessage = p._source.productName;

          const message = `Remove "${baseNameForMessage}" and all its ${productsInGroup.length - 1} related components/variants?`;
          
          showModal(message, 'warning', () => { 
              products = products.filter(prod => prod.productGroupId !== groupIdToRemove);
              saveState(); 
              updateTable(); 
          }, true); 
      };
      
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(removeBtn);

      const isFinishedGoodWithRaw = p["Original Product Type"] === 'finishedGood' && products.some(rawP => rawP.productGroupId === p.productGroupId && (rawP["Original Product Type"] === 'rawMaterial'));

      if (isFinishedGoodWithRaw) {
          const rawProduct = products.find(rawP => rawP.productGroupId === p.productGroupId && rawP["Original Product Type"] === 'rawMaterial');
          const linkBtn = document.createElement("button");
          linkBtn.className = "btn-link";
          linkBtn.title = rawProduct ? `Go to: ${rawProduct["Base Name"]}` : "Go to Raw Material";
          linkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/></svg>`;
          linkBtn.onclick = () => navigateToRaw(p.productGroupId);
          actionsCell.appendChild(linkBtn);
      }

      return actionsCell;
  };

  products.forEach((p, index) => {
    const isStockItem = p["Original Product Type"] === 'rawMaterial' || p["Original Product Type"] === 'Manufactured';
    const targetTbody = isStockItem ? stockTbody : productTbody;
    
    const row = document.createElement("tr");
    row.dataset.plu = p["Product PLU"];
    
    const currentGroupId = p.productGroupId;
    if (currentGroupId && currentGroupId !== lastGroupId) {
        groupClassToggle = !groupClassToggle;
        lastGroupId = currentGroupId;
    }
    if (currentGroupId) {
        row.classList.add(groupClassToggle ? 'group-a' : 'group-b');
    }
    
    if (isStockItem) {
        row.innerHTML = `
            <td>${p["Product PLU"]}</td>
            <td>${p["Base Name"]}</td>
            <td>${p["Inventory Category"]}</td>
            <td>${p["Selling UOM"]}</td>
            <td>${(parseFloat(p["Cost Price"]) || 0).toFixed(2)}</td>
        `;
        row.appendChild(createActionsCell(p, index));
    } else {
        row.innerHTML = `
            <td>${p["Product PLU"]}</td>
            <td>${p["Base Name"]}</td>
            <td>${p["Variant Name"]}</td>
            <td>${p["Menu Category"]}</td>
            <td>${(parseFloat(p["Selling Price"]) || 0).toFixed(2)}</td>
        `;
        row.appendChild(createActionsCell(p, index));
    }

    targetTbody.appendChild(row);

    if (index >= newProductStartIndex) {
        row.classList.add('new-row');
    }
  });

  if (newProductStartIndex !== -1) { 
    setTimeout(() => { 
        document.querySelectorAll('.new-row').forEach(r => r.classList.remove('new-row')); 
    }, 2500); 
  }

  // Re-apply filters after table redraw
  filterTable(document.getElementById('productSearch'), 'productTable');
  filterTable(document.getElementById('stockSearch'), 'stockTable');
}

// --- INLINE VALIDATION ---
function showValidationError(element, message) {
    element.classList.add('input-invalid');
    const parent = element.parentElement.closest('.form-group');
    let errorSpan = parent.querySelector('.error-message');
    if (!errorSpan) {
        errorSpan = document.createElement('div');
        errorSpan.className = 'error-message';
        parent.appendChild(errorSpan);
    }
    errorSpan.textContent = message;
}
function clearValidationError(element) {
    element.classList.remove('input-invalid');
    const parent = element.parentElement.closest('.form-group');
    const errorSpan = parent.querySelector('.error-message');
    if (errorSpan) {
        errorSpan.remove();
    }
}
function clearAllValidationErrors() {
    document.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());
}
function setupInlineValidation() {
    const fieldsToValidate = [
        'productName', 'taxApplicable', 'productType', 'uom', 'prepLocation', 
        'menuCategory', 'inventoryCategory', 'suppliedQuantity', 'yieldQuantity'
    ];
    fieldsToValidate.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', (e) => {
                if(e.target.hasAttribute('required') && e.target.value.trim() === '') {
                     showValidationError(e.target, 'This field is required.');
                }
            });
            el.addEventListener('input', (e) => clearValidationError(e.target));
        }
    });
}


function exportToExcel() {
    if (products.length === 0) {
        showModal("No products to export!", "warning");
        return;
    }
    
    if (!sessionSite || sessionSite.trim() === '') {
        showModal("Please set the 'Site' in Session Defaults before exporting. The site name is used for the exported file name.", "error");
        return;
    }

    const videoOverlay = document.getElementById('videoOverlay');
    const exportVideo = document.getElementById('exportVideo');

    // Main sheet data
    const exportData = products.map(p => {
        let inventoryCategory = p["Inventory Category"];
        if (inventoryCategory) { 
            switch (p["Original Product Type"]) {
                case "finishedGood": inventoryCategory += " - FINISHED GOOD"; break;
                case "rawMaterial": case "finishedGood & rawMaterial": inventoryCategory += " - RAW MATERIALS"; break;
                case "Manufactured": inventoryCategory += " - MANUFACTURED"; break;
            }
        }
        let finalCostPrice = p["Cost Price"];
        // For raw items, calculate unit cost for export sheet if supplied qty is present
        if (p["Original Product Type"] === 'rawMaterial' && p["Supplied Quantity"] && Number(p["Supplied Quantity"]) > 0) {
            finalCostPrice = p["Cost Price"] / Number(p["Supplied Quantity"]);
        }

        return {
          "Product PLU": p["Product PLU"], "Product Name & Variant": p["Product Name & Variant"], "Site": p.Site,
          "GP": p["GP"], "Selling UOM": p["Selling UOM"], "Preparation Location": p["Preparation Location"],
          "Menu Category": p["Menu Category"], "Inventory Category": inventoryCategory, "Inventory Sub-Category": p["Inventory Sub-Category"],
          "Product Type": p["Product Type"], "Enabled": p.Enabled, "Cost Price": finalCostPrice, "Selling Price": p["Selling Price"],
          "Dynamic Price": false, "Visible on App": false, "Default Selling Location": "Default Selling Location", "Default Storage Location": "Default Storage Location",
          "Tax Applicable": p["Tax Applicable"],
          "Barcode": p.Barcode, "Supplied Quantity": p["Supplied Quantity"] ? `${p["Supplied Quantity"]} ${p["Selling UOM"]}` : '',
          "Supplied Quantity Cost Price": p["Supplied Quantity"] ? p["Cost Price"] : '', "Manufactured Yield": p["Manufactured Yield"],
          "Product PLU (End)": p["Product PLU"], "Product Name": p["Base Name"],
          "Variant": p["Variant Name"] ? p["Variant Name"] : "", "Listed Product Type": p["Original Product Type"]
        };
    });

    // Second sheet data
    const createProductStructureData = products.map(p => {
        const variantName = p["Variant Name"] || '';
        const linkedGroups = p._source?.modifierLinks?.[variantName] || [];
        const modifierColumnValue = linkedGroups.join(', ');

        return {
            "Product PLU": p["Product PLU"], "Name": p["Base Name"],
            "Variants": p["Variant Name"] ? p["Variant Name"] : "",
            "Modifiers": modifierColumnValue,
            "Menu Categories": p["Menu Category"], "Inventory Type": p["Original Product Type"], "Tags": "",
            "Selling UOM": p["Selling UOM"], "Tax Applicable": p["Tax Applicable"], "Show on Royalty": false,
            "Inventory Category": p["Inventory Category"], "Inventory Sub-Category": p["Inventory Sub-Category"],
            "Barcodes": p.Barcode, "Product SKU": p["Product PLU"], "Description": ""
        };
    });

    // Third sheet data (Modifier Groups)
    const modifierSheetData = [];
    if (currentModifierGroups.length > 0) {
        currentModifierGroups.forEach(group => {
            const linkedProductsForGroup = products
                .filter(p => {
                    const variantName = p["Variant Name"] || '';
                    const linkedGroups = p._source?.modifierLinks?.[variantName] || [];
                    return linkedGroups.includes(group.groupName);
                })
                .map(p => p["Product Name & Variant"]);

            modifierSheetData.push({ "Line Item": `MODIFIER GROUP: ${group.groupName}`, "Details": "" });
            modifierSheetData.push({ "Line Item": "Options", "Details": "Price" });
            if (group.options && group.options.length > 0) {
                group.options.forEach(option => {
                    modifierSheetData.push({ "Line Item": option.name, "Details": (option.price || 0).toFixed(2) });
                });
            } else {
                modifierSheetData.push({ "Line Item": "(No options defined)", "Details": "" });
            }

            modifierSheetData.push({}); 
            modifierSheetData.push({ "Line Item": "Linked Selling Products", "Details": `(${linkedProductsForGroup.length} item/s)` });
            if (linkedProductsForGroup.length > 0) {
                linkedProductsForGroup.forEach(productName => {
                    modifierSheetData.push({ "Line Item": productName, "Details": "" });
                });
            } else {
                modifierSheetData.push({ "Line Item": "(Not linked to any products on the list)", "Details": "" });
            }
            
            modifierSheetData.push({});
            modifierSheetData.push({});
        });
    } else {
        modifierSheetData.push({ "Line Item": "No modifier groups have been created.", "Details": "" });
    }

    const ws1 = XLSX.utils.json_to_sheet(exportData);
    const ws2 = XLSX.utils.json_to_sheet(createProductStructureData);
    const ws3 = XLSX.utils.json_to_sheet(modifierSheetData, {skipHeader: false});
    ws3['!cols'] = [ {wch:60}, {wch:20} ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Site Product Structure");
    XLSX.utils.book_append_sheet(wb, ws2, "Create Product structure");
    XLSX.utils.book_append_sheet(wb, ws3, "Modifier Groups");
  
    const sanitizedSiteName = sessionSite.trim().replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');
    const fileName = `${sanitizedSiteName}_Table_by_Yoco.xlsx`;
    XLSX.writeFile(wb, fileName);

    videoOverlay.style.display = 'flex';
    exportVideo.currentTime = 0;
    exportSoundElement.currentTime = 0;
    exportVideo.play();
    exportSoundElement.play();

    exportVideo.onended = () => {
        videoOverlay.style.display = 'none';
        showModal('Export successful! Clear all data?', 'warning', () => clearAllData(), true);
    };
}
function addToDatalist(id, value) {
  if (!value) return; 
  const datalist = document.getElementById(id);
  if (!datalist) {
      console.error(`Datalist with id "${id}" not found.`);
      return;
  }
  if (![...datalist.options].some(o => o.value === value)) {
    const opt = document.createElement("option"); opt.value = value; datalist.appendChild(opt);
  }
}