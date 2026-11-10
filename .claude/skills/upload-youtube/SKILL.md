---
name: upload-youtube
description: Hand off a finished YouTube video. Copies it at full quality into its Google Drive folder, writes a transcript next to it, and updates its Airtable record (status Ready, the Drive link and the transcript). Run only when Owain types /upload-youtube.
argument-hint: <path to the finished video> [Airtable record or title]
disable-model-invocation: true
---

# Upload a finished YouTube video

Input: `$ARGUMENTS`. The first argument is the finished video on this Mac. An optional second argument names the Airtable record (a `rec…` id or words from its title).

The video is finished. Never re-encode, trim or remux it: the file in Drive must be byte-identical to the one given.

## Where things live

- **Airtable:** base Content OS `appHXrxayM2IvvvNG`, table Content `tblfrV8H7YXN62DZo`. Fields: Title `fld8x2MUz2K3xqpBp`, Platform `fldfmqGPsXETldAUd` (YouTube), Status `fldLwEDiJoEOgWchD` (… Editing, Ready, Published), Doc `fldLkackbv93eoXN6` (the script, a Google Doc), Date `fldRk0kgJKYn9XHCB`, Transcript `fldM2itNSk6y86YYq`, Video `fldevbMFO2F1WB42B` (URL).
- **Google Drive:** Drive for desktop, `~/Library/CloudStorage/GoogleDrive-owain@gradientwork.com/My Drive/Content/YouTube/`. One folder per video, `YYYY-MM-DD <short name>`, holding its CON doc and `Final video.mp4`.

## Steps

1. **Check the file.** Run `scripts/check.sh <video>` (scripts sit in this skill's base directory). It prints the size, length, frame rate, loudness, and the frame sizes in the last two seconds. Stop if it is not 3840x2160 and say what it is. If the last frames shrink to a few KB, the editor's encoder starved the ending, which shows as blocking: tell Owain, but carry on, because it is his export.
2. **Find the record.** List Content records with Platform YouTube whose Status is not Published. With the second argument, match it. Otherwise pick the one record in Editing. If two or more fit, read the first minute of the transcript (step 4) and match it against the titles and Docs; if that is still unclear, ask. Never update a record you are not sure of.
3. **Find the folder.** Take the doc id from the record's Doc URL (`/document/d/<id>/`), then `grep -l <id>` the `.gdoc` files under `Content/YouTube/`. The folder holding that `.gdoc` is the video's folder. With no Doc or no match, look for a folder named after the video. If none exists, create `Content/YouTube/<Date or today> <short name from the title>` and say so.
4. **Transcribe.** Run `scripts/transcript.sh <video> <folder>/Transcript.txt` in the background (about two minutes per ten minutes of video). It uses the same Whisper model and vocabulary as Studio's ingest, and writes plain paragraphs.
5. **Copy the video.** `cp <video> "<folder>/Final video.mp4"`, then `cmp` the two files. If a `Final video.mp4` is already there, it is replaced; Drive keeps the old one in its version history.
6. **Wait for the upload.** In the background, poll `/usr/bin/fileproviderctl evaluate "<folder>/Final video.mp4"` every 30 s until it prints `isUploaded = 1`. A 5 GB file takes about 35 minutes. Do the same for `Transcript.txt`.
7. **Get the link.** Drive `search_files` with `title = 'Final video.mp4' and parentId = '<folder id>'` (the folder id is the CON doc's `parentId` from `get_file_metadata`). Check that `fileSize` matches the local file. Use its `viewUrl`.
8. **Update Airtable.** One `update_records_for_table` call: Status `Ready`, Video the link, Transcript the text of `Transcript.txt`. The Transcript field holds 100,000 characters; if the text is longer, put the first part in the field and say the full copy is in Drive.
9. **Report** in a few lines: the Drive link, the folder, the record and what changed in it, and any warning from step 1. The file is shared with no one; leave sharing to Owain.

## When something is missing

- **A field id is refused:** the field was renamed or deleted. Look it up with `list_tables_for_base`; if it is gone, finish the rest and ask Owain, and never write the value into another field.
- **Drive for desktop not signed in:** stop and say so; do not upload through another route.
- **The upload stalls:** measure what the Mac sends (`netstat -ib`, en0 Obytes, twice 15 s apart). Near zero for ten minutes means Drive is stuck (on 2026-11-10 it had crashed and left two copies running). Ask Owain before quitting and reopening Google Drive; the file is safe on disk and the upload resumes.
- **Airtable or Drive tools fail:** the copy in Drive still counts. Report which step failed and what is left.
