// Content script: renders the in-page panel, auto-scrolls the results feed,
// and parses Google Maps /search payloads forwarded by injected.ts.
(() => {
    interface ExtractState {
        autoExtract: boolean;
        leads: Lead[];
        placeIds: Set<string>;
        collectEmail: boolean;
        noWebsiteFilter: boolean;
        clearEpoch: number;
    }

    const STATE: ExtractState = {
        autoExtract: false,
        leads: [],
        placeIds: new Set<string>(),
        collectEmail: true,
        noWebsiteFilter: false,
        clearEpoch: 0,
    };

    // Load filter flag from storage on startup and keep it synced.
    chrome.storage.local.get("noWebsiteFilter", (storage) => {
        STATE.noWebsiteFilter = Boolean(storage.noWebsiteFilter);
        console.log("[GMS] noWebsiteFilter:", STATE.noWebsiteFilter);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.noWebsiteFilter) {
            STATE.noWebsiteFilter = Boolean(changes.noWebsiteFilter.newValue);
            console.log("[GMS] noWebsiteFilter changed:", STATE.noWebsiteFilter);
        }
    });

    const UI_HOST_SELECTORS = [".w6VYqd", "[role='main']"];
    const END_OF_RESULTS_SELECTORS = [".HlvSq", "p.fontBodyMedium span"];
    const FEED_SELECTOR = "[role='feed']";
    const SEARCH_BTN_SELECTOR = "[role='search'] button";
    const MAX_STALL_ITERATIONS = 20;
    const PAGE_DELAY_MIN_MS = 1000;
    const PAGE_DELAY_MAX_MS = 3000;

    function delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function findFirst(selectors: string[]): Element | null {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function isEndOfResults(): boolean {
        for (const sel of END_OF_RESULTS_SELECTORS) {
            const el = document.querySelector(sel);
            if (el && /reached the end|no results/i.test(el.textContent || "")) return true;
        }
        return Boolean(document.querySelector(".HlvSq"));
    }

    function buildUI(): HTMLDivElement {
        const root = document.createElement("div");
        root.className = "extension_gms_page";

        const info = document.createElement("h1");
        info.id = "extension_gms_leads_info";
        info.textContent = "Leads: 0";

        const startBtn = document.createElement("button");
        startBtn.className = "extension_gms_button";
        startBtn.textContent = "Start Auto Extract";
        startBtn.id = "extension_gms_start_btn";

        const exportBtn = document.createElement("button");
        exportBtn.className = "extension_gms_button";
        exportBtn.textContent = "Export Leads (0)";
        exportBtn.id = "extension_gms_download_btn";
        exportBtn.style.backgroundColor = "#54aced";

        const clearBtn = document.createElement("button");
        clearBtn.className = "extension_gms_button";
        clearBtn.textContent = "Clear";
        clearBtn.id = "extension_gms_clear_btn";
        clearBtn.style.backgroundColor = "#4167b2";

        startBtn.addEventListener("click", () => runAutoExtract(startBtn));
        exportBtn.addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "openPage", data: STATE.leads });
            console.log("leads:", STATE.leads);
        });
        clearBtn.addEventListener("click", () => {
            STATE.clearEpoch++;
            STATE.leads = [];
            STATE.placeIds.clear();
            info.textContent = "Leads: 0";
            exportBtn.textContent = "Export Leads (0)";
        });

        root.appendChild(info);
        root.appendChild(startBtn);
        root.appendChild(exportBtn);
        root.appendChild(clearBtn);
        return root;
    }

    function mountUI(root: HTMLElement): void {
        let observer = new MutationObserver(() => {
            const host = findFirst(UI_HOST_SELECTORS);
            if (host && !host.contains(root)) {
                host.appendChild(root);
                console.log("[GMS] UI mounted into", host.className || host.tagName);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const host = findFirst(UI_HOST_SELECTORS);
        if (host && !host.contains(root)) {
            host.appendChild(root);
            observer.disconnect();
        }
    }

    async function runAutoExtract(btn: HTMLButtonElement): Promise<void> {
        if (STATE.autoExtract) {
            btn.textContent = "Start Auto Extract";
            btn.style.backgroundColor = "";
            STATE.autoExtract = false;
            console.log("[GMS] Stopped.");
            return;
        }

        btn.textContent = "Stop Auto Extract";
        btn.style.backgroundColor = "#ea4335";
        STATE.autoExtract = true;
        console.log("[GMS] Starting auto extract.");

        const searchBtn = document.querySelector<HTMLElement>(SEARCH_BTN_SELECTOR);
        if (searchBtn) {
            searchBtn.click();
            await delay(3000);
        } else {
            console.warn("[GMS] Search button not found; continuing.");
        }

        const feed = document.querySelector<HTMLElement>(FEED_SELECTOR);
        if (!feed) {
            console.error("[GMS] Feed list not found. Selector may be outdated.");
            btn.textContent = "Start Auto Extract";
            btn.style.backgroundColor = "";
            STATE.autoExtract = false;
            return;
        }

        let stallCount = 0;
        let lastHeight = -1;

        while (STATE.autoExtract) {
            feed.scrollTop = feed.scrollHeight;
            const wait = PAGE_DELAY_MIN_MS +
                Math.floor(Math.random() * (PAGE_DELAY_MAX_MS - PAGE_DELAY_MIN_MS));
            await delay(wait);

            if (isEndOfResults()) {
                console.log("[GMS] No more results.");
                break;
            }

            if (lastHeight === feed.scrollHeight) {
                stallCount += 1;
                if (stallCount >= MAX_STALL_ITERATIONS) {
                    console.log(`[GMS] Feed stalled ${MAX_STALL_ITERATIONS} iterations.`);
                    break;
                }
            } else {
                stallCount = 0;
                lastHeight = feed.scrollHeight;
            }
            console.log(`[GMS] stall=${stallCount} scrollTop=${feed.scrollTop} scrollHeight=${feed.scrollHeight}`);
        }

        btn.textContent = "Start Auto Extract";
        btn.style.backgroundColor = "";
        STATE.autoExtract = false;
        console.log("[GMS] Finished.");
    }

    function safeGet<T>(fn: () => T, fallback = ""): T | string {
        try {
            const value = fn();
            return value == null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function parseEntry(entry: any[]): Lead | null {
        const data = entry[entry.length - 1];
        const placeId = safeGet(() => data[11]);
        if (!placeId) return null;

        const lead: Lead = {
            name: placeId,
            phone: safeGet(() => data[178][0][0]),
            website: safeGet(() => data[7][0]),
            address: safeGet(() => (data[2] || []).join(",")),
            email: "",
            placeID: safeGet(() => data[78]),
            cID: safeGet(() => data[37][0][0][29][1]),
            category: safeGet(() => data[13].join(";")),
            reviewCount: safeGet(() => data[4][8]),
            averageRating: safeGet(() => data[4][7]),
            latitude: safeGet(() => data[9][2]),
            longitude: safeGet(() => data[9][3]),
        };

        try {
            const hours: any[] = data[203][0] || [];
            const sorted = hours
                .map((h) => ({ day: h[0], weekDay: h[1], hrs: (h[3] || []).map((x: any) => x[0]).join(", ") }))
                .sort((a, b) => a.weekDay - b.weekDay);
            for (const h of sorted) lead[`${h.weekDay}_${h.day}`] = h.hrs;
        } catch (err) {
            // hours block missing or shape changed; non-fatal
        }

        return lead;
    }

    async function enrichEmails(leads: Lead[]): Promise<Lead[]> {
        return Promise.all(leads.map(async (lead) => {
            if (!lead.website || !STATE.collectEmail) return lead;
            try {
                const response = await chrome.runtime.sendMessage({
                    action: "email",
                    data: { website: lead.website, name: lead.name, deep_search: true },
                });
                if (response) {
                    for (const key in response) {
                        lead[key] = Array.isArray(response[key]) ? response[key].join(", ") : response[key];
                    }
                }
            } catch (err) {
                console.warn("[GMS] enrich email failed:", lead.website, err);
            }
            return lead;
        }));
    }

    async function processSearchPayload(rawPayload: string): Promise<void> {
        let parsed: any;
        try {
            const cleaned = rawPayload.replace('/*""*/', "");
            const envelope = JSON.parse(cleaned);
            const inner = JSON.parse(envelope.d.slice(5));
            parsed = inner[64];
        } catch (err) {
            console.warn("[GMS] Failed to parse search payload:", err);
            return;
        }
        if (!Array.isArray(parsed)) {
            console.warn("[GMS] Feed index 64 not an array; Maps payload shape may have changed.");
            return;
        }

        const fresh: Lead[] = [];
        for (const entry of parsed) {
            try {
                const lead = parseEntry(entry);
                if (!lead) continue;
                const id = String(lead.placeID);
                if (STATE.placeIds.has(id)) continue;

                // "Only show businesses with NO website" filter:
                // skip leads that have a website when the filter is on.
                if (STATE.noWebsiteFilter && lead.website) continue;

                STATE.placeIds.add(id);
                fresh.push(lead);
            } catch (err) {
                console.warn("[GMS] Skip entry:", err);
            }
        }

        const epoch = STATE.clearEpoch;
        const enriched = await enrichEmails(fresh);
        if (epoch !== STATE.clearEpoch) return;

        // Mark empty websites for export display
        for (const lead of enriched) {
            if (!lead.website) lead.website = "NO WEBSITE";
        }

        STATE.leads.push(...enriched);

        const info = document.getElementById("extension_gms_leads_info");
        const exportBtn = document.getElementById("extension_gms_download_btn");
        if (info) info.textContent = `Leads: ${STATE.leads.length}`;
        if (exportBtn) exportBtn.textContent = `Export Leads (${STATE.leads.length})`;
    }

    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.type !== "search" || !event.data.data) return;
        if (typeof event.data.data !== "string") return;
        processSearchPayload(event.data.data);
    });

    mountUI(buildUI());
})();
