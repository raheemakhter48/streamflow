# Verified Hindi movie catalog

Edit `hindiMovies.json` with movies whose **exact embed URL** you have played
and listened to in Hindi. The file intentionally ships empty: no source has
been playback-verified yet. This is a manual catalog, not automated audio detection.

Each entry needs:

- `tmdbId`: positive numeric TMDB movie ID.
- `title`: correct movie title, used for catalog search.
- `playerUrl`: HTTPS embed URL for the verified Hindi version (not a homepage).
- `audioLanguage`: `"hi"`.
- `verified`: `true`, only after checking the audio and playback.
- `verifiedAt`: actual ISO timestamp of that check.

Before adding an entry, check the title matches, listen to Hindi dialogue,
play for at least a minute, seek, and test desktop/mobile. A `200` response,
Hindi subtitles, or a `lan=hindi` parameter alone is not verification.
Use URLs without embedded passwords or short-lived private access tokens.

The Hindi dropdown requests `/api/movies?audio=hindi_dubbed` with search and
page parameters. Entries appear in file order, 20 per page; TMDB supplies the
posters and movie metadata. Original catalog country/category filters do not
apply to this curated list.

Hindi movie links include `audio=hindi_dubbed`. Details re-check the registry
and open only that entry's player URL, without fallback to other audio sources.
Remove entries whose Hindi playback no longer works. This is a record of a
manual check, not a guarantee of continued provider availability.

The backend reads the file on each request. If running Docker, update the file
inside the deployment (rebuild the image, or mount the catalog file); editing
the host checkout alone does not change a running image. Reload the browser
catalog after updating. An already open external player cannot be revoked here.
