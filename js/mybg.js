const CCTLDS = new Set((
    "ac ad ae af ag ai al am an ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo " +
    "br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm " +
    "do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr " +
    "gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km " +
    "kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp " +
    "mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl " +
    "pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st " +
    "su sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve " +
    "vg vi vn vu wf ws xk ye yt za zm zw"
).split(" "));

const BLACKLISTED_PATHS = new Set(
    "/reel /about /tr /privacy /download /pg /settings /vp /profiles".split(" ")
);

const SOCIAL_MEDIA_PLATFORMS = {
    instagram: /(((http|https):\/\/)?((www\.)?(?:instagram.com|instagr.am)\/([A-Za-z0-9_.]{2,30})))/ig,
    facebook: /(?:https?:)?\/\/(?:www\.)?(?:facebook|fb)\.com\/((?![A-z]+\.php)(?!marketplace|gaming|watch|me|messages|help|search|groups)[A-z0-9_\-\.]+)\/?/ig,
    youtube: /(?:https?:)?\/\/(?:[A-z]+\.)?youtube\.com\/(channel\/([A-z0-9-_]+)|user\/([A-z0-9]+))\/?/ig,
    linkedin: /(?:https?:)?\/\/(?:[\w]+\.)?linkedin\.com\/((company|school)\/[A-z0-9-À-ÿ\.]+|in\/[\w\-_À-ÿ%]+)\/?/ig,
    twitter: /(?:(?:http|https):\/\/)?(?:www.)?(?:twitter\.com|x\.com)\/(?!(oauth|account|tos|privacy|signup|home|hashtag|search|login|widgets|i|settings|start|share|intent|oct)(['"\?\.\/]|$))([A-Za-z0-9_]{1,15})/igm,
    email: /\b[A-Z0-9._%+-]{1,64}@(?!-)(?:[A-Z0-9-]+\.)+[A-Z]{2,63}\b/gi,
};

const CONTACT_PAGE_PATHS = (
    "/contact /contact-us /contact-me /about /about-me /about-us /team /our-team " +
    "/meet-the-team /support /customer-service /feedback /help /sales /return /location /faq"
).split(" ");

const EMAIL_BLACKLIST = new Set(
    ".png .jpg .jpeg .gif .webp wixpress.com sentry.io noreply abuse no-reply subscribe " +
    "mailer-daemon domain.com email.com yourname wix.com".split(" ")
);

const SOCIAL_MEDIA_DOMAINS = new Set(["instagram", "facebook", "youtube", "linkedin", "twitter"]);

const FETCH_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_FETCHES = 5;
const FETCH_DELAY_MS = 250;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

let activeFetches = 0;
const fetchQueue = [];

function acquireFetchSlot() {
    return new Promise((resolve) => {
        const tryAcquire = () => {
            if (activeFetches < MAX_CONCURRENT_FETCHES) {
                activeFetches += 1;
                resolve();
            } else {
                fetchQueue.push(tryAcquire);
            }
        };
        tryAcquire();
    });
}

function releaseFetchSlot() {
    activeFetches -= 1;
    const next = fetchQueue.shift();
    if (next) setTimeout(next, FETCH_DELAY_MS);
}

function timestamp() {
    return `[${new Date().toISOString()}]`;
}

function decodeCloudflareEmail(encoded) {
    let out = "";
    const key = parseInt(encoded.slice(0, 2), 16);
    for (let i = 2; encoded.length - i; i += 2) {
        const code = parseInt(encoded.slice(i, i + 2), 16) ^ key;
        out += String.fromCharCode(code);
    }
    return out;
}

function getDomain(url) {
    const parts = new URL(url).host.toLowerCase().split(".");
    if (parts.length >= 3 && CCTLDS.has(parts[parts.length - 1])) {
        return parts[parts.length - 3];
    }
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function normalizeSocialLink(raw) {
    try {
        let url = raw;
        if (url.startsWith("//")) url = "https:" + url;
        if (!url.startsWith("http")) url = "https://" + url;
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "") parsed.protocol = "https:";
        if (parsed.host === "instagram.com") parsed.host = "www.instagram.com";
        if (parsed.host === "facebook.com") parsed.host = "www.facebook.com";
        if (parsed.host === "yelp.com") parsed.host = "www.yelp.com";
        if (parsed.host === "www.twitter.com") parsed.host = "twitter.com";
        if (parsed.host === "www.x.com") parsed.host = "x.com";
        if (parsed.pathname.endsWith("/")) parsed.pathname = parsed.pathname.slice(0, -1);
        return BLACKLISTED_PATHS.has(parsed.pathname) ? "" : parsed.toString();
    } catch (err) {
        console.warn(timestamp(), "normalizeSocialLink error:", raw, err);
        return "";
    }
}

async function fetchUrlContent(url, timeoutMs = FETCH_TIMEOUT_MS) {
    await acquireFetchSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        console.log(timestamp(), "fetching:", url);
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": USER_AGENT },
        });
        if (!response.ok) {
            console.warn(timestamp(), `fetch ${url} status=${response.status}`);
            return "";
        }
        return await response.text();
    } catch (err) {
        const reason = err.name === "AbortError" ? "timeout" : err.message;
        console.warn(timestamp(), `fetch error ${url}:`, reason);
        return "";
    } finally {
        clearTimeout(timer);
        releaseFetchSlot();
    }
}

