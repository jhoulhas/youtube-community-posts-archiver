#!/usr/bin/env node
// =============================================================================
// YouTube Community Posts Archiver
// =============================================================================
//
// DISCLAIMER: This tool is mostly LLM-generated. It has
// not been formally tested. Use at your own risk and verify output as needed.
//
// =============================================================================


// version: 0.0.0.2 - 2026/02/25
"use strict";
const fs   = require("fs");
const path = require("path");

// =============================================================================
// CONFIG & CONSTANTS
// =============================================================================
const YT_CLIENT_VERSION = "2.20260220.01.00";
const YT_CLIENT_NAME    = "WEB";
const YT_CLIENT_NAME_ID = "1";
const YT_BROWSE_URL     = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";
const YT_POSTS_PARAMS   = "EgVwb3N0c_IGBAoCSgA%3D";
const YT_TIMEOUT_API_MS = 25_000;
const YT_TIMEOUT_IMG_MS = 30_000;
const YT_HEADERS = {
    "Content-Type":             "application/json",
    "User-Agent":               "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language":          "en-US,en;q=0.9",
    "Origin":                   "https://www.youtube.com",
    "Referer":                  "https://www.youtube.com/",
    "X-YouTube-Client-Name":    YT_CLIENT_NAME_ID,
    "X-YouTube-Client-Version": YT_CLIENT_VERSION,
};

// =============================================================================
// CLI ARGS
// =============================================================================
const argv = process.argv.slice(2);
function getFlag(flag, def = null) {
    const i = argv.indexOf(flag);
    if (i === -1) return def;
    const next = argv[i + 1];
    return (next !== undefined && !next.startsWith("--")) ? next : true;
}
function getPositionals() {
    const out = [];
    let i = 0;
    while (i < argv.length) {
        if (argv[i].startsWith("--")) {
            const next = argv[i + 1];
            i += (next !== undefined && !next.startsWith("--")) ? 2 : 1;
        } else {
            out.push(argv[i++]);
        }
    }
    return out;
}

const CHANNEL_ID = (getPositionals()[0] || "").trim();
const CFG = {
    singlePostId:  getFlag("--post"),
    singlePostUrl: getFlag("--post-url"),
    root:          getFlag("--root",         "./archive"),
    limit:         parseInt(getFlag("--limit", "250"), 10),
    saveCleanJson: !argv.includes("--no-clean-json"),
    saveRawJson:   !argv.includes("--no-raw-json"),
    saveMedia:     !argv.includes("--no-media") && !argv.includes("--skip-media"),
    singleFile:    argv.includes("--single-file"),
    singleRaw:     argv.includes("--single-raw"),
    delayPages:    parseInt(getFlag("--delay-pages",  "1000"), 10),
    delayDetail:   parseInt(getFlag("--delay-detail", "1000"), 10),
    delayMedia:    parseInt(getFlag("--delay-media",  "500"), 10),
    archiveFile:   getFlag("--archive-file", null),
    force:         argv.includes("--force"),
    verbose:       argv.includes("--verbose"),
};

if (!CHANNEL_ID || !CHANNEL_ID.startsWith("UC")) {
    process.stderr.write(
        "[ERR]  Channel ID is required as the first argument.\n" +
        "       It must start with UC  (e.g. UCJEER74X9kBenMT_x9iK9Mw).\n" +
        "       Usage: node yt-posts-archiver.js <channelId> [options]\n"
    );
    process.exit(1);
}

if (CFG.singlePostUrl && !CFG.singlePostId) {
    const m = CFG.singlePostUrl.match(/\/post\/([\w-]+)/);
    if (m) {
        CFG.singlePostId = m[1];
    } else {
        process.stderr.write(`[ERR]  Could not parse post ID from: ${CFG.singlePostUrl}\n`);
        process.exit(1);
    }
}

// =============================================================================
// LOGGING
// =============================================================================
const LOG_LEVELS = {
    info:  { prefix: "[INFO]", stream: process.stdout },
    warn:  { prefix: "[WARN]", stream: process.stdout },
    error: { prefix: "[ERR] ", stream: process.stderr },
    debug: { prefix: "[DBG] ", stream: process.stdout },
    nl:    { prefix: "",       stream: process.stdout },
};

