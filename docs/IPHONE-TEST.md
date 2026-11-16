# Sleeve v1 — 10-minute iPhone test

For Ryan. Build: `main` at `4619541` (`Sleeve v1: on-device vinyl shelf`).

This is one pass on an iPhone, in Safari, of the shelf as it is today. The phone part is about 10 minutes. Step 0 is the computer, before the timer. Have three real records within reach before you start the timer:

1. One you own, with the artist and the title easy to read on the front.
2. One jazz record, or any older cover.
3. One cover with little or no writing.

Use the front of the sleeve. Leave the computer awake and the dev server running until step 7 is done.

Start a timer when the Collection screen appears on the phone (step 1). Stop it after step 7. The first photo also downloads the image model once. Time that bar on its own and let it finish. If the 10 minutes run out, finish the step you are on, mark the rest skipped, and send the form.

Write pass or fail as you go. The form is at the end.

## 0. Setup on your computer

macOS or Windows. The phone joins the same Wi-Fi in step 1.

1. Install Node if you need it. Open Terminal on macOS, or PowerShell on Windows, and run:

   ```bash
   node -v
   npm -v
   ```

   What you should see: two version numbers. If the command is not found, install the LTS from [https://nodejs.org](https://nodejs.org) (the LTS button; on 16 Nov 2026 that is 26.13.1). Node 22, 24, and 26 are all LTS, and this app was run with Node `v22.23.4` and npm `10.9.9`. Close the terminal, open it again, and run `node -v` once more.

2. Clone this repo and check out the commit this checklist was written for:

   ```bash
   git clone https://github.com/rbussell98/Project-1.git
   cd Project-1
   git checkout 4619541
   ```

   If the folder is already on the computer, `cd` into it and run the `git checkout` line only.

   What you should see: a line `HEAD is now at 4619541 Sleeve v1: on-device vinyl shelf (#1)`. Git may also say you are in a detached HEAD. That is the right commit for this test.

3. Install and start the dev server. Leave this window open for the whole test.

   ```bash
   npm install
   npm run dev -- --host
   ```

   What you should see: `npm install` returns to the prompt. A deprecation warning or an audit summary can print with it. The install worked if the prompt is back. `npm run dev -- --host` stays running and prints a Vite ready message, then two lines:

   ```text
   Local:   http://localhost:5173/
   Network: http://<this-computer>:5173/
   ```

   On the computer, open the Local address. You should see a dark page, the large word Collection, and the sentences "The room is quiet." and "Put a record on. A photo of the sleeve is enough to start."

4. Find the Wi-Fi address the phone will use. It is the Network line. The port is `5173`. The numbers in front of the port are this computer's address on the Wi-Fi.

   If Vite prints more than one Network line, match it to the Wi-Fi address in the system settings:

   - macOS: System Settings → Wi-Fi → the network name → Details. Use the IP address shown there.
   - Windows: Settings → Network & internet → Wi-Fi → the network name → Hardware properties. Use the IPv4 address.

   The phone address is `http://` plus that IP plus `:5173`. Example shape: `http://192.168.1.20:5173`. Write it down.

5. If the phone cannot open the page, check these and try the address again:

   - A firewall prompt on the computer. macOS asks whether `node` may accept incoming connections: choose Allow. Windows shows a Windows Security alert for Node.js: allow it on private networks. If the prompt is already gone, allow `node` in the firewall settings (macOS: System Settings → Network → Firewall → Options. Windows: Windows Security → Firewall & network protection → Allow an app through firewall).
   - The same Wi-Fi on both. Guest Wi-Fi often hides devices from each other. Turn off any VPN on the computer and the phone, and use Wi-Fi on the phone for Safari.
   - The address itself. On the phone, `localhost` is the phone. Use the Network IP, start with `http://`, and keep `:5173`. The terminal should still show the Vite ready message. If that window was closed, run `npm run dev -- --host` again.

## 1. First load

On the iPhone, open Safari. Use a normal tab. Start the timer, then open the Network address from step 0.

What you should see: within a few seconds, a dark page titled Collection in large type. Under it, "The room is quiet." and "Put a record on. A photo of the sleeve is enough to start." Two buttons: Add by photo, and Search MusicBrainz. Along the bottom, four tabs: Collection, Wishlist, Add, Settings. Collection is the current one. The browser tab title is Sleeve.

Write down the seconds from tapping Go until Collection is on screen.

This first screen is the shelf. The image model downloads the first time you add a photo, in step 3. Time that bar there. The line is "Downloading image model, one time only".

## 2. Empty Collection

Stay on Collection. Read the empty screen before you add anything.

What you should see: the large title Collection, the heading "The room is quiet.", and the sentence "Put a record on. A photo of the sleeve is enough to start." The count line ("1 record", "2 records") appears after you save something. The buttons say Add by photo and Search MusicBrainz. The search field appears after the shelf has records. Two icons sit at the top right (sort, and the list/grid switch). Leave them for step 5.

Tap Wishlist.

What you should see: the large title Wishlist, and the same two sentences ("The room is quiet." and "Put a record on. A photo of the sleeve is enough to start."). Wishlist does not show Add by photo or Search MusicBrainz. Tap Collection and you are back on the empty shelf.

## 3. Add three records by photo

Tap Add by photo.

What you should see: the Add screen. The line under the title says "A photo of the sleeve is enough to start." Three rows: Take a photo, Photo library, Search by artist and album.

Tap Take a photo and shoot the front of the first record (clear artist and title). Sleeve asks the iPhone for a picture through the system picker and the rear camera. If the phone offers a choice, take a new photo. If the camera does not open, shoot it with the iPhone camera app and use Photo library instead. Note which one you had to use.

What you should see: a sheet titled Add by photo, your picture, a status line, and this list:

1. Finding the cover
2. Matching the artwork
3. Reading text
4. Searching MusicBrainz

A Cancel button is at the bottom. A Close button is at the top of the sheet.

On the first photo, the status line changes to "Downloading image model, one time only" and a bar fills under it. That download is about 88 MB and needs ordinary internet on the phone, once. Time it from when the words appear until the line moves on. Later photos on this same address should skip that line. Write down the seconds.

Then the status line walks the list. A strong match can go from Matching the artwork straight to a line like `Found: Artist - Title`. A harder cover often continues with Reading text, then Searching MusicBrainz (1 of 3). The numbers in that line can tick up. Write down every status line you actually see, and the seconds from the photo being accepted until the next sheet.

What you should see next: the Add by photo sheet goes away and a confirm sheet slides up. Your cover (or the catalog cover) is at the top, then the artist, the album title in large type, and a year or the words Year unknown. A two-way control says Collection and Wishlist. Collection is the selected one. Under that, when Sleeve has more than one guess, a heading "Which one is it?" and up to three choices (cover, title, artist). The big title is the first guess. The three choices are the top three.

Fields you can change: Artist, and Album. Buttons: Search again, Use my photo as the cover, Save, and Cancel. Close is at the top of the sheet.

If the right record is the big title, leave the fields alone. If it is one of the three under "Which one is it?", tap that choice. The big title changes to it. If it is none of them, fix Artist and Album so they match the sleeve. Leave Collection selected. Leave Use my photo as the cover alone unless the picture on the sheet is the wrong album. Tap Save.

What you should see: the sheet closes, you land on Collection, a short message says "Saved to Collection", and the cover is on the shelf with its title and artist. The line under Collection says "1 record". That message is the save. The button you tapped is Save, with Collection selected in the control above it.

If the status line becomes "Something got in the way", read the error under it. Tap Try again once. If it fails again, tap Enter it myself, type Artist and Album, tap Save, and mark this photo wrong.

Repeat the same path for the other two records: Add tab, Take a photo, wait out the status lines, use "Which one is it?" when it is there, fix Artist or Album if you need to, tap Save.

- Second record: the jazz or older cover.
- Third record: the cover with little text.

What you should see after each Save: "Saved to Collection", and the count going up by one ("1 record", then "2 records", then "3 records" if all three saved). The download line belongs to the first photo only.

For each photo, mark the first guess: right on the first try, in the top 3 under "Which one is it?", or wrong.

## 4. Wishlist from a MusicBrainz search, then Move to Collection

Pick a record you want and do not already have on the shelf. Tap Add. Tap Search by artist and album.

What you should see: a sheet titled Search. Fields Artist and Album. A button Search.

Type the artist and the album. Tap Search.

What you should see: the button reads "Searching MusicBrainz (1 of 1)", then a list. Each row is an album title, with the artist under it, and the year when MusicBrainz sent one.

Tap the right row.

What you should see: the confirm sheet again. Collection is selected. Tap Wishlist so that side is selected. Tap Save.

What you should see: a short message "Saved to Wishlist", and the Wishlist screen with that record. The line under Wishlist says "1 record".

Tap the cover.

What you should see: the record sheet. Artist, album title, year or Year unknown. Rows labeled Label, Format, Notes, and, when Sleeve has a MusicBrainz id, MusicBrainz with the word Open. Format shows LP unless you changed it. Buttons: Edit, Move to Collection, Delete.

Tap Move to Collection.

What you should see: the button label changes to Move to Wishlist. Tap Close. Tap Collection. The record is there with the ones from step 3. After three photos plus this one, the count is "4 records". Tap Wishlist.

What you should see: the empty Wishlist again. "The room is quiet." and "Put a record on. A photo of the sleeve is enough to start."

## 5. Search, sort, grid and list, swipe, detail, edit, delete

Tap Collection. You are on a grid of covers. Each cover shows the title and the artist under it.

Search. The field placeholder says "Artist, title, label, year". Type a few letters from one artist.

What you should see: only the matching covers. The line under Collection reads "1 match", or "2 matches" when more than one cover fits. Clear the field.

What you should see: all of the covers again, and the line reads "4 records" (or however many you still have). A word that fits nothing shows the sentence "Nothing matches."

Sort. Tap the up-down arrow icon at the top right.

What you should see: a sheet titled Sort. The rows are Artist, Title, Year, and Date added. Artist has a check. Tap Date added.

What you should see: the sheet closes, and the newest record is first.

Grid and list. The other top-right icon switches the layout. From the grid, tap it.

What you should see: a list. Each row has a small cover, the title, the artist, and a gray line with the year and the label when Sleeve has them (joined with a dot). Tap the icon again and the grid returns. Tap it once more so you are back on the list. The swipe below only works on the list. (The icon's name, if you are using VoiceOver, is List view on the grid and Grid view on the list.)

Swipe. Put a finger on a row and drag left until the row stays open.

What you should see: two buttons on the right, Wishlist and then Delete. Drag the row back to the right so it closes. Do that again on a record you can lose, and tap Delete.

What you should see: a sheet titled "Take this off the shelf?" Under it, a sentence in the shape `Artist — Title will leave this phone.` Buttons: Delete, and Keep it. Tap Keep it.

What you should see: the sheet closes and the record is still in the list.

Detail and edit. Tap that same row (tap the row itself, not the swipe buttons).

What you should see: the record sheet from step 4. On a Collection record the move button says Move to Wishlist.

Tap Edit.

What you should see: fields Artist, Title, Year, Label, Format, and Notes. Buttons Save changes and Cancel. The name of the record is Title here. On the confirm sheet in step 3 it was Album.

Type `iphone test` in Notes. Tap Save changes.

What you should see: the form closes and the Notes row reads "iphone test".

Delete. Tap Delete.

What you should see: the sheet "Take this off the shelf?" again, with Delete and Keep it. Tap Delete.

What you should see: the sheet closes and that record is gone. The count drops by one. After the path above, that is "3 records".

## 6. Settings: export, then import

Tap Settings.

What you should see: the large title Settings, the name Sleeve, and the line "A quiet listening room." A section Appearance with Dark and Light. Dark is selected. Leave it. A section Library with the rows Export backup and Import backup. At the bottom: "Records stay on this phone. The image model downloads once, the first time you add a photo. Names and cover art come from MusicBrainz and the Cover Art Archive."

Tap Export backup.

What you should see: a line "Exported 3 records." The number matches the shelf. A single record would read "Exported 1 record." Safari also starts a file named `sleeve-backup-` plus the date plus `.json`, for example `sleeve-backup-2026-11-16.json`. It lands in Downloads, or Safari offers a share sheet. If the screen fills with JSON text, use the share button, save the file to Files, then come back to this Settings screen.

Tap Import backup and choose that same file.

What you should see: a line "Imported 3 records."

Tap Collection.

What you should see: the same records as before the import, still one of each, and the same count ("3 records" after the delete in step 5). Import writes over those same records.

## 7. Close Safari, then reopen

Switch to the iPhone app switcher and flick Safari up until it is gone. Open Safari again. Go to the same `http://IP:5173` address. It has to be the same IP. A different IP is a different empty shelf.

What you should see: Collection, with the same records and the same count as the end of step 6. The shelf is still filled. The status line "Downloading image model, one time only" stays off this reopen, because that download already happened in step 3.

Stop the timer.

## 8. Send this back

Copy this form, fill it in, and send it with the screenshots.

```text
Sleeve v1 iPhone test — 4619541
Phone (model and iOS):
Computer (macOS or Windows):
Wi-Fi address you opened:
Minutes from step 1 to step 7:

Step 0 setup:            pass / fail
  notes:

Step 1 first load:       pass / fail
  seconds until Collection:
  notes:

Step 2 empty Collection: pass / fail
  notes:

Step 3 photos:
  1. clear cover
     record:
     first guess: right first try / in the top 3 / wrong
     status lines you saw:
     seconds until the confirm sheet:
     download bar ("Downloading image model, one time only"): yes / no, seconds:
  2. jazz or older cover
     record:
     first guess: right first try / in the top 3 / wrong
     status lines you saw:
     seconds until the confirm sheet:
  3. little text
     record:
     first guess: right first try / in the top 3 / wrong
     status lines you saw:
     seconds until the confirm sheet:
  notes:

Step 4 wishlist search, then Move to Collection: pass / fail
  record you searched:
  notes:

Step 5 search, sort, list, swipe, detail, edit, delete: pass / fail
  notes:

Step 6 export, then import: pass / fail
  file name:
  notes:

Step 7 close Safari and reopen: pass / fail
  notes:

Anything that felt unlike an iPhone
(type, scroll, sheets, the camera picker, the keyboard, the home indicator):

Screenshots attached:
  [ ] empty Collection
  [ ] Add by photo with the status list (include the download bar if it is on screen)
  [ ] confirm sheet, including "Which one is it?" when it showed
  [ ] Wishlist before Move to Collection
  [ ] "Take this off the shelf?"
  [ ] Settings after Export backup
```

## Known limits

- The page is `http` on the local network. A full-screen Home Screen app needs `https`. Stay in the Safari tab for this test.
- Take a photo and Photo library are file pickers. Take a photo asks for the rear camera. The Sleeve screen after the picture is the sheet Add by photo.
- The image model downloads once, the first time you add a photo, and the phone needs internet for that file. MusicBrainz searches during `npm run dev` go through the computer. Records stay on the phone for this exact address. A Private tab, a cleared Safari site, or a new IP starts an empty shelf.

## Commands that were run

Checked on this commit before the checklist was added, with Node `v22.23.4` and npm `10.9.9`:

- `node -v` and `npm -v` printed those versions.
- `npm install` finished, and the `postinstall` script ran.
- `npm run dev -- --host` printed Vite ready, `Local: http://localhost:5173/`, and a `Network:` line on port `5173`. Opening the Local URL returned the page titled Sleeve.
