# YouTube Community Posts Archiver

> [!CAUTION]
> **Warning**: Full on slop ahead. This tool and readme is mostly LLM-generated and has not been intensively tested. Use at your own risk and verify output as needed.

> If you are an actual dev, please remake this. I'm too dumb. Free us from this slop. The endpoints is listed at the end.

---
Node.js script to archive YouTube Community posts via YouTube's internal `youtubei/v1/browse` API.

---
### License
The Unlicense


---
## Requirements

1. NodeJS
2. This script: [yt-ar.js](https://github.com/jhoulhas/youtube-community-posts-archiver/raw/refs/heads/main/yt-ar.js)

---

## Usage

```bash
# Bulk archive all posts from a channel by using <channelId>
node yt-ar.js UCJEER74X9kBenMT_x9iK9Mw

# Archive single post by <postId>
node yt-ar.js UCJEER74X9kBenMT_x9iK9Mw --post Ugkx9qQpbiK1HN2NC6HU-EdoiUgX3vkbg26E

# Archive single post by URl <https://youtube.com/post/id>
node yt-ar.js UCJEER74X9kBenMT_x9iK9Mw --post-url "https://www.youtube.com/post/Ugkx..."

# Customize
node yt-ar.js UC... --root ./archive --limit 100 --delay-pages 1000 --skip-media --verbose
```

> [!NOTE]
> The API only able to return latest 200 posts. To get past that you need to know and pass the postId itself.

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--post <id>` | Single post mode by ID | — |
| `--post-url <url>` | Single post mode by URL | — |
| `--root <path>` | Output directory | `./archive` |
| `--limit <n>` | Max posts to fetch (bulk) | `250` |
| `--delay-pages <ms>` | Delay between page fetches | `1000` |
| `--delay-detail <ms>` | Delay between detail fetches | `1000` |
| `--delay-media <ms>` | Delay between media downloads | `500` |
| `--no-media` / `--skip-media` | Skip image downloads | — |
| `--no-clean-json` | Skip saving `__metadata.json` files | — |
| `--no-raw-json` | Skip saving `__raw.json` files | — |
| `--single-file` | Merge all clean records into one `posts.json` | — |
| `--single-raw` | Merge all raw records into one `posts_raw.json` (not recommended - too big and full of garbage)| — |
| `--archive-file <path>` | Custom path for the deduplication ledger | — |
| `--force` | Re-fetch already-archived posts | — |
| `--verbose` | Debug logging | — |

---

## Output Structure

```
archive/youtube/
├── .archive                              # Ledger: "UCxxx postId" per line
└── UCxxx Channel Name/
    └── posts/YYYY-MM-DD/
        ├── ...__metadata.json            # Clean JSON data
        ├── ...__raw.json                 # Full API response
        └── ...__img*.jpg                 # Downloaded media
```

---

## Clean JSON Output Example

```JSON
{
  "postId": "Ugkxtly1F3dMcpyMJ81MxtKPd5pzcvkdtklz",
  "channelId": "UCJEER74X9kBenMT_x9iK9Mw",
  "channelTitle": "FIFTY FIFTY Official",
  "channelHandle": null,
  "postUrl": "https://www.youtube.com/post/Ugkxtly1F3dMcpyMJ81MxtKPd5pzcvkdtklz",
  "publishDate": "2025-10-26T08:19:43.147371-07:00",
  "publishedText": "3 months ago",
  "savedAt": "2026-02-24T01:42:45.919Z",
  "text": "FIFTY FIFTY 3rd Digital Single\n[𝑻𝒐𝒐 𝑴𝒖𝒄𝒉 𝑷𝒂𝒓𝒕 1.] Concept Photo\n\n🌈\n\n#FIFTYFIFTY #피프티피프티\n#FIFTYFIFTY_TOOMUCH_Part1\n#TOOMUCH_Part1",
  "likeCount": "10K",
  "author": {
    "name": "FIFTY FIFTY Official",
    "handle": "/@WE_FIFTYFIFTY",
    "id": "UCJEER74X9kBenMT_x9iK9Mw"
  },
  "images": [
    "https://yt3.ggpht.com/xzS6MXQkvO_R0iWFj2YeGiuOEPyqOIOdRFRgbEiVZvE17sYuFa0YqvEXZ6Vh2kx316qDJInIYbK7GQ=s0"
  ],
  "video": null,
  "poll": null,
  "microformat": {
    "urlCanonical": "https://www.youtube.com/post/Ugkxtly1F3dMcpyMJ81MxtKPd5pzcvkdtklz",
    "title": "Post from FIFTY FIFTY Official",
    "description": "FIFTY FIFTY 3rd Digital Single [𝑻𝒐𝒐 𝑴𝒖𝒄𝒉 𝑷𝒂𝒓𝒕 1.] Concept Photo 🌈 #FIFTYFIFTY #피프티피프티 #FIFTYFIFTY_TOOMUCH_Part1 #TOOMUCH_Part1",
    "thumbnail": {
      "thumbnails": [
        {
          "url": "https://yt3.ggpht.com/xzS6MXQkvO_R0iWFj2YeGiuOEPyqOIOdRFRgbEiVZvE17sYuFa0YqvEXZ6Vh2kx316qDJInIYbK7GQ=s1772-c-fcrop64=1,1fed0000dffaffff-rw-nd-v1?days_since_epoch=20508",
          "width": 1772,
          "height": 1772
        }
      ]
    },
    "siteName": "YouTube",
    "appName": "YouTube",
    "noindex": false,
    "unlisted": false,
    "familySafe": true,
    "tags": [
      "피프티피프티",
      "피프티",
      "하이어",
      "Higher",
      "Cupid",
      "큐피드",
      "어트랙트",
      "Attrakt",
      "#FIFTYFIFTY",
      "#피프티피프티",
      "#KEENA",
      "#키나",
      "#CHANELLEMOON",
      "#문샤넬",
      "#YEWON",
      "#예원",
      "#ATHENA",
      "#아테나",
      "#HANA",
      "#하나",
      "SOS",
      "Gravity"
    ],
    "pageOwnerDetails": {
      "name": "FIFTY FIFTY Official"
    },
    "publishDate": "2025-10-26T08:19:43.147371-07:00",
    "postDetails": {
      "externalPostId": "Ugkxtly1F3dMcpyMJ81MxtKPd5pzcvkdtklz",
      "discussionForumPosting": {
        "@type": "https://schema.org/DiscussionForumPosting",
        "url": "https://www.youtube.com/post/Ugkxtly1F3dMcpyMJ81MxtKPd5pzcvkdtklz",
        "datePublished": "2025-10-26T08:19:43.147371-07:00",
        "headline": "Post from FIFTY FIFTY Official",
        "text": "FIFTY FIFTY 3rd Digital Single\n[𝑻𝒐𝒐 𝑴𝒖𝒄𝒉 𝑷𝒂𝒓𝒕 1.] Concept Photo\n\n🌈\n\n#FIFTYFIFTY #피프티피프티\n#FIFTYFIFTY_TOOMUCH_Part1\n#TOOMUCH_Part1",
        "image": "https://yt3.ggpht.com/xzS6MXQkvO_R0iWFj2YeGiuOEPyqOIOdRFRgbEiVZvE17sYuFa0YqvEXZ6Vh2kx316qDJInIYbK7GQ",
        "author": {
          "@type": "https://schema.org/Person",
          "name": "FIFTY FIFTY Official",
          "url": "https://www.youtube.com/@WE_FIFTYFIFTY"
        },
        "@context": "https://schema.org/"
      }
    }
  },
  "detailError": null
}

```

---

### Landing / Initial Posts Fetch
Get the first page of community posts for a channel. Returns `[Posts]` + `[Continuation Token]` for pagination.

```diff
POST https://www.youtube.com/youtubei/v1/browse?prettyPrint=false
...headers,
{
  "context": {...},
  "browseId": "<channelId>",
  "params": "EgVwb3N0c_IGBAoCSgA%3D"
}

# Protobuf payload:
# {
#     tab: "posts",       // field 2  — selects the Posts tab
#     filter: {           // field 110
#         sort: 0x4a00    // field 1  — sort token (default: latest)
#         }
# }

# The sort token 0x4a00 is the default observed value. Other sort modes (if they exist) would
# swap this byte but YouTube's Posts tab doesn't currently expose alternate sort UI, so 0x4a00
# appears to be the only valid value in practice. - LLM.

```
---

### Pagination Fetch
Fetch subsequent pages using the continuation token. Returns `[Posts]` + `[Continuation Token]` for pagination.

```diff
POST https://www.youtube.com/youtubei/v1/browse?prettyPrint=false
...headers,
{
  "context": {...},
  "continuation": "<token_from_previous_response>"
}
```

---

### Single Post Detail Fetch
Get full metadata for a specific post (includes `publishDate` from `microformat`that is missing from Posts page (that have only arbitary `X days ago` date)).

```diff
POST https://www.youtube.com/youtubei/v1/browse?prettyPrint=false
...headers,
{
  "context": {...},
  "browseId": "FEpost_detail",
  "params": "<base64_protobuf_payload>"
}


# Protobuf payload:
# {channelId, postId}
```
---

### Image URL Handler

Strip the image modifier param to get the original resolution of images `=w640-c-...` or `=s640-c-...` into `=s0`/`=w0`.

Example:
> https://yt3.ggpht.com/xzS6MXQkvO_R0iWFj2YeGiuOEPyqOIOdRFRgbEiVZvE17sYuFa0YqvEXZ6Vh2kx316qDJInIYbK7GQ=s640-c-fcrop64=1,1fed0000dffaffff-rw-nd-v1

into

> https://yt3.ggpht.com/xzS6MXQkvO_R0iWFj2YeGiuOEPyqOIOdRFRgbEiVZvE17sYuFa0YqvEXZ6Vh2kx316qDJInIYbK7GQ=s0
