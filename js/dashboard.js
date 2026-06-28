"use strict";
// Dashboard: renders stored leads in Tabulator with header filters and
// CSV/XLSX/JSON export.
(() => {
    const PRIMARY_FIELDS = [
        "name", "phone", "email", "website", "address",
        "instagram", "facebook", "twitter", "linkedin", "yelp", "youtube",
        "placeID", "cID", "category", "reviewCount", "averageRating",
        "latitude", "longitude",
    ];
    function capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    function flattenObject(obj, prefix = "") {
        const out = {};
        for (const [key, val] of Object.entries(obj)) {
            const path = prefix ? `${prefix}_${key}` : key;
            if (val !== null && typeof val === "object" && !Array.isArray(val)) {
                Object.assign(out, flattenObject(val, path));
            }
            else {
                out[path] = Array.isArray(val) ? val.join(", ") : val;
            }
        }
        return out;
    }
    const table = new Tabulator("#example-table", {
        layout: "fitDataStretch",
        placeholder: "No leads stored. Scrape some on Google Maps first.",
        selectable: 1,
        pagination: "local",
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 250, 500],
        movableColumns: true,
    });
    function generateColumns(fieldSet) {
        const primary = new Set(PRIMARY_FIELDS);
        const columns = PRIMARY_FIELDS.map((field) => ({
            title: capitalizeFirstLetter(field),
            field,
            width: 240,
            resizable: true,
            headerFilter: "input",
        }));
        Array.from(fieldSet)
            .filter((f) => !primary.has(f))
            .sort()
            .forEach((field) => {
            columns.push({
                title: capitalizeFirstLetter(field),
                field,
                width: 240,
                resizable: true,
                headerFilter: "input",
            });
        });
        table.setColumns(columns);
    }
    function showData() {
        chrome.storage.local.get("leads", (storage) => {
            const leads = storage.leads || [];
            const fieldSet = new Set();
            const rows = leads.map((lead) => {
                // Ensure empty website values display as "NO WEBSITE" for
                // leads that were stored before the filter feature existed.
                if (!lead.website)
                    lead.website = "NO WEBSITE";
                const flat = flattenObject(lead);
                Object.keys(flat).forEach((k) => fieldSet.add(k));
                return flat;
            });
            generateColumns(fieldSet);
            table.setData(rows);
            const account = document.getElementById("accountinfo");
            if (account)
                account.textContent = `Local Mode — ${rows.length} leads`;
        });
    }
    function downloadJSON(rows) {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "results.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
    document.addEventListener("DOMContentLoaded", () => {
        showData();
        document.getElementById("download-csv").addEventListener("click", () => {
            table.download("csv", "results.csv");
        });
        document.getElementById("download-xlsx").addEventListener("click", () => {
            table.download("xlsx", "results.xlsx", { sheetName: "Leads" });
        });
        document.getElementById("download-json").addEventListener("click", () => {
            downloadJSON(table.getData("active"));
        });
        document.getElementById("clear-data").addEventListener("click", () => {
            if (!confirm("Delete all stored leads? Cannot be undone."))
                return;
            chrome.storage.local.remove("leads", () => {
                table.setData([]);
                const account = document.getElementById("accountinfo");
                if (account)
                    account.textContent = "Local Mode — 0 leads";
            });
        });
    });
})();
