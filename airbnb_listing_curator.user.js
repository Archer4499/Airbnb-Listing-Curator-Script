// ==UserScript==
// @name         Airbnb Listing Curator (Hiding/Highlighting)
// @namespace    https://github.com/Archer4499
// @version      1.2.4
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

    // Configuration
    const STORAGE_CURRENT_VERSION = 'v2';
    const STORAGE_VERSION_KEY = 'version';
    const STORAGE_LISTING_KEY = 'airbnb_listing_states';

    // Colours
    const COLOURS = {
        HIGHLIGHT_1: '#fffacd',
        HIGHLIGHT_2: '#ccffcc',
        NEUTRAL: ''
    };

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .curator-theme-hide {
            background-color: #ffcccc; color: #cc0000;
        }
        .curator-theme-h1   {
            background-color: #fffacd; color: #b8860b; /* Yellow */
        }
        .curator-theme-h2   {
            background-color: #ccffcc; color: #006400; /* Green */
        }
        .curator-button-panel {
            position: absolute;
            bottom: 12px;
            right:  12px;
            background: var(--palette-bg-primary);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.16);
            border: none;
            border-radius: 40px;
            padding: 4px 5px;
            display: flex;
            gap: 5px;
        }
        .curator-button {
            border: none;
            border-radius: 40px;
            width:  20px;
            height: 20px;
            cursor: pointer;
            font-weight: var(--typography-weight-medium500);
            line-height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.1s, opacity 0.2s;
            opacity: 0.7;
        }
        .curator-button:hover {
            transform: scale(1.1);
            opacity: 1;
        }
        .curator-button.active {
            border: 1px solid #555;
            opacity: 1;
            transform: scale(1.1);
        }
        button.curator-theme-hide { border-radius: 40px 0px 0px 40px; }
        button.curator-theme-h1   { border-radius: 0px; }
        button.curator-theme-h2   { border-radius: 0px 40px 40px 0px; padding-bottom: 2px; }

        /* --- Dashboard Overlay --- */
        .curator-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .curator-modal {
            background: white;
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            border-radius: 12px;
            padding: 24px;
            overflow-y: auto;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            position: relative;
        }
        .curator-modal h2 { margin-top: 0px; }
        .curator-modal h3 {
            text-align: center;
            margin-top: 40px;
            margin-bottom: 0px;
        }
        .curator-modal button {
            font-size: 24px;
            cursor: pointer;
            border: none;
            background: none;
        }
        .curator-modal button:hover {
            font-weight: 600;
        }
        .curator-close {
            position: absolute;
            top: 15px;
            right: 20px;
        }
        .curator-table { width: 100%; border-collapse: collapse; }
        .curator-table th { text-align: left; border-bottom: 2px solid #ddd; padding: 8px; }
        .curator-table td { border-bottom: 1px solid #eee; padding: 8px; color: #222; }
        .curator-link { text-decoration: none; color: #222; font-weight: 500; }
        .curator-link:hover { text-decoration: underline; }
    `;
    document.head.appendChild(style);


    // Helpers

    // Run once each time the script is initialised
    (function migrateStorage() {
        if (GM_getValue(STORAGE_VERSION_KEY, '') != STORAGE_CURRENT_VERSION) {
            // Migrate v1 to v2
            //  From each listing only storing its id to being an array also storing its name
            if (GM_getValue(STORAGE_VERSION_KEY, '') === '') {
                console.log(`[Airbnb Listing Curator] Migrating storage from v1 to v2.`);

                const listings = getSavedListings();
                let migratedListings = {};

                for (const [id, state] of Object.entries(listings)) {
                    if (state === null || state.constructor != Object) {
                        migratedListings[id] = {state: state, name: ''};
                    }
                }
                GM_setValue(STORAGE_LISTING_KEY, migratedListings);
                GM_setValue(STORAGE_VERSION_KEY, 'v2');
            }
        }
    })();

    function getSavedListings() {
        return GM_getValue(STORAGE_LISTING_KEY, {});
    }

    function getSavedListingOrDefault(id) {
        const listings = getSavedListings();
        if (Object.hasOwn(listings, id)) {
            return listings[id];
        } else {
            return {state: null, name: null};
        }
    }

    function setSavedListing(id, state, name='') {
        const listings = getSavedListings();
        if (state === null) {
            delete listings[id]; // Remove from storage if neutral
            console.log(`[Airbnb Listing Curator] Removed ID ${id} from storage.`);
        } else {
            if (Object.hasOwn(listings, id)) {
                listings[id].state = state;
                if (name) listings[id].name = name;
            } else {
                listings[id] = {state: state, name: name};
            }
            console.log(`[Airbnb Listing Curator] Set ID: "${id}", NAME: "${listings[id].name}" to ${state}.`);
        }
        GM_setValue(STORAGE_LISTING_KEY, listings);
    }

    function getContainerElement(meta) {
        // This may have to change as Airbnb changes their list layout

        // Find the closest parent div that has a style attribute
        const styleDiv = meta.closest('div[style]');
        if (!styleDiv) return;

        // The container we want to hide is the parent of that style div
        const container = styleDiv.parentElement;

        return container;
    }

    function getButtonAnchorElement(container) {
        // This may have to change as Airbnb changes their list layout

        // Allows to place our content in the bottom right of the image curatorove other interactcuratorle elements
        // A few divs up from the ideal element, but works well enough and hopefully a more relicuratorle selector
        const anchor = container.querySelector('div[data-testid="content-scroller"]');

        return anchor;
    }

    function applyVisuals(container, state, panel) {
        const buttons = panel.querySelectorAll('.curator-button');
        if (!buttons) return;

        if (state === 'HIDDEN') {
            container.style.display = 'none';
            container.style.backgroundColor = '';
            // Never mark the hide button active because it's invisible when 'active'.
            buttons[1].classList.remove('active');
            buttons[2].classList.remove('active');

        } else if (state === 'HIGHLIGHT_1') {
            container.style.display = '';
            container.style.backgroundColor = COLOURS.HIGHLIGHT_1;
            buttons[1].classList.add('active');
            buttons[2].classList.remove('active');

        } else if (state === 'HIGHLIGHT_2') {
            container.style.display = '';
            container.style.backgroundColor = COLOURS.HIGHLIGHT_2;
            buttons[1].classList.remove('active');
            buttons[2].classList.add('active');

        } else {
            // Remove all changes
            container.style.display = '';
            container.style.backgroundColor = '';
            buttons[0].classList.remove('active');
            buttons[1].classList.remove('active');
            buttons[2].classList.remove('active');
        }
    }

    function createButton(text, className, title, targetState, listingId, panel, container) {
        const button = document.createElement('button');
        button.innerText = text;
        button.className = `curator-button ${className}`;
        button.title = title;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const currentSavedState = getSavedListingOrDefault(listingId).state;

            if (currentSavedState === targetState) {
                // Toggle OFF (return to neutral)
                setSavedListing(listingId, null);
                applyVisuals(container, null, panel);
            } else {
                // Set New State
                // Safety check for Hide
                if (targetState === 'HIDDEN' && !confirm('Hide this listing?')) return;

                const metaName = container.querySelector('meta[itemprop="name"]');
                const name = (metaName) ? metaName.content : null;

                setSavedListing(listingId, targetState, name);
                applyVisuals(container, targetState, panel);
            }
        });
        return button;
    }


    // --- Main Logic ---
    function processListings() {
        // Use the listing url meta tags to find each listing
        const metaTags = document.querySelectorAll('meta[itemprop="url"]');

        for (const meta of metaTags) {
            const content = meta.getAttribute('content');
            if (!content) continue;

            // Extract the ID from the URL
            const match = content.match(/(\d+)/);
            if (!match) continue;
            const listingId = match[1];

            const container = getContainerElement(meta);
            if (!container) continue;

            const anchor = getButtonAnchorElement(container);
            if (!anchor) continue;

            let panel = anchor.querySelector('.curator-button-panel');

            // If the button panel doesn't exist, create one
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'curator-button-panel';

                const buttonHide = createButton('✕', 'curator-theme-hide', 'Hide Listing', 'HIDDEN', listingId, panel, container);
                const buttonH1 = createButton('?', 'curator-theme-h1', 'Maybe', 'HIGHLIGHT_1', listingId, panel, container);
                const buttonH2 = createButton('★', 'curator-theme-h2', 'Like', 'HIGHLIGHT_2', listingId, panel, container);
                // Heart Icon <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display: block;fill: rgba(0, 0, 0, 0.5);height: 16px;width: 16px;overflow: visible;padding-top: 2px;"><path d="m15.9998 28.6668c7.1667-4.8847 14.3334-10.8844 14.3334-18.1088 0-1.84951-.6993-3.69794-2.0988-5.10877-1.3996-1.4098-3.2332-2.11573-5.0679-2.11573-1.8336 0-3.6683.70593-5.0668 2.11573l-2.0999 2.11677-2.0988-2.11677c-1.3995-1.4098-3.2332-2.11573-5.06783-2.11573-1.83364 0-3.66831.70593-5.06683 2.11573-1.39955 1.41083-2.09984 3.25926-2.09984 5.10877 0 7.2244 7.16667 13.2241 14.3333 18.1088z"></path></svg>

                panel.appendChild(buttonHide);
                panel.appendChild(buttonH1);
                panel.appendChild(buttonH2);

                // Allow clicks on the panel without triggering the listing card
                panel.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

                anchor.appendChild(panel);
            }

            // Apply the saved state or clear it
            applyVisuals(container, getSavedListingOrDefault(listingId).state, panel);
        }
    }

    // Dashboard
    function showDashboard() {
        // Do nothing if already open
        const existing = document.querySelector('.curator-overlay');
        if (existing) return;

        const overlay = document.createElement('div');
        overlay.className = 'curator-overlay';
        overlay.onclick = () => overlay.remove();

        const modal = document.createElement('div');
        modal.className = 'curator-modal';
        modal.onclick = (e) => e.stopPropagation();

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'curator-close';
        closeButton.onclick = () => overlay.remove();

        const title = document.createElement('h2');
        title.innerText = 'Curated Listings';

        const highlight2Title = document.createElement('h3');
        highlight2Title.innerText = 'Like (★)';

        const highlight1Title = document.createElement('h3');
        highlight1Title.innerText = 'Maybe (?)';

        const hiddenTitle = document.createElement('h3');
        hiddenTitle.innerText = 'Hidden';

        const headerHTML = `<thead><tr><th>Name</th><th style="width: 130px;">Link</th><th style="text-align: right;width: 10px;">Remove</th></tr></thead><tbody></tbody>`;
        const highlight2Table = document.createElement('table');
        highlight2Table.className = 'curator-table';
        highlight2Table.innerHTML = headerHTML;
        const highlight2Tbody = highlight2Table.querySelector('tbody');
        highlight2Tbody.className = 'curator-theme-h2';

        const highlight1Table = document.createElement('table');
        highlight1Table.className = 'curator-table';
        highlight1Table.innerHTML = headerHTML;
        const highlight1Tbody = highlight1Table.querySelector('tbody');
        highlight1Tbody.className = 'curator-theme-h1';

        const hiddenTable = document.createElement('table');
        hiddenTable.className = 'curator-table';
        hiddenTable.innerHTML = headerHTML;
        const hiddenTbody = hiddenTable.querySelector('tbody');
        hiddenTbody.className = 'curator-theme-hide';

        const data = getSavedListings();

        for (const [id, listing] of Object.entries(data)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${(listing.name) ? listing.name : id}</td>
                <td><a href="https://www.airbnb.com.au/rooms/${id}" target="_blank" class="curator-link">View Listing</a></td>
            `;

            const removeButton = document.createElement('button');
            removeButton.innerHTML = '&times;';
            removeButton.onclick = () => { setSavedListing(id, null); tr.remove(); processListings(); };
            const removeCell = document.createElement('td');
            removeCell.style.textAlign = 'right';
            removeCell.appendChild(removeButton);
            tr.appendChild(removeCell);

            if (listing.state === 'HIDDEN') {
                hiddenTbody.appendChild(tr);
            } else if (listing.state === 'HIGHLIGHT_1') {
                highlight1Tbody.appendChild(tr);
            } else if (listing.state === 'HIGHLIGHT_2') {
                highlight2Tbody.appendChild(tr);
            }
        }

        modal.appendChild(closeButton);
        modal.appendChild(title);
        modal.appendChild(highlight2Title);
        modal.appendChild(highlight2Table);
        modal.appendChild(highlight1Title);
        modal.appendChild(highlight1Table);
        modal.appendChild(hiddenTitle);
        modal.appendChild(hiddenTable);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // Menu Commands
    GM_registerMenuCommand("Show Curator List", showDashboard);

    GM_registerMenuCommand("Clear ALL Data", () => {
        if (confirm("Reset everything? This will unhide all listings.")) {
            GM_setValue(STORAGE_LISTING_KEY, {});
            location.reload();
        }
    });

    // Watch for DOM changes of the listings table
    const observer = new MutationObserver(() => {
        processListings();
    });
    observer.observe(document.querySelector('div[data-xray-jira-component="Guest: Listing Cards"]'), { childList: true, subtree: true });

    // Also run every 2 seconds to catch any other sources of changes
    setInterval(processListings, 2000);

    // Initial run
    setTimeout(() => {
        processListings();
    }, 500);

})();
