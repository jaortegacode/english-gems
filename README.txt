English gems - setup

WHAT IT IS
A private web app for daily business English practice: 270 gems in 90 days, exercises,
speaking practice, check-ins, weekly quizzes, progress and backup. No server, no account.
All data stays in your browser (IndexedDB).

HOW TO HOST IT (needed for offline use and "Add to Home Screen")
1. Upload this whole folder to any static host that serves over https:
   GitHub Pages, Netlify (drag and drop the folder), Cloudflare Pages, or Vercel.
2. Open the URL on your phone once while online.
3. iPhone: Share > Add to Home Screen. Android / Chrome: menu > Install app.
4. After the first load it works offline.

TRY IT WITHOUT HOSTING
Open english-gems-single.html in a browser. It works, but without offline install.
Opening index.html straight from disk also works, except the service worker (offline mode).

FILES
index.html, styles.css, app.js, speak.js, extras.js, core.js, db.js, main.js  - the app
data.js      - the 270 starter gems and the 90-day order
content.js   - speaking scenarios, study notes, corrections list
sw.js, manifest.webmanifest, icons/  - offline and install support

BACK UP
More > Export saves a JSON file. More > Import restores it (merge or replace).
Browsers can erase local data for sites you do not visit for a long time, so back up weekly.

CHANGING CONTENT
Add your own gems in the Library tab (Add gem). To edit the starter bank, use the "source"
folder next to this one: edit source/src/gems.txt, then run "node build.js" and "node build_dist.js"
inside it. The new app files appear in source/dist.
