// ==UserScript==
// @name         Airbnb Listing Curator (Hiding/Highlighting)
// @namespace    https://github.com/Archer4499
// @version      1.0
// @description  Hide or highlight listings on Airbnb
// @author       Ailou
// @license		 MIT
// @homepageURL	 https://github.com/Archer4499/Airbnb-Listing-Curator-Script#readme
// @supportURL	 https://github.com/Archer4499/Airbnb-Listing-Curator-Script/issues
// @downloadURL  https://raw.githubusercontent.com/Archer4499/Airbnb-Listing-Curator-Script/master/airbnb_listing_curator.user.js
// @updateURL	 https://raw.githubusercontent.com/Archer4499/Airbnb-Listing-Curator-Script/master/airbnb_listing_curator.user.js
// @icon         https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-Favicons/original/0d189acb-3f82-4b2c-b95f-ad1d6a803d13.png?im_w=240
// @match        https://www.airbnb.com.au/*
// @match        https://www.airbnb.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const STORAGE_KEY = 'airbnb_hidden_ids';

    // --- Styles ---
    const style = document.createElement('style');
    style.textContent = `
        .curator-hide-btn {
            position: absolute;
            bottom: 12px;
            right: 12px;
            background-color: rgba(255, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 40px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: var(--typography-body-text_14_18-font-size);
            line-height: var(--typography-body-text_14_18-line-height);
            letter-spacing: var(--typography-body-text_14_18-letter-spacing);
            font-weight: var(--typography-weight-medium500);
            transition: background 0.2s;
        }
        .curator-hide-btn:hover {
            background-color: red;
        }
        .listing-processed {
            /* No visual change, just a marker class */
        }
    `;
    document.head.appendChild(style);

    // --- Helpers ---
    function getHiddenIds() {
        return GM_getValue(STORAGE_KEY, []);
    }

    function addHiddenId(id) {
        const ids = getHiddenIds();
        if (!ids.includes(id)) {
            ids.push(id);
            GM_setValue(STORAGE_KEY, ids);
            console.log(`[Airbnb Listing Curator] Added ID ${id} to hidden list.`);
        }
    }

    function removeHiddenId(id) {
        let ids = getHiddenIds();
        ids = ids.filter(storedId => storedId !== id);
        GM_setValue(STORAGE_KEY, ids);
        console.log(`[Airbnb Listing Curator] Removed ID ${id} from hidden list.`);
    }

    function getContainerElement(meta_element) {
        // This may have to change as Airbnb changes their list layout

        // Find the closest parent div that has a style attribute
        const styleDiv = meta_element.closest('div[style]');
        if (!styleDiv) return;

        // The container we want to hide is the parent of that style div
        const container = styleDiv.parentElement;

        return container;
    }

    function getButtonAnchorElement(container_element) {
        // This may have to change as Airbnb changes their list layout

        // Allows to place our content in the bottom right of the image above other interactable elements
        // A few divs up from the ideal element, but works well enough and hopefully a more reliable selector
        const anchor = container_element.querySelector('div[data-testid="content-scroller"]');

        return anchor;
    }


    // --- Main Logic ---
    function processListings() {
        // Use the listing url meta tags to find each listing
        const metaTags = document.querySelectorAll('meta[itemprop="url"]');

        const hiddenIds = getHiddenIds();

        metaTags.forEach(meta => {
            const content = meta.getAttribute('content');
            if (!content) return;

            // Extract the ID from the URL
            const match = content.match(/(\d+)/);
            if (!match) return;
            const listingId = match[1];

            const container = getContainerElement(meta);
            if (!container) return;

            // Check if we've already processed this container to avoid duplicate buttons
            if (container.classList.contains('listing-processed')) {
                // Even if processed, check if we need to re-hide (in case of dynamic reload)
                if (hiddenIds.includes(listingId)) {
                    container.style.display = 'none';
                }
                return;
            }

            // Mark as processed
            container.classList.add('listing-processed');

            // Hide if already in saved list
            if (hiddenIds.includes(listingId)) {
                container.style.display = 'none';
                // Still continue to add the button logic in case the listing is unhidden
            }

            // Create the button
            const btn = document.createElement('button');
            btn.innerText = 'Hide';
            btn.className = 'curator-hide-btn';
            btn.title = `Hide ID: ${listingId}`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // So clicking the button doesn't also open the listing

                if (confirm('Hide this listing?')) {
                    addHiddenId(listingId);
                    container.style.display = 'none';
                }
            });

            // Append button to the button anchor
            const anchor = getButtonAnchorElement(container)
            anchor.appendChild(btn);
        });
    }

    // Menu Command to clear the saved list
    GM_registerMenuCommand("Clear Hidden Listings", () => {
        if (confirm("Are you sure you want to clear your hidden listings list?")) {
            GM_setValue(STORAGE_KEY, []);
            location.reload();
        }
    });

    // Watch for DOM changes
    const observer = new MutationObserver(() => {
        processListings();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial run
    processListings();

})();