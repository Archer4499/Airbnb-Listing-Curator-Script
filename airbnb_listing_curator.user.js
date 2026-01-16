// ==UserScript==
// @name         Airbnb Listing Curator (Hiding/Highlighting)
// @namespace    https://github.com/Archer4499
// @version      1.3.3
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
// @grant        GM_addValueChangeListener
// @grant        window.onurlchange
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const STORAGE_CURRENT_VERSION = 'v2';
    const STORAGE_VERSION_KEY = 'version';
    const STORAGE_LISTING_KEY = 'airbnb_listing_states';

    const LOG_PREFIX = '[Airbnb Listing Curator]';

    const STATE = Object.freeze({
        HIDDEN: 'HIDDEN',
        HIGHLIGHT_1: 'HIGHLIGHT_1',
        HIGHLIGHT_2: 'HIGHLIGHT_2',
        NEUTRAL: null
    });
    
    const COLOURS = Object.freeze({
        HIDE: '#ffcccc',
        HIGHLIGHT_1: '#fffacd',
        HIGHLIGHT_2: '#ccffcc',
        NEUTRAL: ''
    });

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .curator-theme-hide {
            background-color: ${COLOURS.HIDE}; color: #cc0000;
        }
        .curator-theme-h1   {
            background-color: ${COLOURS.HIGHLIGHT_1}; color: #b8860b; /* Yellow */
        }
        .curator-theme-h2   {
            background-color: ${COLOURS.HIGHLIGHT_2}; color: #006400; /* Green */
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
            font-weight: 500;
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

        /* --- Listing Page Sidebar Panel --- */
        .curator-sidebar-panel {
            margin: 24px 0px;
            padding: 16px 24px;
            background: var(--palette-bg-primary);
            border-radius: 12px;
            border: var(--elevation-high-border);
            box-shadow: var(--elevation-secondary-box-shadow);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .curator-sidebar-label { font-weight: 500; font-size: 14px; line-height: 18px; color: #222222; }
        .curator-sidebar-buttons { display: flex; gap: 8px; }
        .curator-button-large {
            padding: 14px 16px;
            border-radius: 8px;
            border: 1px solid rgba(0,0,0,0.1);
            cursor: pointer;
            font-weight: 500;
        }

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
        .curator-table th { text-align: left; border-bottom: 2px solid #ddd; padding: 6px; }
        .curator-table td { border-bottom: 1px solid #eee; padding: 1px 6px; color: #222; }
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
            if (GM_getValue(STORAGE_VERSION_KEY, '') === 'v1') {
                console.log(`${LOG_PREFIX} Migrating storage from v1 to v2.`);

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
            console.log(`${LOG_PREFIX} Removed ID ${id} from storage.`);
        } else {
            if (Object.hasOwn(listings, id)) {
                listings[id].state = state;
                if (name) listings[id].name = name;
            } else {
                listings[id] = {state: state, name: name};
            }
            console.log(`${LOG_PREFIX} Set ID: "${id}", NAME: "${listings[id].name}" to ${state}.`);
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

    function applyGridVisuals(container, state, panel) {
        const buttons = panel.querySelectorAll('.curator-button');
        if (!buttons) return;

        if (state === STATE.HIDDEN) {
            container.style.display = 'none';
            container.style.backgroundColor = '';
            // Never mark the hide button active because it's invisible when 'active'.
            buttons[1].classList.remove('active');
            buttons[2].classList.remove('active');

        } else if (state === STATE.HIGHLIGHT_1) {
            container.style.display = '';
            container.style.backgroundColor = COLOURS.HIGHLIGHT_1;
            buttons[1].classList.add('active');
            buttons[2].classList.remove('active');

        } else if (state === STATE.HIGHLIGHT_2) {
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

    function applyListingPageVisuals(state, panel) {
        const buttons = panel.querySelectorAll('.curator-button-large');
        if (!buttons) return;
        for (const button of buttons) {
            button.style.border = '1px solid rgba(0,0,0,0.1)';
        }

        if (state === STATE.HIDDEN) buttons[0].style.border = '2px solid red';
        else if (state === STATE.HIGHLIGHT_1) buttons[1].style.border = '2px solid orange';
        else if (state === STATE.HIGHLIGHT_2) buttons[2].style.border = '2px solid green';
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
                applyGridVisuals(container, null, panel);
            } else {
                // Set New State
                if (targetState === STATE.HIDDEN && !confirm('Hide this listing?')) return;

                const metaName = container.querySelector('meta[itemprop="name"]');
                const name = metaName?.content ?? null;

                setSavedListing(listingId, targetState, name);
                applyGridVisuals(container, targetState, panel);
            }
        });
        return button;
    }


    // --- Main Logic ---
    function processGridListings() {
        // Use the listing url meta tags to find each listing
        const metaTags = document.querySelectorAll('meta[itemprop="url"]');
        if (!metaTags) return false;

        for (const metaTag of metaTags) {
            processGridListing(metaTag);
        }
    }

    function processGridListing(metaTag) {
        const content = metaTag.getAttribute('content');
        if (!content) return false;

        // Extract the ID from the URL
        const match = content.match(/rooms\/(\d+)/);
        if (!match) return false;
        const listingId = match[1];

        const container = getContainerElement(metaTag);
        if (!container) return false;

        const anchor = getButtonAnchorElement(container);
        if (!anchor) return false;

        let panel = anchor.querySelector('.curator-button-panel');

        // If the button panel doesn't exist, create one
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'curator-button-panel';

            const buttonHide = createButton('✕', 'curator-theme-hide', 'Hide Listing', STATE.HIDDEN, listingId, panel, container);
            const buttonH1 = createButton('?', 'curator-theme-h1', 'Maybe', STATE.HIGHLIGHT_1, listingId, panel, container);
            const buttonH2 = createButton('★', 'curator-theme-h2', 'Like', STATE.HIGHLIGHT_2, listingId, panel, container);

            panel.appendChild(buttonHide);
            panel.appendChild(buttonH1);
            panel.appendChild(buttonH2);

            // Allow clicks on the panel without triggering the listing card
            panel.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

            anchor.appendChild(panel);
        }

        // Apply the saved state or clear it
        applyGridVisuals(container, getSavedListingOrDefault(listingId).state, panel);
    }

    function processSingleListing() {
        // Get ID from URL
        const urlMatch = window.location.href.match(/rooms\/(\d+)/);
        if (!urlMatch) return false;
        const listingId = urlMatch[1];

        // Find Sidebar Anchor
        const sidebar = document.querySelector('div[data-section-id="BOOK_IT_SIDEBAR"]');
        if (!sidebar) return false;

        // Create the Panel if not already existing
        let panel = sidebar.querySelector(':scope > .curator-sidebar-panel');
        if (!panel) {
            // Update/add the name for this listing if already saved
            const metaName = document.querySelector('meta[property="og:description"]');
            const name = metaName?.content ?? null;

            const listing = getSavedListingOrDefault(listingId);
            if (listing.state && name && name !== listing.name) {
                setSavedListing(listingId, listing.state, name);
            }

            panel = document.createElement('div');
            panel.className = 'curator-sidebar-panel';

            const label = document.createElement('span');
            label.className = 'curator-sidebar-label';
            label.innerText = 'Curator Status:';

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'curator-sidebar-buttons';

            const createSingleButton = (text, color, targetState) => {
                const button = document.createElement('button');
                button.innerText = text;
                button.className = 'curator-button-large';
                button.style.backgroundColor = color;
                button.onclick = () => {
                    const currentSavedState = getSavedListingOrDefault(listingId).state;

                    if (currentSavedState === targetState) {
                        // Toggle OFF (return to neutral)
                        setSavedListing(listingId, null);
                        applyListingPageVisuals(null, panel);
                    } else {
                        // Set New State
                        if (targetState === STATE.HIDDEN && !confirm('Hide this listing?')) return;

                        setSavedListing(listingId, targetState, name);
                        applyListingPageVisuals(targetState, panel);
                    }
                };
                return button;
            };

            panel.appendChild(label);
            buttonContainer.appendChild(createSingleButton('Hide', COLOURS.HIDE, STATE.HIDDEN));
            buttonContainer.appendChild(createSingleButton('Maybe', COLOURS.HIGHLIGHT_1, STATE.HIGHLIGHT_1));
            buttonContainer.appendChild(createSingleButton('Like', COLOURS.HIGHLIGHT_2, STATE.HIGHLIGHT_2));
            panel.appendChild(buttonContainer);
            // Attempt to insert above the price in the sidebar
            sidebar.insertBefore(panel, sidebar.firstChild);

            // Re-create the panel when it's removed by the site loading process
            const sidebarObserver = new MutationObserver((mutationList, observer) => {
                for (const mutation of mutationList) {
                    for (const node of mutation.addedNodes) {
                        // If the added node contains the new sidebar then we can re-create the panel
                        if (node.querySelector('div[data-section-id="BOOK_IT_SIDEBAR"]')) {
                            observer.disconnect();
                            processSingleListing();
                        }
                    }
                }
            });
            sidebarObserver.observe(sidebar.parentElement, { childList: true });
        }

        // Update Visuals based on state
        const state = getSavedListingOrDefault(listingId).state;
        applyListingPageVisuals(state, panel);
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
                <td>${listing.name || id}</td>
                <td><a href="https://www.airbnb.com.au/rooms/${id}" target="_blank" class="curator-link">View Listing</a></td>
            `;

            const removeButton = document.createElement('button');
            removeButton.innerHTML = '&times;';
            removeButton.onclick = () => { setSavedListing(id, null); tr.remove(); processGridListings(); };
            const removeCell = document.createElement('td');
            removeCell.style.textAlign = 'right';
            removeCell.appendChild(removeButton);
            tr.appendChild(removeCell);

            if (listing.state === STATE.HIDDEN) {
                hiddenTbody.appendChild(tr);
            } else if (listing.state === STATE.HIGHLIGHT_1) {
                highlight1Tbody.appendChild(tr);
            } else if (listing.state === STATE.HIGHLIGHT_2) {
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
    GM_registerMenuCommand('Show Curator List', showDashboard);

    GM_registerMenuCommand('Clear ALL Data', () => {
        if (confirm('Reset everything? This will unhide all listings.')) {
            GM_setValue(STORAGE_LISTING_KEY, {});
            location.reload();
        }
    });

    // Set observers and intervals
    function findGrid() {
        const gridAncestor = document.querySelector('div#site-content');
        if (!gridAncestor) return null;

        const nodeIterator = document.createNodeIterator(gridAncestor, NodeFilter.SHOW_ELEMENT, (node) =>
            window.getComputedStyle(node).display === 'grid'
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
        );

        // Returns null if no valid next node
        return nodeIterator.nextNode()
    }

    function attachListingObserver(node) {
        if (node.childElementCount === 1) {
            // This is a related listings container in the grid
            const relatedsObserver = new MutationObserver((mutationList, _) => {
                for (const mutation of mutationList) {
                    for (const node of mutation.addedNodes) {
                        // Process any listings that are in the added node
                        for (const metaTag of node.querySelectorAll('meta[itemprop="url"]')) {
                            processGridListing(metaTag);
                        }
                    }
                }
            });
            relatedsObserver.observe(node.children[0], { childList: true, subtree: true });
        } else {
            // This is an actual listing node

            // Process the node initially if it already has been loaded before we got to it
            const metaTag = node.querySelector('meta[itemprop="url"]');
            if (metaTag) processGridListing(metaTag);

            const listingObserver = new MutationObserver((mutationList, _) => {
                for (const mutation of mutationList) {
                    for (const node of mutation.addedNodes) {
                        // If the added node contains the url meta tag then we can process it as a listing
                        const metaTag = node.querySelector('meta[itemprop="url"]');
                        if (metaTag) processGridListing(metaTag);
                    }
                }
            });
            // Watch the element that gets the useful parts of the listing added to it later
            listingObserver.observe(node.children[1], { childList: true });
        }
    }

    const gridObserver = new MutationObserver((mutationList, _) => {
        for (const mutation of mutationList) {
            for (const node of mutation.addedNodes) {
                attachListingObserver(node);
            }
        }
    });

    let oldGrid = null;

    function process(url) {
        if (url.includes('/homes')) {
            (function loopUntilTrue() {
                const grid = findGrid()
                if (!grid) {
                    setTimeout(loopUntilTrue, 200);
                } else {
                    // Still have the old grid so we don't need to re-process it
                    if (grid === oldGrid) return
                    oldGrid = grid;

                    // Process any existing listings in the grid
                    for (const listing of grid.children) {
                        attachListingObserver(listing);
                    }

                    // Watch for new nodes in the listings grid
                    gridObserver.disconnect();
                    gridObserver.observe(grid, { childList: true });
                }
            })();

        } else if (url.includes('/rooms/')) {
            // Run until page loads enough for the sidebar to exist, possible future changes are handled further down
            (function loopUntilTrue() {
                if (processSingleListing() === false) {
                    setTimeout(loopUntilTrue, 200);
                }
            })();
        }
    }

    // Run initially
    process(window.location.href);

    // First we try window.onurlchange as it's supported by Tampermonkey but it appears not by the other Greasemonkey-likes
    //  https://www.tampermonkey.net/documentation.php?locale=en#api:window.onurlchange
    if ('onurlchange' in window) {
        window.addEventListener('urlchange', (info) => {
            process(info.url);
        });
    } else if ('navigation' in window) {
        // If window.onurlchange not supported, try the Navigation API, though this is not supported by Firefox as of writing this in 2026
        //  https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigatesuccess_event
        window.navigation.addEventListener('navigatesuccess', (event) => {
            process(event.target.currentEntry.url);
        });
    } else {
        // Legacy fallback
        setInterval(() => {
            process(window.location.href);
        }, 2000);
    }

    // Also listen for storage changes so we can update any relevant ids immediately
    //  Should work with Tampermonkey and Violentmonkey, but not sure about others
    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener(STORAGE_LISTING_KEY, (key, oldValue, newValue, remote) => {
            if (remote) {
                console.log(`${LOG_PREFIX} Remote storage change detected`);

                if (window.location.href.includes('/homes')) {
                    processGridListings();
                } else if (window.location.href.includes('/rooms/')) {
                    processSingleListing();
                }
            }
        });
    } else {
        // Use setInterval to check occasionally for storage updates instead
        setInterval(() => {
            if (window.location.href.includes('/homes')) {
                processGridListings();
            } else if (window.location.href.includes('/rooms/')) {
                processSingleListing();
            }
        }, 2000);
    }
})();
