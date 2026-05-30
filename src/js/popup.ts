// Toolbar popup: opens a Google Maps search for the typed query.
(() => {
    function normalizeProfileId(value: string): string {
        return value.trim().toLowerCase();
    }

    document.addEventListener("DOMContentLoaded", () => {
        const accountInfo = document.getElementById("accountinfo");
        if (accountInfo) accountInfo.textContent = "Local Mode";

        const searchBtn = document.getElementById("addprofilebtn") as HTMLButtonElement | null;
        const input = document.getElementById("profileid") as HTMLInputElement | null;
        if (!searchBtn || !input) return;

        searchBtn.addEventListener("click", () => {
            const query = normalizeProfileId(input.value);
            if (!query) return;
            window.open("https://www.google.com/maps/search/" + encodeURIComponent(query));
        });

        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") searchBtn.click();
        });
    });
})();
