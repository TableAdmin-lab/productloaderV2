// ocr.js

/**
 * Calls the Gemini API with a base64 image string.
 * @param {string} base64String The base64 encoded image data.
 * @param {string} mimeType The MIME type of the image.
 * @returns {Promise<Array<Object>>} A promise that resolves with the structured menu data from the AI.
 */
async function getMenuDataFromAI(base64String, mimeType) {
    const model = 'gemini-1.5-flash-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    const requestPayload = {
        contents: [{
            parts: [
                { text: `
                  You are a world-class menu data extraction AI. Your task is to extract all item data as accurately as possible from the menu image. Each menu item listed should be treated as a unique product.

                  **MASTER INSTRUCTIONS:**

                  1.  **ITEM SPLITTING (IMPORTANT):**
                      * If a single line item lists multiple product names joined by commas or words like "OR" that share a single price (e.g., "Coke, Fanta or Sprite @ R20"), you **MUST** create a separate, individual product entry for each one.
                      * For "Grapetizer or Appletizer R20", you must output two separate JSON objects: one for "Grapetizer" at price 20, and one for "Appletizer" at price 20.
                      * Do **NOT** create a single item with the name "Grapetizer or Appletizer". This same logic applies to modifier options.

                  2.  **ITEM IDENTIFICATION:**
                      * Each distinct item on the menu is its own product. Do **NOT** group items like "Regina Pizza" and "Hawaiian Pizza" into a single "Pizza" item.
                      * **"name"**: Extract the full, unique product name as it appears on the menu (e.g., "Pepperoni Deluxe").

                  3.  **ITEM PRICE (\`price\` field):**
                      * This field **MUST** contain the price of the **smallest or most basic option** for each unique item. For a pizza with Small/Large prices, this would be the Small price.

                  4.  **VARIANT PRICES (\`variantPricing\` field):**
                      * This array must contain an entry for **EVERY SINGLE OPTION** available for an item (e.g., different sizes).
                      * For **EVERY** option, provide the **ADDITIONAL COST (UPCHARGE)** relative to that specific item's base \`price\`.
                      * The base option itself (e.g., "Small") has an upcharge of 0.
                      * Example: If a "Pepperoni Deluxe" Small is R46.00 and Large is R95.90, its base \`price\` is 46.00. The \`variantPricing\` would include \`[{ "Size": "Small", "price": 0 }, { "Size": "Large", "price": 49.90 }]\`.

                  5.  **SECTIONAL RULES (IMPORTANT):**
                      * Look for rules or options that apply to a whole category, like "Gluten-Free pizza base ADD R25".
                      * When you find such a rule, you **MUST** create a \\\`variantGroup\\\` for **EVERY SINGLE ITEM** in that section.
                      * This group **MUST** include the special options (e.g., "Gluten-free") AND the implied default option (e.g., "Normal Base" or "Standard").
                      * The default option **MUST** have an upcharge of 0.
                      * Example: For a pizza section with a "Gluten-free base ADD R44" rule, every pizza in that section should get a \\\`variantGroup\\\` like: \\\`{"groupName": "Base", "options": [{"type": "Standard"}, {"type": "Gluten-free"}]}\\\` and corresponding \\\`variantPricing\\\` like \\\`[{"Base": "Standard", "price": 0}, {"Base": "Gluten-free", "price": 44}]\\\`.

                  6.  **JSON STRUCTURE:**
                      - **"name"**: The full product name.
                      - **"category"**: The menu category.
                      - **"price"**: The base price of the item (lowest price).
                      - **"variantGroups"**: A list of variant groups like Size or Base.
                      - **"variantPricing"**: A list of price **UPCHARGES** for all individual options.
                      - **"modifierGroups"**: For optional add-ons.

                  7.  **FINAL CHECK:**
                      * Ensure the final output is ONLY a valid JSON array. Do not wrap it in markdown backticks.
                      * Prices must be numbers (e.g., \`42.90\`), not strings.
                  `
                },
                { inlineData: { mimeType: mimeType, data: base64String } }
            ]
        }]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`API request failed: ${errorBody.error.message}`);
    }

    const responseData = await response.json();
    const jsonText = responseData.candidates[0].content.parts[0].text;

    // --- ROBUST JSON CLEANING ---
    let cleanText = jsonText.replace(/```json/g, '').replace(/```/g, '');
    cleanText = cleanText.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) {
        console.log("No valid JSON array found on this page, treating as empty.");
        return [];
    }
    let dirtyJson = cleanText.substring(firstBracket, lastBracket + 1);
    const cleanJson = dirtyJson.replace(/,(?=\s*[}\]])/g, '');

    return JSON.parse(cleanJson);
}


/**
 * Processes a single image file or a multi-page PDF.
 * @param {File} file The image or PDF file to process.
 * @param {function(string): void} onProgress A callback function to report progress.
 * @returns {Promise<Array<Object>>} A promise that resolves with the structured menu item data.
 */