function log(level, ...args) {
    const config = LOG_LEVELS[level] || LOG_LEVELS.info;
    if (level === "debug" && !CFG.verbose) return;
    const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const message = args.map(arg =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    if (level === "nl") {
        config.stream.write("\n");
    } else {
        config.stream.write(`[${timestamp}] ${config.prefix} ${message}\n`);
    }
}

// =============================================================================
// ARCHIVE LEDGER
// =============================================================================
let ARCHIVE_FILE  = CFG.archiveFile;
const archivedIds = new Set();

function getLedgerFile(root) {
    return path.join(root, "youtube", ".archive");
}

function initArchive(root) {
    const ledgerDir = path.join(root, "youtube");
    ensureDirSync(ledgerDir);
    if (!ARCHIVE_FILE) ARCHIVE_FILE = getLedgerFile(root);
    try {
        if (fs.existsSync(ARCHIVE_FILE)) {
            for (const line of fs.readFileSync(ARCHIVE_FILE, "utf8").split("\n")) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const [chId, postId] = parts;
                    archivedIds.add(`${chId}:${postId}`);
                }
            }
        }
    } catch { /* first run */ }
    log("debug", `Archive: ${archivedIds.size} existing entries at ${ARCHIVE_FILE}`);
}

function markSaved(channelId, postId) {
    const key = `${channelId}:${postId}`;
    if (archivedIds.has(key)) return;
    archivedIds.add(key);
    try {
        fs.appendFileSync(ARCHIVE_FILE, `${channelId} ${postId}\n`);
    } catch (e) {
        log("error", `Could not update archive ledger: ${e.message}`);
    }
}

function isArchived(channelId, postId) {
    return !CFG.force && archivedIds.has(`${channelId}:${postId}`);
}

// =============================================================================
// PROTOBUF ENCODER
// =============================================================================
function encodeVarint(n) {
    const out = [];
    while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
    out.push(n & 0x7f);
    return out;
}
function encodeField(fieldNum, str) {
    const bytes = [...Buffer.from(str, "utf8")];
    return [...encodeVarint((fieldNum << 3) | 2), ...encodeVarint(bytes.length), ...bytes];
}
function buildParams(postId) {
    const inner = [
        ...encodeField(2,  CHANNEL_ID),
        ...encodeField(3,  postId),
        ...encodeField(11, CHANNEL_ID),
    ];
    const outer = [...encodeVarint((56 << 3) | 2), ...encodeVarint(inner.length), ...inner];
    return Buffer.from(outer)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// =============================================================================
// NETWORK
// =============================================================================
function buildContext(postId = null) {
    const ctx = {
        client: {
            hl: "en", gl: "US",
            visitorData: "",
            clientName:        YT_CLIENT_NAME,
            clientVersion:     YT_CLIENT_VERSION,
            platform:          "DESKTOP",
            clientFormFactor:  "UNKNOWN_FORM_FACTOR",
            userInterfaceTheme:"USER_INTERFACE_THEME_DARK",
            timeZone:          Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
    };
    if (postId) {
        ctx.client.mainAppWebInfo = {
            graftUrl:                `/post/${postId}`,
            webDisplayMode:          "WEB_DISPLAY_MODE_BROWSER",
            isWebNativeShareAvailable: false,
        };
    }
    return ctx;
}

async function ytPost(body) {
    const payload = JSON.stringify(body);
    log("debug", `POST ${YT_BROWSE_URL} (${payload.length} bytes)`);
    const res = await fetch(YT_BROWSE_URL, {
        method:  "POST",
        headers: YT_HEADERS,
        body:    payload,
        signal:  AbortSignal.timeout(YT_TIMEOUT_API_MS),
    });
    log("debug", `Response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (json?.error) throw new Error(`YT API: ${json.error.message}`);
    return json;
}

function ytOriginal(rawUrl) {
    if (!rawUrl) return null;
    const u = rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl;
    return u.replace(/=(s|w|h)\d+[^"'\s]*$/, "=s0");
}

function getExtFromMimeType(mimeType) {
    if (!mimeType) return "bin";
    const match = mimeType.match(/^image\/(\w+)(?:\+.*)?$/i);
    if (match) return match[1].toLowerCase();
    return "bin";
}

async function downloadBinary(rawUrl) {
    const cleanUrl = ytOriginal(rawUrl);
    log("debug", `Downloading: ${cleanUrl}`);
    const res = await fetch(cleanUrl, {
        headers: { "User-Agent": YT_HEADERS["User-Agent"], "Referer": "https://www.youtube.com/" },
        signal:  AbortSignal.timeout(YT_TIMEOUT_IMG_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${cleanUrl.slice(0, 80)}`);
    const contentType = res.headers.get("content-type");
    const ext = getExtFromMimeType(contentType);
    const buffer = Buffer.from(await res.arrayBuffer());
    log("debug", `Downloaded ${(buffer.length / 1024).toFixed(1)} KB (${contentType || "unknown"})`);
    return { buffer, ext };
}

// =============================================================================
// POST PARSING
// =============================================================================
function parseImages(att) {
    const imgs = [];
    if (!att) return imgs;
    const single = att.backstageImageRenderer;
    if (single) {
        const thumbs = single.image?.thumbnails || [];
        const best = thumbs.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a), thumbs[0] || {});
        if (best?.url) imgs.push(ytOriginal(best.url));
    }
    for (const img of (att.postMultiImageRenderer?.images || [])) {
        const thumbs = img.backstageImageRenderer?.image?.thumbnails || [];
        const best = thumbs.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a), thumbs[0] || {});
        if (best?.url) imgs.push(ytOriginal(best.url));
    }
    return imgs;
}

