# Shaadi Shopping · "Divine Union" invitation template

A scrolling 3D web invitation. Its first client was Sudhanshu (Charlie) & Shreya:
https://www.shaadishopping.com/invitations/sudhanshu-shreya

## What guests see

1. **"Tap to unite"**: two gold rings swing in from the sides in 3D and link together. They are replaced by Krishna's and the bride's hands if `assets/hand-krishna.png` and `assets/hand-bride.png` exist.
2. **Garden gate**: ivory-and-gold gates open inside a rose arch, with a shower of petals.
3. **Hero**: the couple's monogram (for example S♥S), names, date and venue over the Radha-Krishna garden.
4. **Invitation card**: Ganesh, the family line, and the couple's names.
5. **Ceremony card**: 3D doors open onto the date, time, venue, **Directions** and **Save the date**.
6. **Story**: a Shiv-Parvati / Radha-Krishna line.
7. **RSVP**: separate **Call** and **WhatsApp** buttons.
8. **Countdown**: digits that flip like a flip clock.
9. **Footer and credit**: the Shaadi Shopping credit band, with links to shaadishopping.com and Vivah OS.

Background music starts with the first tap, and the floating button pauses it. On laptops the invite shows as a centred column, with a side panel of key details and a framed artwork. The whole invite uses one ivory, gold and plum theme.

## Make a new client's invite (about 5 minutes)

1. Copy `clients/_example.json` to `clients/<groom>-<bride>.json` and fill it in:

   | field | example | notes |
   |---|---|---|
   | `slug` | `rahul-priya` | Becomes the web address `/invitations/rahul-priya`. Use lowercase letters and dashes. |
   | `groom`, `bride` | `Rahul`, `Priya` | The groom's name is shown first. |
   | `groomNick` | `Charlie` | Optional. Leave it `""` and the "( … )" lines disappear. |
   | `eventLabel` | `Engagement Invitation` | Shown on the WhatsApp preview image. |
   | `ceremony` | `Ring Ceremony` | |
   | `eventStart` | `2027-02-14T18:30:00+05:30` | Date and time in India time. The countdown and the calendar use this. |
   | `time` | `6:30 PM onwards` | |
   | `venue`, `mapUrl` | `Hotel Maurya, Patna`, a Google Maps link | |
   | `family` | `The Family` / `The Sharma Family` | Use whatever wording the client wants. |
   | `call`, `whatsapp` | `98765 43210` | Leave `whatsapp` empty to use the call number. |
   | `music` | *(optional)* | Leave it out to use our own original track. See the music section below. |

2. Create it:
   ```
   cd "C:\Shaadi Shopping\Invitation Sample\templates\divine-union"
   node new-invite.mjs clients\rahul-priya.json
   ```
   This creates `C:\Shaadi Shopping\Invitation Sample\rahul-priya\` and draws the R♥P monogram and the WhatsApp preview image. Open its `index.html` to check it.

3. Publish it on shaadishopping.com:
   ```
   cd "C:\Shaadi Shopping\weddingcart"
   git checkout main && git pull
   git checkout -b invite/rahul-priya
   bash "C:\Shaadi Shopping\Invitation Sample\build-for-site.sh" rahul-priya rahul-priya
   ```
   Commit, push and open a pull request. After merging, the invite is live at
   `https://www.shaadishopping.com/invitations/rahul-priya`. These pages are hidden from search engines and only reachable by link.

## Music: stay copyright-safe

- **Default:** `kashi-utsav.mp3` is an original Shiv-Parvati devotional lofi composed for Shaadi Shopping, so it's free to use for every client. `kailash-lofi.mp3` is a second original option. To use it, add `"music": { "file": "C:/Shaadi Shopping/Invitation Sample/templates/divine-union/assets/kailash-lofi.mp3", "permission": true }` to the client file. It's ours, so permission is true.
- **A song the client asks for:** use it only if they have permission or a licence. Then add this to the client file:
  ```json
  "music": { "file": "C:/path/song-clip.mp3", "credit": "Music: “Song” · Artist", "permission": true }
  ```
  To trim a clip from, for example, 0:41 for 75 seconds:
  ```
  ffmpeg -ss 41 -t 75 -i song.mp3 -af "afade=t=in:d=1.2,afade=t=out:st=70:d=5,loudnorm=I=-16:TP=-1.5" -b:a 128k song-clip.mp3
  ```
- Never rip audio from YouTube, Instagram or other people's invitation reels.

## Artwork

`floral-arch.jpg`, `rk-garden.jpg` and `rk-lanterns.jpg` were made for Shaadi Shopping in Canva. `ganesh.png` is the user's own image, cut out. To change the theme for a client (for example Shiv-Parvati), replace these files with art you own, keeping the same file names and a 1080×1920 portrait size.

## Files

- `index.html`: the template. Every client detail is a `{{TOKEN}}`, so don't edit it for a single client.
- `new-invite.mjs`: creates a client invite from a details file.
- `tools/monogram.html`, `tools/og.html`: draw the monogram and the WhatsApp preview image.
- `tools/tokenize-from-page.mjs`: rebuilds the template from a finished page, if the design is improved later.
- `clients/`: one details file per client. `sudhanshu-shreya.json` is the first one.
