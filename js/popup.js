"use strict";
// Toolbar popup: opens a Google Maps search for the typed query.
// Also manages the "No Website" filter checkbox via chrome.storage.local.
(() => {
    function normalizeProfileId(value) {
        return value.trim().toLowerCase();
    }
    document.addEventListener("DOMContentLoaded", () => {
        const accountInfo = document.getElementById("accountinfo");
        if (accountInfo)
            accountInfo.textContent = "Local Mode";
        const searchBtn = document.getElementById("addprofilebtn");
        const input = document.getElementById("profileid");
        const noWebsiteCheckbox = document.getElementById("noWebsiteFilter");
        // Load saved filter state
        if (noWebsiteCheckbox) {
            chrome.storage.local.get("noWebsiteFilter", (storage) => {
                noWebsiteCheckbox.checked = Boolean(storage.noWebsiteFilter);
            });
            noWebsiteCheckbox.addEventListener("change", () => {
                chrome.storage.local.set({ noWebsiteFilter: noWebsiteCheckbox.checked });
            });
        }
        if (!searchBtn || !input)
            return;
        searchBtn.addEventListener("click", () => {
            const query = normalizeProfileId(input.value);
            if (!query)
                return;
            window.open("https://www.google.com/maps/search/" + encodeURIComponent(query));
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter")
                searchBtn.click();
        });
    });
})();