function parsePostRenderer(r) {
    if (!r?.postId) return null;
    const att    = r.backstageAttachment;
    const text   = (r.contentText?.runs || []).map(x => x.text || "").join("") || null;
    const navUrl = r.publishedTimeText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
    const canonicalBase = r.authorEndpoint?.browseEndpoint?.canonicalBaseUrl || null;
    const video = att?.videoRenderer ? {
        videoId: att.videoRenderer.videoId,
        title:   (att.videoRenderer.title?.runs || []).map(x => x.text).join("") || null,
        channel: att.videoRenderer.ownerText?.runs?.[0]?.text || null,
        url:     `https://www.youtube.com/watch?v=${att.videoRenderer.videoId}`,
    } : null;
    const poll = att?.pollRenderer ? {
        totalVotes: att.pollRenderer.totalVotes?.simpleText || null,
        choices:    (att.pollRenderer.choices || []).map(c => ({
            text:      (c.text?.runs || []).map(x => x.text).join("") || null,
            voteRatio: c.voteRatioIfSelected || null,
        })),
    } : null;
    return {
        postId:        r.postId,
        text:          text,
        authorText:    r.authorText?.runs?.[0]?.text || null,
        authorHandle:  canonicalBase ? canonicalBase.replace(/^\/?@/, "").trim() : null,
        authorId:      r.authorEndpoint?.browseEndpoint?.browseId || null,
        publishedText: r.publishedTimeText?.runs?.[0]?.text || r.publishedTimeText?.simpleText || null,
        publishDate:   null,
        likeCount:     r.voteCount?.simpleText || null,
        images:        parseImages(att),
        video,
        poll,
        postUrl:       navUrl
            ? `https://www.youtube.com${navUrl}`
            : `https://www.youtube.com/post/${r.postId}`,
        microformat:   null,
        channelTitle:  null,
        channelHandle: null,
        _raw:          r,
        _detailResp:   null,
        _detailError:  null,
    };
}

