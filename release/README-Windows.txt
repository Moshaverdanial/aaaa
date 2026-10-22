Dal on Windows - ONE FILE (dal.js)
==================================
Needs: Node.js LTS from https://nodejs.org (Next, Next, Finish). Check with:  node -v

A) CLEAN OLD COPIES (optional; this DELETES old Dal folders and their data!)
   Open CMD (Win key, type cmd, Enter) and paste ONE line at a time:

   taskkill /F /IM node.exe
   for /d %d in ("%USERPROFILE%\Downloads\aaaa*" "%USERPROFILE%\Desktop\aaaa*" "%USERPROFILE%\Documents\aaaa*" "%OneDrive%\Desktop\aaaa*" "%OneDrive%\Documents\aaaa*" "C:\aaaa*" "C:\Dal") do rd /s /q "%d"
   del /q "%USERPROFILE%\Downloads\aaaa*.zip"

B) INSTALL + RUN (3 commands)

   mkdir C:\Dal
   cd /d C:\Dal
   curl -fL -o dal.js https://github.com/Moshaverdanial/aaaa/raw/arena/01a0f735-aaaa/release/dal.js

   First time only (creates the admin account):
   node dal.js admin 09123456789 Admin Dal12345678

   Start (keep the black window open; the browser opens by itself):
   node dal.js

   Site: http://localhost:3000   Login with an ENGLISH keyboard.

C) UPDATE LATER: close the black window, then run in C:\Dal:
   curl -fL -o dal.js https://github.com/Moshaverdanial/aaaa/raw/arena/01a0f735-aaaa/release/dal.js
   (your data stays in C:\Dal\data)

D) BACKUP: node dal.js backup   (then copy the "data" folder somewhere safe)
E) PORT BUSY ("port 3000 is already in use"): taskkill /F /IM node.exe  and run again.
F) Check the download: dir dal.js  -> about 3,100,000 bytes. If tiny or error: download the repo zip
   https://github.com/Moshaverdanial/aaaa/archive/refs/heads/arena/01a0f735-aaaa.zip and copy release\dal.js to C:\Dal
G) Browser address must start with http:// (NOT https). Do not click inside the black window (it pauses the server; press Enter to resume).
H) Server check from a 2nd CMD: curl http://localhost:3000/api/setup/status  -> {"needsSetup":false}
Full Persian guide: docs/ویندوز-از-صفر.md
I) Health check: node dal.js doctor   (must end with RESULT: ALL GOOD)
J) First start: the browser opens by itself on the admin-setup form (setup code is pre-filled).
