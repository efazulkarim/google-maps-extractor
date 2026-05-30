"use strict";
// Toolbar popup: opens a Google Maps search for the typed query.
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