function mergeDetail(post, resp) {
    if (!resp) return;
    post._detailResp = resp;
    const mf = resp?.microformat?.microformatDataRenderer;
    if (mf) {
        post.publishDate = mf.publishDate
            || mf.postDetails?.discussionForumPosting?.datePublished
            || null;
        post.microformat = mf;
    }
    const meta = resp?.metadata?.channelMetadataRenderer;
    if (meta) {
        if (!post.channelTitle) {
            post.channelTitle = (typeof meta.title === "string" && meta.title.trim()) || null;
        }

        if (!post.channelHandle) {
            // Source 1: microformat author URL (e.g. "https://www.youtube.com/@S1EOL2A")
            const mfAuthorUrl = resp?.microformat?.microformatDataRenderer
                ?.postDetails?.discussionForumPosting?.author?.url || null;
            const fromMicroformat = mfAuthorUrl
                ? (mfAuthorUrl.match(/\/@?([^/?#]+)$/)?.[1] || null)
                : null;

            // Source 2: canonicalBaseUrl already parsed into post.authorHandle
            const fromCanonical = post.authorHandle || null;

            // Source 3: vanityUrl from channel metadata (e.g. "/@S1EOL2A")
            const fromVanity = meta.vanityUrl
                ? meta.vanityUrl.replace(/^\/?@/, "").trim() || null
                : null;

            post.channelHandle = fromMicroformat || fromCanonical || fromVanity || null;
            log("debug", `  channelHandle resolved: mf=${fromMicroformat} canonical=${fromCanonical} vanity=${fromVanity} -> ${post.channelHandle}`);
        }
    }
}

function extractPostFromDetailResp(resp) {
    const tabs = resp?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    for (const tab of tabs) {
        for (const section of tab.tabRenderer?.content?.sectionListRenderer?.contents || []) {
            for (const item of section.itemSectionRenderer?.contents || []) {
                const bptr = item.backstagePostThreadRenderer;
                if (bptr?.post?.backstagePostRenderer) {
                    const post = parsePostRenderer(bptr.post.backstagePostRenderer);
                    if (post) { mergeDetail(post, resp); return post; }
                }
            }
        }
    }
    return null;
}

// =============================================================================
// DEEP OMIT
// =============================================================================
const OMIT_KEYS = new Set([
    "trackingParams", "clickTrackingParams", "loggingDirectives",
    "accessibility", "accessibilityData", "serviceTrackingParams",
    "mainAppWebResponseContext", "webResponseContextExtensionData",
    "availableCountries", "androidPackage", "iosAppStoreId",
    "iosAppArguments", "urlApplinksWeb", "urlApplinksIos",
    "urlApplinksAndroid", "urlTwitterIos", "urlTwitterAndroid",
    "twitterCardType", "twitterSiteHandle", "schemaDotOrgType",
    "linkAlternates", "ogType",
]);

function deepOmit(obj, keys) {
    if (Array.isArray(obj)) return obj.map(v => deepOmit(v, keys));
    if (obj && typeof obj === "object") {
        const out = {};
        for (const [k, v] of Object.entries(obj))
            if (!keys.has(k)) out[k] = deepOmit(v, keys);
        return out;
    }
    return obj;
}

// =============================================================================
// BROWSE
// =============================================================================
function extractPostsFromSectionList(contents) {
    const posts = [];
    for (const section of contents) {
        if (section.backstagePostThreadRenderer) {
            const p = parsePostRenderer(section.backstagePostThreadRenderer.post?.backstagePostRenderer);
            if (p) posts.push(p);
            continue;
        }
        for (const item of (section.itemSectionRenderer?.contents || [])) {
            if (item.backstagePostThreadRenderer) {
                const p = parsePostRenderer(item.backstagePostThreadRenderer.post?.backstagePostRenderer);
                if (p) posts.push(p);
            }
        }
    }
    return posts;
}

function findToken(items) {
    for (const item of items) {
        const t = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (t) return t;
        for (const sub of (item?.itemSectionRenderer?.contents || [])) {
            const t2 = sub?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
            if (t2) return t2;
        }
    }
    return null;
}

async function fetchInitialPosts() {
    log("info", `Getting initial landing page ${CHANNEL_ID}/posts`);
    const resp = await ytPost({
        context:  buildContext(),
        browseId: CHANNEL_ID,
        params:   YT_POSTS_PARAMS,
    });
    const meta          = resp?.metadata?.channelMetadataRenderer;
    const channelTitle  = (meta && typeof meta.title === "string" && meta.title.trim()) || null;
    const channelHandle = (meta && typeof meta.vanityUrl === "string")
        ? meta.vanityUrl.replace(/^\/?@/, "").trim() || null
        : null;
    const tabs = resp?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    for (const tab of tabs) {
        const tr = tab.tabRenderer;
        if (!tr?.selected) continue;
        const tabTitle = (tr.title || "").toLowerCase();
        if (tabTitle !== "community" && tabTitle !== "posts") continue;
        const contents = tr.content?.sectionListRenderer?.contents || [];
        return {
            posts: extractPostsFromSectionList(contents),
            token: findToken(contents),
            channelTitle,
            channelHandle,
        };
    }
    return { posts: [], token: null, channelTitle, channelHandle };
}

async function fetchContinuation(token) {
    log("info", `Fetching next page using token: ...${token.slice(-10)})`);
    const resp = await ytPost({ context: buildContext(), continuation: token });
    for (const action of (resp?.onResponseReceivedEndpoints || [])) {
        const items =
            action?.appendContinuationItemsAction?.continuationItems ||
            action?.reloadContinuationItemsCommand?.continuationItems;
        if (items) {
            const posts = items
                .filter(i => i.backstagePostThreadRenderer)
                .map(i => parsePostRenderer(i.backstagePostThreadRenderer.post?.backstagePostRenderer))
                .filter(Boolean);
            return { posts, token: findToken(items) };
        }
    }
    return { posts: [], token: null };
}

async function fetchPostDetail(postId) {
    log("debug", `FEpost_detail: ${postId}`);
    return ytPost({
        context:  buildContext(postId),
        browseId: "FEpost_detail",
        params:   buildParams(postId),
    });
}

// =============================================================================
// FILE HELPERS
// =============================================================================
function getDateStr(post) {
    if (post.publishDate) {
        try { return new Date(post.publishDate).toISOString().slice(0, 10); } catch {}
    }
    return null;
}

function urlLastPathname(rawUrl) {
    if (!rawUrl) return "img";
    try {
        const parts = new URL(rawUrl).pathname.split("/").filter(Boolean);
        return (parts[parts.length - 1] || "img")
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 40) || "img";
    } catch { return "img"; }
}

function buildFolderName(channelTitle) {
    if (!channelTitle) return CHANNEL_ID;
    const safe = channelTitle
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.\s]+$/, "");
    return safe ? `${CHANNEL_ID} ${safe}` : CHANNEL_ID;
}

function ensureDirSync(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonSync(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// =============================================================================
// SINGLE-FILE ACCUMULATORS
// =============================================================================
const singleFileAccum = new Map();
const singleRawAccum  = new Map();

function flushSingleFiles(channelDir) {
    if (CFG.singleFile && singleFileAccum.size > 0) {
        const p = path.join(channelDir, "posts.json");
        let existing = {};
        try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
        for (const [id, rec] of singleFileAccum) existing[id] = rec;
        writeJsonSync(p, existing);
        log("info", `  Merged ${singleFileAccum.size} records into posts.json`);
    }
    if (CFG.singleRaw && singleRawAccum.size > 0) {
        const p = path.join(channelDir, "posts_raw.json");
        let existing = {};
        try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
        for (const [id, rec] of singleRawAccum) existing[id] = rec;
        writeJsonSync(p, existing);
        log("info", `  Merged ${singleRawAccum.size} records into posts_raw.json`);
    }
}

// =============================================================================
// SAVE POST
// =============================================================================
function buildCleanRecord(post, channelTitle, channelHandle) {
    return {
        postId:        post.postId        || null,
        channelId:     CHANNEL_ID         || null,
        channelTitle:  channelTitle       || null,
        channelHandle: channelHandle      ? `@${channelHandle}` : null,
        postUrl:       post.postUrl       || null,
        publishDate:   post.publishDate   || null,
        publishedText: post.publishedText || null,
        savedAt:       new Date().toISOString(),
        text:          post.text          || null,
        likeCount:     post.likeCount     || null,
        author: {
            name:   post.authorText   || null,
            handle: post.authorHandle ? `@${post.authorHandle}` : null,
            id:     post.authorId     || null,
        },
        images:      post.images      || [],
        video:       post.video       || null,
        poll:        post.poll        || null,
        microformat: post.microformat ? deepOmit(post.microformat, OMIT_KEYS) : null,
        detailError: post._detailError || null,
    };
}

async function savePost(post, baseRoot, channelTitle, channelHandle) {
    // 1. Validate Date
    const dateStr = getDateStr(post);
    if (!dateStr) {
        log("warn", `  [${post.postId}] SKIP: no verified publishDate (Check microformat in response)`);
        return false;
    }

    // 2. Build Paths (Using Title from Detail Response)
    const folderName = buildFolderName(channelTitle);
    const channelDir = path.join(baseRoot, "youtube", folderName);
    const base    = `${dateStr}__${post.postId}`;
    const postDir = path.join(channelDir, "posts", dateStr);

    ensureDirSync(channelDir);
    ensureDirSync(postDir);

    const cleanRecord = buildCleanRecord(post, channelTitle, channelHandle);

    if (CFG.saveCleanJson) {
        const p = path.join(postDir, `${base}__metadata.json`);
        writeJsonSync(p, cleanRecord);
        log("info", `      + ${path.relative(baseRoot, p)}`);
    }
    if (CFG.saveRawJson) {
        const p = path.join(postDir, `${base}__raw.json`);
        writeJsonSync(p, {
            _savedAt:    new Date().toISOString(),
            _post:       post._raw,
            _detailResp: post._detailResp,
            _error:      post._detailError,
        });
        log("info", `      + ${path.relative(baseRoot, p)}`);
    }
    if (CFG.singleFile) singleFileAccum.set(post.postId, cleanRecord);
    if (CFG.singleRaw)  singleRawAccum.set(post.postId, {
        _savedAt:    new Date().toISOString(),
        _post:       post._raw,
        _detailResp: post._detailResp,
        _error:      post._detailError,
    });

    if (CFG.saveMedia && post.images?.length) {
        for (let i = 0; i < post.images.length; i++) {
            const imgUrl = post.images[i];
            const fname  = `${base}__${urlLastPathname(imgUrl)}`;
            const fpath  = path.join(postDir, `${fname}.bin`);
            if (fs.existsSync(fpath) && !CFG.force) {
                log("debug", `      ~ media exists, skipping: ${fname}`);
                continue;
            }
            await sleep(CFG.delayMedia);
            try {
                const { buffer, ext } = await downloadBinary(imgUrl);
                const finalPath = path.join(postDir, `${fname}.${ext}`);
                fs.writeFileSync(finalPath, buffer);
                log("info", `      + ${path.relative(baseRoot, finalPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
            } catch (e) {
                log("error", `      media [${i + 1}/${post.images.length}] failed: ${e.message}`);
                log("debug", `      URL: ${imgUrl}`);
            }
        }
    }
    if (post.video) {
        log("info", `      ~ !!! video attachment (not downloaded): ${post.video.url}`);
    }
    return true;
}

// =============================================================================
// HELPERS
// =============================================================================
function sleep(baseMs) {
    const delta = baseMs * 0.3;
    const ms    = baseMs - delta + Math.random() * delta * 2;
    return new Promise(r => setTimeout(r, Math.round(ms)));
}

function printSummary(stats, channelDir) {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    log("nl");
    log("info", "  SUMMARY: ");
    log("info", "  " + "━".repeat(56));
    log("info", `  Collected : ${stats.collected}`);
    log("info", `  Saved     : ${stats.saved}`);
    log("info", `  Skipped   : ${stats.skipped}  (already in archive)`);
    log("info", `  Failed    : ${stats.failed}  (Error at Phase 2)`);
    log("info", `  Time      : ${elapsed}s`);
    log("info", `  Ledger    : ${ARCHIVE_FILE}`);
    log("info", `  Output    : ${path.resolve(channelDir)}`);
}

// =============================================================================
// FLOWS
// =============================================================================
async function runSinglePost(baseRoot) {
    const postId = CFG.singlePostId;
    log("info", `Fetching post detail...`);

    let post = null;
    let detailError = null;
    let channelTitle = null;
    let channelHandle = null;

    try {
        const resp = await fetchPostDetail(postId);
        post = extractPostFromDetailResp(resp);

        if (!post) throw new Error("Could not parse post from detail response.");

        channelTitle  = post.channelTitle  || null;
        channelHandle = post.channelHandle || null;
    } catch (e) {
        detailError = e.message;
        log("error", `  Post detail fetch failed: ${e.message}`);
        post = {
            postId:        postId,
            publishDate:   null,
            publishedText: null,
            text:          null,
            images:        [],
            _detailError:  detailError,
            _raw:          null,
            _detailResp:   null,
        };
    }

    log("nl");
    log("info", `  Post  : ${postId}`);
    log("info", `  Channel: ${channelTitle || "Unknown"}`);
    log("info", `  Date  : ${post.publishDate || post.publishedText || "unknown"}`);
    log("info", `  Images: ${post.images?.length || 0}`);
    if (detailError) log("info", `  Error : ${detailError}`);
    log("nl");

    log("info", `Saving files (creating folders now)...`);
    const saved = await savePost(post, baseRoot, channelTitle, channelHandle);

    if (saved) {
        flushSingleFiles(path.join(baseRoot, "youtube", buildFolderName(channelTitle)));
        markSaved(CHANNEL_ID, postId);
        log("nl");
        log("info", `Done.`);
    } else {
        log("nl");
        log("warn", `(post skipped - no verified date - check microformat in response).`);
    }
}

async function runBulk(baseRoot, channelTitle, channelHandle, firstPage, firstToken) {
    const stats = { startTime: Date.now(), collected: 0, saved: 0, skipped: 0, failed: 0 };

    // -------------------------------------------------------------------------
    // PHASE 1: Collect post IDs via pagination
    // -------------------------------------------------------------------------
    log("info", `Phase 1 of 3  --  Collecting posts`);
    log("info", `  Limit: ${CFG.limit}  |  Base page delay: ~${CFG.delayPages}ms (±30%)`);

    const allPosts = [...firstPage];
    log("info", `  Page 1: ${firstPage.length} posts`);
    let token = firstToken;
    let page  = 2;

    if (!token) {
        log("info", `  No token for next pages.`);
    }

    while (token && allPosts.length < CFG.limit) {
        await sleep(CFG.delayPages);

        try {
            const result = await fetchContinuation(token);
            allPosts.push(...result.posts);
            token = result.token;
            log("info", `  Page ${page}: ${result.posts.length} posts  (total: ${allPosts.length})`);
            page++;
            if (!token)                    { log("info", `  No more pages.`); break; }
            if (result.posts.length === 0) { log("warn", `  Empty page, stopping.`); break; }
        } catch (e) {
            log("error", `  Page ${page} failed: ${e.message}`);
            break;
        }
    }
    if (allPosts.length >= CFG.limit) log("info", `  Reached limit of ${CFG.limit}.`);

    const seen   = new Set();
    const unique = allPosts
        .filter(p => { if (seen.has(p.postId)) return false; seen.add(p.postId); return true; })
        .slice(0, CFG.limit);
    stats.collected = unique.length;

    log("nl");
    log("info", `  ${unique.length} unique posts collected.`);

    // -------------------------------------------------------------------------
    // PHASE 2: Archive Check -> Fetch Detail
    // -------------------------------------------------------------------------
    log("nl");
    log("info", `Phase 2 of 3  --  Archive Check -> Fetch Details`);

    for (let i = 0; i < unique.length; i++) {
        const post = unique[i];

        if (isArchived(CHANNEL_ID, post.postId)) {
            log("info", `  [${i + 1}/${unique.length}] ${post.postId}  already archived -- skipping fetch`);
            post._skipReason = "already archived";
            stats.skipped++;
            continue;
        }

        if (post.publishDate) {
            log("debug", `  [${i + 1}/${unique.length}] ${post.postId}  date already known, skipping detail`);
        } else {
            await sleep(CFG.delayDetail);
            try {
                const detailResp = await fetchPostDetail(post.postId);
                mergeDetail(post, detailResp);
                if (!post.publishDate) {
                    post._detailError = `No publishDate in detail response`;
                    stats.failed++;
                    log("warn", `  [${i + 1}/${unique.length}] ${post.postId}  no publishDate found -- will skip`);
                } else {
                    log("debug", `  [${i + 1}/${unique.length}] ${post.postId}  ->  ${post.publishDate}`);
                }
            } catch (e) {
                post._detailError = e.message;
                stats.failed++;
                log("error", `  [${i + 1}/${unique.length}] ${post.postId}  detail failed: ${e.message} -- will skip`);
            }
        }

        if ((i + 1) % 10 === 0 || i === unique.length - 1)
            log("info", `  Progress: ${i + 1} / ${unique.length}`);
    }

    // -------------------------------------------------------------------------
    // PHASE 3: Save to disk
    // -------------------------------------------------------------------------
    log("nl");
    log("info", `Phase 3 of 3  --  Saving to disk`);

    for (let i = 0; i < unique.length; i++) {
        const post = unique[i];
        if (post._skipReason === "already archived") {
            log("info", `  [${i + 1}/${unique.length}] ${post.postId}  already archived -- skipping save`);
            continue;
        }
        if (post._detailError && !post.publishDate) continue;

        const dateDisplay = post.publishDate || post.publishedText || "no date";

        log("info", `  [${post.postId}]  ${dateDisplay}`);

        const resolvedHandle = post.channelHandle || channelHandle;
        const resolvedTitle  = post.channelTitle  || channelTitle;

        try {
            const saved = await savePost(post, baseRoot, resolvedTitle, resolvedHandle);
            if (saved) {
                markSaved(CHANNEL_ID, post.postId);
                stats.saved++;
            } else {
                stats.failed++;
            }
        } catch (e) {
            log("error", `  Save failed for ${post.postId}: ${e.message}`);
            stats.failed++;
        }
        log("nl");
    }

    const folderName = buildFolderName(channelTitle);
    const channelDir = path.join(baseRoot, "youtube", folderName);
    flushSingleFiles(channelDir);
    printSummary(stats, channelDir);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
    let channelTitle  = null;
    let channelHandle = null;
    let firstPage     = null;
    let firstToken    = null;

    initArchive(CFG.root);

    if (CFG.singlePostId) {
        if (isArchived(CHANNEL_ID, CFG.singlePostId)) {
            log("warn", `Post ${CFG.singlePostId} is already in the archive. Use --force to redownload.`);
            return;
        }
    } else {
        log("info", `Connecting to YouTube...`);
        const result  = await fetchInitialPosts();
        channelTitle  = result.channelTitle;
        channelHandle  = result.channelHandle;
        firstPage     = result.posts;
        firstToken    = result.token;
    }

    log("nl");
    log("info", "  " + "━".repeat(56));
    log("info", `    YouTube Community Posts Archiver`);
    log("info", "  " + "━".repeat(56));
    log("info", `  Channel ID    : ${CHANNEL_ID}`);
    log("info", `  Mode          : ${CFG.singlePostId ? "single post" : "bulk"}`);
    log("info", `  Archive       : ${ARCHIVE_FILE}  (${archivedIds.size} entries)`);
    if (CFG.force)     log("info", `  Force         : yes -- ignoring archive`);
    log("info", "  " + "━".repeat(56));
    log("nl");

    if (CFG.singlePostId) {
        await runSinglePost(CFG.root);
    } else {
        await runBulk(CFG.root, channelTitle, channelHandle, firstPage, firstToken);
    }
}

main().catch(e => {
    log("error", `Fatal: ${e.message}`);
    if (CFG.verbose) process.stderr.write(e.stack + "\n");
    process.exit(1);
});
