// Activity usage sketch (compile against your app; not part of the library file).
// 1) Ask once:   requestPermissions(arrayOf(AnkiDroidBridge.PERMISSION), 42)
// 2) After grant:
//    val bridge = AnkiDroidBridge(this)
//    if (!bridge.isInstalled()) { /* show "Install AnkiDroid" */ }
//    val r = bridge.addCards("Nursing::Fundamentals", listOf(
//        AnkiDroidBridge.Card.Basic("Normal adult respiratory rate", "12–20 breaths per minute", listOf("vitals")),
//        AnkiDroidBridge.Card.Cloze("Hand hygiene with alcohol rub lasts at least {{c1::20}} seconds.", listOf("infection-control"))))
//    toast("${r.added} added, ${r.skippedDuplicates} already there, ${r.failed} failed")
// No permission? startActivity(bridge.createCardIntent("Front", "Back"))  or share a .apkg with bridge.importApkgIntent(uri)
