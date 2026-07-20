package expo.modules.zeropastesource

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Restart clipboard watch after reboot when the user left it enabled.
 * Best-effort — Android 15+ may block some FGS starts from boot; the app
 * also restarts the service on the next vault unlock.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      return
    }
    if (!ClipboardQueue.isEnabled(context)) return
    try {
      ClipboardWatchService.start(context)
    } catch (err: Exception) {
      Log.w("ClipboardWatch", "boot start deferred", err)
    }
  }
}
