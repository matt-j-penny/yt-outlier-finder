# YT Outlier Finder

Chrome extension that lets you:

- Live-filter videos on any YouTube page (home, search, subscriptions, channels, etc.) by outlier score, subscriber count, and/or view count.
- Save videos, titles and thumbnails to the **Inspiration** page in [Content OS](https://github.com/matt-j-penny/content-os).

## Installation

1. Clone or download the repo.
2. In Chrome go to `chrome://extensions`, enable Developer mode.
3. "Load unpacked" and select this folder.
4. (Optional) Pin the extension.
5. In Content OS, create a key on the **API** page, then paste it into the extension's **Options**.

## Live Filtering (the main "finder" feature)

Open the popup on any YouTube page. Toggle and set thresholds for:

- **Filter by Outlier** — e.g. only show 5x+ or 10x+ videos.
- **Filter by Subscribers** — min / max channel size (supports K/M/B).
- **Filter by Views** — min / max on the video.

Changes apply instantly to the current tab and persist. Videos without detectable data for a filter are generally left visible.

**Important:** For outlier scores to work, you **must** install the official [vidIQ Vision for YouTube](https://chromewebstore.google.com/detail/vidiq-vision-for-youtube/pachckjkecffpdphbpmfolblodfkgbhl) Chrome extension. The extension reads the badges that vidIQ adds to video cards.

## Saving to Content OS

- **Whole video:** hover a video card and click **Save**. It's saved as a YouTube video with its vidIQ outlier score.
- **Just the title / just the thumbnail:** right-click a video card (or anywhere on a watch page) and choose **Save title to Content OS** or **Save thumbnail to Content OS**.
- **From the popup:** paste a watch URL, **Preview**, then **Save to Content OS**.

Each save calls `POST /api/inspiration` on Content OS with `Authorization: Bearer cos_…`:

```json
{ "kind": "youtube_video", "url": "https://www.youtube.com/watch?v=...", "outlier_multiple": 12.5 }
```

`kind` is `youtube_video`, `youtube_title` (also sends `title`) or `youtube_thumbnail` (Content OS stores a copy of the thumbnail).

## Configuration

Options page:

- **API key** — a Content OS key (`cos_…`). Stored in Chrome local storage only.
- **Content OS URL** — defaults to `https://the-content-os.com`; use `http://localhost:3000` for local development.

Filter settings live in Chrome sync storage.
