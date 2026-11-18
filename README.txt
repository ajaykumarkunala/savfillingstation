SAV FILLING STATION - SHIFT SETTLEMENT (cloud version)
=======================================================
Upload ALL of these to the TOP of your GitHub repository (replace old files):
  index.html
  manifest.json
  sw.js
  icon-192.png
  icon-512.png
  icon-maskable-512.png
  ocr/            (the whole folder - offline slip reader)

Do NOT upload the folder "petrol-pump-site" itself, or the site will show "Page not found".

Firebase (already set up): project sav-filling-station
  - Authentication: Email/Password, two users
  - Firestore rules: only the two allowed email addresses may read/write
  - Data: collection "shifts" (one document per shift date) and "meta/current"

Slip photos stay on the device (browser copy + optional slips folder). They are not uploaded.
