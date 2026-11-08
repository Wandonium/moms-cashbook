# Cashbook — browser practice app

Static F.O.20 voucher app for a single browser. No backend, sign-in, analytics,
external scripts or runtime dependencies. Payment details stay in IndexedDB on
this device. Clearing site data removes history; Download backup / Restore
backup transfers it to an empty browser. CSV exports are also available.
Use sample payments for this practice version. Files are prefixed TEST_.

The repository is intended to be private. The published GitHub Pages app and its
sanitized template are public; no original financial records are included.

## Run and verify

`npm test` tests monetary calculations, validation, history transitions, backup
roundtrips, CSV and workbook generation. `npm start` serves `site/` at port 8770.
Open http://localhost:8770 in a normal browser. Avoid private browsing if history
must survive closing the browser.

## Publish

Requires a GitHub plan that supports Pages from private repositories (for a
personal account, GitHub Pro or higher). Configure Pages to use GitHub Actions.
Only `site/` is published. The workflow runs tests before deployment.

Voucher XML is patched directly to retain the approved form's existing styles,
images, merges and print settings. Existing four-page print scaling is retained;
check Excel's print preview before printing. Browser outputs include cached
formula results and request recalculation on opening. Exchange rates are sample
inputs, not live rates. Office details carry forward a single account's spending.
