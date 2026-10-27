# Phone test checklist

Nothing here has been tested yet. Tick each box yourself on your Android phone and write down anything odd.

## 1. Install
- [ ] The app installs and opens without a crash.
- [ ] You see the welcome screen asking for an AI key (first launch only).
- [ ] The bottom bar shows Home, Study, Library, Map, Settings, and each tab opens.

## 2. API key
- [ ] Pick Claude or ChatGPT, paste your key, tap **Test key**.
- [ ] A wrong key shows a "provider rejected this key" message.
- [ ] Turn on airplane mode: Test key shows a "could not reach the provider" message. Turn it off again.
- [ ] A good key shows a success message. The key is never shown on screen in plain text.
- [ ] Save and continue. Close and reopen the app: you are NOT asked for the key again.
- [ ] Settings > Remove key brings the welcome screen back.

## 3. Import notes
- [ ] Library: paste some notes and save them as a topic.
- [ ] The topic appears in the list. Notes with [[links]] show on the Map tab.
- [ ] Try a PDF or photo import only if the Library screen offers it.

## 4. Diagnostic
- [ ] Study: start the diagnostic with 5 questions. Questions appear and you can answer them.
- [ ] After the last answer you see a score.
- [ ] Home now shows points, a level bar and a recommended next step.

## 5. Quiz
- [ ] Answer a quiz if the Study tab offers one. Feedback appears after each answer.
- [ ] Home streak and points go up. Weak topics list appears after wrong answers.
- [ ] "Reviews due" shows 0 (flashcards are not built yet).

## 6. Offline
- [ ] In airplane mode, open every tab. Your saved notes and progress are still there.
- [ ] AI actions show a clear offline message instead of freezing.

## 7. Restart
- [ ] Force-close the app and reopen it. Notes, points and settings are all still there.
- [ ] Restart the phone and check again.

## 8. Backup
- [ ] Settings > Export my data. Save the text somewhere (notes app, email to yourself).
- [ ] Look through the text: it must not contain your API key.
- [ ] Paste it back under Import a backup and tap **Check backup**: it says "Looks valid" with counts.
- [ ] Paste junk text: it says "Not valid" and changes nothing.
- [ ] Confirm the import: your data is replaced and your key is still saved.

## Look and feel
- [ ] Buttons are easy to tap with a thumb.
- [ ] Text is readable in a dim room and outdoors.
- [ ] Making the phone font larger does not break screens.
