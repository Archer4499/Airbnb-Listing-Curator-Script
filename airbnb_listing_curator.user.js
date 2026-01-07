// ==UserScript==
// @name         Airbnb Listing Curator (Hiding/Highlighting)
// @namespace    https://github.com/Archer4499
// @version      1.1
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
    const STORAGE_KEY = 'airbnb_listing_states';

    // Colours
    const COLOURS = {
        HIGHLIGHT_1: '#fffacd',
        HIGHLIGHT_2: '#ccffcc',
        NEUTRAL: ''
    };

    // Styles
    const style = document.createElement('style');
    style.textContent = `
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
        .curator-button-hide {
            background-color: #ffcccc; color: #cc0000;
            border-radius: 40px 0px 0px 40px;
        }
        .curator-button-h1   {
            background-color: #fffacd; color: #b8860b; /* Yellow */
            border-radius: 0px;
        }
        .curator-button-h2   {
            background-color: #ccffcc; color: #006400; /* Green */
            border-radius: 0px 40px 40px 0px;
            padding-bottom: 2px;
        }
        .curator-button.active {
            border: 1px solid #555;
            opacity: 1;
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);

    // Helpers
    function getListingStates() {
        return GM_getValue(STORAGE_KEY, {});
    }

    function setListingState(id, state) {
        const states = getListingStates();
        if (state === null) {
            delete states[id]; // Remove from storage if neutral
            console.log(`[Airbnb Listing Curator] Removed ID ${id} from storage.`);
        } else {
            states[id] = state;
            console.log(`[Airbnb Listing Curator] Set ID ${id} to ${state}.`);
        }
        GM_setValue(STORAGE_KEY, states);
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


    // --- Main Logic ---
    function processListings() {
        // Use the listing url meta tags to find each listing
        const metaTags = document.querySelectorAll('meta[itemprop="url"]');

        const savedStates = getListingStates();

        metaTags.forEach(meta => {
            const content = meta.getAttribute('content');
            if (!content) return;

            // Extract the ID from the URL
            const match = content.match(/(\d+)/);
            if (!match) return;
            const listingId = match[1];

            const container = getContainerElement(meta);
            if (!container) return;

            const anchor = getButtonAnchorElement(container);
            if (!anchor) return;

            var panel = anchor.querySelector('.curator-button-panel');

            // If the button panel doesn't exist, create one
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'curator-button-panel';

                // Button Creation Helper
                const createButton = (text, className, title, targetState) => {
                    const button = document.createElement('button');
                    button.innerText = text;
                    button.className = `curator-button ${className}`;
                    button.title = title;

                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const currentStoredState = getListingStates()[listingId];

                        if (currentStoredState === targetState) {
                            // Toggle OFF (return to neutral)
                            setListingState(listingId, null);
                            applyVisuals(container, null, panel);
                        } else {
                            // Set New State
                            // Safety check for Hide
                            if (targetState === 'HIDDEN' && !confirm('Hide this listing?')) return;

                            setListingState(listingId, targetState);
                            applyVisuals(container, targetState, panel);
                        }
                    });
                    return button;
                };

                const buttonHide = createButton('✕', 'curator-button-hide', 'Hide Listing', 'HIDDEN');
                const buttonH1 = createButton('?', 'curator-button-h1', 'Maybe', 'HIGHLIGHT_1');
                const buttonH2 = createButton('★', 'curator-button-h2', 'Like', 'HIGHLIGHT_2');
                // Heart Icon <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display: block;fill: rgba(0, 0, 0, 0.5);height: 16px;width: 16px;/* stroke: var(--palette-icon-primary-inverse); */stroke-width: 2;overflow: visible;padding-top: 2px;"><path d="m15.9998 28.6668c7.1667-4.8847 14.3334-10.8844 14.3334-18.1088 0-1.84951-.6993-3.69794-2.0988-5.10877-1.3996-1.4098-3.2332-2.11573-5.0679-2.11573-1.8336 0-3.6683.70593-5.0668 2.11573l-2.0999 2.11677-2.0988-2.11677c-1.3995-1.4098-3.2332-2.11573-5.06783-2.11573-1.83364 0-3.66831.70593-5.06683 2.11573-1.39955 1.41083-2.09984 3.25926-2.09984 5.10877 0 7.2244 7.16667 13.2241 14.3333 18.1088z"></path></svg>

                panel.appendChild(buttonHide);
                panel.appendChild(buttonH1);
                panel.appendChild(buttonH2);

                // Allow clicks on the panel without triggering the listing card
                panel.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

                anchor.appendChild(panel);
            }

            // Apply the saved state
            const savedState = savedStates[listingId];

            applyVisuals(container, savedState, panel);
        });
    }

    // Menu Commands
    GM_registerMenuCommand("Clear ALL Data", () => {
        if (confirm("Reset everything? This will unhide all listings.")) {
            GM_setValue(STORAGE_KEY, {});
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
