// Ambient types shared across the (non-module) extension scripts.
// No imports/exports here so these stay global under `module: "none"`.

interface Lead {
    name: string;
    phone: string;
    website: string;
    address: string;
    email: string;
    placeID: string;
    cID: string;
    category: string;
    reviewCount: string | number;
    averageRating: string | number;
    latitude: string | number;
    longitude: string | number;
    // dynamic columns (opening hours, scraped socials) are added at runtime
    [key: string]: string | number;
}

// injected.ts tags each XHR instance with the request URL/method.
interface XMLHttpRequest {
    _url?: string;
    _method?: string;
}

// Globals provided by vendored <script> libraries on the dashboard page.
declare const Tabulator: any;
declare const XLSX: any;