function emptyResultSet() {
    return {
        instagram: new Set(),
        facebook: new Set(),
        youtube: new Set(),
        linkedin: new Set(),
        twitter: new Set(),
        email: new Set(),
    };
}

async function extractFromUrl(url, _name, deepSearch) {
    try {
        let target = url;
        if (target.startsWith("//")) target = "https:" + target;
        if (!target.startsWith("http")) target = "https://" + target;

        const html = await fetchUrlContent(target);
        if (!html || typeof html !== "string" || html.length < 10) {
            return emptyResultSet();
        }

        const normalized = html.normalize("NFKC");
        const contactLinks = new Set();
        const matches = emptyResultSet();

        for (const platform in SOCIAL_MEDIA_PLATFORMS) {
            const hits = normalized.match(SOCIAL_MEDIA_PLATFORMS[platform]);
            if (!hits) continue;
            hits.forEach((hit) => {
                if (!hit) return;
                if (platform === "email") {
                    matches[platform].add(hit);
                } else {
                    const normalizedLink = normalizeSocialLink(hit);
                    if (normalizedLink) matches[platform].add(normalizedLink);
                }
            });
        }

        let pageUrl;
        try {
            pageUrl = new URL(target);
        } catch (err) {
            console.warn(timestamp(), "Invalid URL:", target, err);
            return matches;
        }

        const allLinks = [];
        try {
            const cfMatch = normalized.match(/data-cfemail="([a-f0-9]+)"/i);
            if (cfMatch && cfMatch[1]) matches.email.add(decodeCloudflareEmail(cfMatch[1]));

            const anchorRe = /<a[^>]+href=["']([^"']+)["']/gi;
            for (const m of normalized.matchAll(anchorRe)) {
                try {
                    if (m[1]) allLinks.push(new URL(m[1], pageUrl).toString());
                } catch {
                    /* skip malformed href */
                }
            }
        } catch (err) {
            console.warn(timestamp(), "Link extraction error:", target, err);
        }

        for (const link of allLinks) {
            try {
                const path = new URL(link).pathname.toLowerCase();
                if (CONTACT_PAGE_PATHS.some((p) => path.includes(p))) contactLinks.add(link);
            } catch {
                /* skip */
            }
        }

        for (const link of allLinks) {
            try {
                const host = new URL(link).host.toLowerCase();
                for (const platform of SOCIAL_MEDIA_DOMAINS) {
                    const isTwitter = platform === "twitter";
                    const matchesHost = isTwitter
                        ? ["twitter.com", "www.twitter.com", "x.com", "www.x.com"].includes(host) ||
                          host.endsWith(".twitter.com") || host.endsWith(".x.com")
                        : host === `${platform}.com` || host === `www.${platform}.com` || host.endsWith(`.${platform}.com`);
                    if (matchesHost) {
                        const normalizedLink = normalizeSocialLink(link);
                        if (normalizedLink) matches[platform].add(normalizedLink);
                        break;
                    }
                }
            } catch {
                /* skip */
            }
        }

        if (deepSearch && contactLinks.size > 0) {
            const contactList = [...contactLinks];
            for (let i = 0; i < contactList.length; i += 10) {
                const batch = contactList.slice(i, i + 10).map((link) => extractFromUrl(link, "", false));
                const results = await Promise.all(batch);
                results.forEach((res) => {
                    if (!res) return;
                    for (const key in res) {
                        if (res[key] && typeof res[key].forEach === "function") {
                            res[key].forEach((v) => matches[key].add(v));
                        }
                    }
                });
            }
        }

        const allEmails = new Set();
        const domainEmails = new Set();
        let businessDomain = null;
        try {
            businessDomain = getDomain(target);
        } catch (err) {
            console.warn(timestamp(), "getDomain error:", target, err);
        }

        matches.email.forEach((raw) => {
            const cleaned = raw.replace("u003e", "").toLowerCase();
            if (Array.from(EMAIL_BLACKLIST).some((bad) => cleaned.includes(bad))) return;
            allEmails.add(cleaned);
            if (businessDomain && cleaned.includes(businessDomain)) domainEmails.add(cleaned);
        });
        matches.email = domainEmails.size > 0 ? domainEmails : allEmails;
        return matches;
    } catch (err) {
        console.warn(timestamp(), `extractFromUrl error: ${url}`, err);
        return emptyResultSet();
    }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
        case "openPage":
            chrome.storage.local.set({ leads: msg.data }, () => {
                chrome.tabs.create({ url: "dashboard.html" });
            });
            return false;

        case "access":
            (async () => {
                const html = await fetchUrlContent(msg.data.url);
                sendResponse(html);
            })();
            return true;

        case "email":
            (async () => {
                const { website, name, deep_search } = msg.data;
                const result = await extractFromUrl(website, name, deep_search);
                const out = {};
                for (const key in result) out[key] = Array.from(result[key]);
                sendResponse(out);
            })();
            return true;

        default:
            return false;
    }
});
