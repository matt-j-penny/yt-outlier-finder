# YT Outlier Finder

Chrome extension that lets you:

- Live-filter videos on any YouTube page (home, search, subscriptions, channels, etc.) by outlier score, subscriber count, and/or view count.
- Send a video to a single **target webhook** from the popup.

Use this to feed your own server, n8n workflow, Make.com scenario, database ingester, etc.

## Installation

1. Clone or download the repo.
2. In Chrome go to `chrome://extensions`, enable Developer mode.
3. "Load unpacked" and select this folder.
4. (Optional) Pin the extension.

## Live Filtering (the main "finder" feature)

Open the popup on any YouTube page. Toggle and set thresholds for:

- **Filter by Outlier** — e.g. only show 5x+ or 10x+ videos.
- **Filter by Subscribers** — min / max channel size (supports K/M/B).
- **Filter by Views** — min / max on the video.

Changes apply instantly to the current tab and persist. Videos without detectable data for a filter are generally left visible.

This works by parsing the DOM (vidIQ or similar extensions that add "12.4x" outlier badges/popovers and subscriber/view numbers make it much more reliable).

**Important:** For the outlier score (`outlierMultiple`) to work reliably, you **must** install the official [vidIQ Vision for YouTube](https://chromewebstore.google.com/detail/vidiq-vision-for-youtube/pachckjkecffpdphbpmfolblodfkgbhl) Chrome extension. The extension looks for the data attributes and badges that vidIQ adds to video cards on YouTube. Without it, `outlierMultiple` will almost always be `null`.

## Sending Videos to Your Webhook

Open the popup, then:

1. Paste a full YouTube watch URL.
2. Click **Preview** (uses public oEmbed — no key needed).
3. Click **Send to Webhook**.

## Target Webhook Contract (what your server receives)

**Method:** POST  
**Content-Type:** application/json

**Body (always an array with one item):**

```json
[
  {
    "videoURL": "https://www.youtube.com/watch?v=...",
    "title": "Video Title Here",
    "thumbnailUrl": "https://i.ytimg.com/vi/.../hqdefault.jpg",
    "outlierMultiple": 12.5
  }
]
```

- `videoURL`: the full watch URL.
- `title`: the video title (fetched via YouTube oEmbed).
- `thumbnailUrl`: the standard thumbnail URL.
- `outlierMultiple`: always `null` for popup sends.

Your server can respond with any JSON. If the response contains a top-level `url` (or `notionUrl` / `notion_url`), the popup shows it as a clickable link.

## Configuration

Click the extension icon → **Options** (or right-click the extension icon in the toolbar).

Only one setting:

- **Target Webhook URL (POST)** — the endpoint that will receive the payload above.

That's it. No API keys, no Notion, no Gemini/infographics in this version.

## Notes

- The extension only needs broad host permissions because webhooks can live anywhere.
- Outlier extraction is best-effort DOM scraping. It works great when vidIQ (or similar) is also installed and showing the "X x" badges.
- The popup filters and the "Send to Webhook" action are completely independent.
- All settings live in Chrome sync storage.

Build whatever you want on the receiving end — this just reliably gives you the video + its outlier score when you find something interesting while browsing.
