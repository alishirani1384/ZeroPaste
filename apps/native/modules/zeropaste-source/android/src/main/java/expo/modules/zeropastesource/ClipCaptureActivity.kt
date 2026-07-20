package expo.modules.zeropastesource

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.WindowManager

/**
 * Brief translucent activity so Android 10+ grants clipboard read focus.
 * Launched by [ClipboardWatchService] when a clip changes while ZeroPaste is backgrounded.
 */
class ClipCaptureActivity : Activity() {
  private var finished = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)
    // Don't steal soft input / flash the keyboard.
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (!hasFocus || finished) return
    finished = true
    try {
      readAndEnqueue()
    } finally {
      finish()
      overridePendingTransition(0, 0)
    }
  }

  private fun readAndEnqueue() {
    if (ClipboardQueue.isSuppressed(this)) return

    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    val clip = clipboard.primaryClip ?: return
    if (clip.itemCount <= 0) return
    val text = clip.getItemAt(0).coerceToText(this)?.toString()?.trim().orEmpty()
    if (text.isEmpty()) return
    if (RECOVERY_KEY.matches(text)) return

    val appName = intent.getStringExtra(EXTRA_APP_NAME)
    val packageName = intent.getStringExtra(EXTRA_PACKAGE)

    ClipboardQueue.enqueue(this, text, appName, packageName)
    ClipboardWatchService.notifyJsCapture(this, text, appName, packageName)
  }

  companion object {
    const val EXTRA_APP_NAME = "appName"
    const val EXTRA_PACKAGE = "packageName"
    private val RECOVERY_KEY = Regex("^[0-9a-f]{64}$", RegexOption.IGNORE_CASE)
  }
}