function processFileWithOCR(file, onProgress) {
    return new Promise(async (resolve, reject) => {
        try {
            let allItems = [];
            onProgress('Preparing file for analysis...');

            if (file.type === 'application/pdf') {
                const pdfjsLib = window['pdfjs-dist/build/pdf'];
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const pdf = await pdfjsLib.getDocument(event.target.result).promise;
                        for (let i = 1; i <= pdf.numPages; i++) {
                            onProgress(`Processing page ${i} of ${pdf.numPages}...`);
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 2.0 });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            const base64String = canvas.toDataURL('image/png').split(',')[1];
                            const pageItems = await getMenuDataFromAI(base64String, 'image/png');
                            allItems.push(...pageItems);
                        }
                    } catch (pdfError) {
                        reject(pdfError);
                        return;
                    }
                    finalizeProcessing(allItems, onProgress, resolve);
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);

            } else {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64String = event.target.result.split(',')[1];
                    onProgress('Analyzing menu with AI... This may take a moment.');
                    allItems = await getMenuDataFromAI(base64String, file.type);
                    finalizeProcessing(allItems, onProgress, resolve);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error during OCR or Normalization:', error);
            onProgress('AI analysis failed. Using sample data.');
            alert(`Could not process the menu: ${error.message}`);
            resolve([
                { id: 1, name: 'Sample Steak (AI failed)', price: 250.00, variantGroups: [], modifierGroups: [], category: 'Main Course' },
            ]);
        }
    });
}

/**
 * Normalizes the combined menu data and resolves the main promise.
 * @param {Array<Object>} menuData The raw menu data from all pages.
 * @param {function(string): void} onProgress The progress callback.
 * @param {function(Array<Object>): void} resolve The resolve function of the main promise.
 */
function finalizeProcessing(menuData, onProgress, resolve) {
    console.log('--- RAW OCR DATA (ALL PAGES) ---', JSON.stringify(menuData, null, 2));

    const correctPrice = (price) => {
        if (typeof price !== 'number') return 0;
        if (price > 1000) { return price / 100; }
        return price;
    };

    const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

    const normalizedMenuData = menuData.map((item, index) => {
        const newItem = { ...item, id: index + 1, price: correctPrice(item.price) };

        if (Array.isArray(item.variantGroups) && item.variantGroups.length > 0) {
            const priceLookup = {};
            const discoveredGroups = {};

            // Step 1: Discover all variants and their upcharge prices from all available data sources.
            const dataSources = [item.variantPricing, item.variantGroups];
            dataSources.forEach((source, sourceIndex) => {
                if (!Array.isArray(source)) return;

                if (sourceIndex === 0) { // Source A: variantPricing array (preferred)
                    source.forEach(entry => {
                        const groupName = Object.keys(entry).find(k => k.toLowerCase() !== 'price');
                        if (!groupName) return;
                        const variantName = entry[groupName];
                        const price = correctPrice(entry.price);

                        if (!discoveredGroups[groupName]) { discoveredGroups[groupName] = new Set(); priceLookup[groupName] = {}; }
                        discoveredGroups[groupName].add(variantName);
                        priceLookup[groupName][variantName] = price;
                    });
                } else { // Source B: variantGroups array (merges any missing info)
                    source.forEach(group => {
                        const groupName = group.name || group.groupName;
                        if (!groupName) return;
                        if (!discoveredGroups[groupName]) { discoveredGroups[groupName] = new Set(); priceLookup[groupName] = {}; }
                        if (Array.isArray(group.options)) {
                            group.options.forEach(opt => {
                                // --- ROBUSTNESS FIX --- 
                                // Handles multiple formats: string, {type: '...'}, {name: '...'}, or {"GroupName": "OptionName"}
                                let optName = null;
                                if (typeof opt === 'string') {
                                    optName = opt;
                                } else if (opt && typeof opt === 'object') {
                                    optName = opt.type || opt.name;
                                    if (!optName) {
                                        const key = Object.keys(opt).find(k => k.toLowerCase() !== 'price');
                                        if (key) optName = opt[key];
                                    }
                                }
                                
                                if (!optName) return; // Skip if no name can be determined
                                discoveredGroups[groupName].add(optName);

                                // If price info was merged here, extract it.
                                if (priceLookup[groupName][optName] === undefined) {
                                    const price = (opt && opt.price !== undefined) ? correctPrice(opt.price) : 0;
                                    priceLookup[groupName][optName] = price;
                                }
                            });
                        }
                    });
                }
            });

            // Step 2: Rebuild a clean variantGroups array from all discovered data.
            const cleanVariantGroups = Object.keys(discoveredGroups).map(groupName => ({
                groupName: groupName,
                options: Array.from(discoveredGroups[groupName]).map(opt => ({ type: opt }))
            }));
            newItem.variantGroups = cleanVariantGroups;

            // Step 3: The Simplified Calculation Engine.
            const variantOptionsForCartesian = cleanVariantGroups.map(group =>
                group.options.map(opt => ({ groupName: group.groupName, name: opt.type }))
            );
            
            const newPricing = [];
            if (variantOptionsForCartesian.length > 0) {
                const combinations = cartesian(...variantOptionsForCartesian);
                combinations.forEach(combo => {
                    const comboArray = Array.isArray(combo) ? combo : [combo];
                    
                    // Logic: Start with base price and add all upcharges.
                    let totalPrice = newItem.price; 
                    comboArray.forEach(variant => {
                        totalPrice += priceLookup[variant.groupName]?.[variant.name] || 0;
                    });

                    const comboString = comboArray.map(v => `${v.groupName}:${v.name}`).join(';');
                    if (comboString) {
                        newPricing.push({ combination: comboString, price: totalPrice });
                    }
                });
                newItem.variantPricing = newPricing;
            }
        }

        // Step 4: Standardize Modifier Groups
        if (Array.isArray(newItem.modifierGroups)) {
            newItem.modifierGroups.forEach(group => {
                if (group.name) { group.groupName = group.name; delete group.name; }
                if (group.modifiers) { group.options = group.modifiers; delete group.modifiers; }
                if (Array.isArray(group.options)) {
                    group.options.forEach(option => { option.price = correctPrice(option.price); });
                }
            });
        }
        return newItem;
    });

    onProgress('Processing complete!');
    resolve(normalizedMenuData);
}