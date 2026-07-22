package expo.modules.zeropastesource

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Sticky foreground service that listens for clipboard changes.
 * Android 10+ blocks background reads, so on change we briefly open [ClipCaptureActivity]
 * to gain focus, read the clip, enqueue it, and close.
 */
class ClipboardWatchService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var clipboard: ClipboardManager? = null
  private var listener: ClipboardManager.OnPrimaryClipChangedListener? = null
  private var debounceRunnable: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    startAsForeground()
    attachListener()
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        ClipboardQueue.setEnabled(this, false)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_CAPTURE_NOW -> {
        // Notification action: user-initiated capture while backgrounded.
        launchCaptureActivity(snapshotSource())
      }
    }
    startAsForeground()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    // User swiped the app from recents — keep watch alive when preference is on.
    if (ClipboardQueue.isEnabled(this)) {
      try {
        start(this)
      } catch (err: Exception) {
        Log.w(TAG, "restart after task removed failed", err)
      }
    }
  }

  override fun onDestroy() {
    detachListener()
    running = false
    super.onDestroy()
  }

  private fun attachListener() {
    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    clipboard = cm
    val l = ClipboardManager.OnPrimaryClipChangedListener {
      debounceRunnable?.let { handler.removeCallbacks(it) }
      val run = Runnable { onClipboardChanged() }
      debounceRunnable = run
      handler.postDelayed(run, 220L)
    }
    listener = l
    cm.addPrimaryClipChangedListener(l)
  }

  private fun detachListener() {
    debounceRunnable?.let { handler.removeCallbacks(it) }
    debounceRunnable = null
    val l = listener ?: return
    clipboard?.removePrimaryClipChangedListener(l)
    listener = null
  }

  private fun onClipboardChanged() {
    if (!ClipboardQueue.isEnabled(this)) return
    if (ClipboardQueue.isSuppressed(this)) return

    // While ZeroPaste is already focused, JS poll handles ingest — avoid translucent flash.
    if (SourceAppHelper.isOurAppForeground(this)) {
      Log.d(TAG, "clip changed while foreground — JS will poll")
      return
    }

    val source = snapshotSource()
    launchCaptureActivity(source)
  }

  private fun snapshotSource(): Map<String, String>? =
    SourceAppHelper.lastForegroundApp(this, excludeSelf = true)

  private fun launchCaptureActivity(source: Map<String, String>?) {
    val intent = Intent(this, ClipCaptureActivity::class.java).apply {
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_NO_ANIMATION or
          Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
          Intent.FLAG_ACTIVITY_NO_HISTORY or
          Intent.FLAG_ACTIVITY_SINGLE_TOP,
      )
      putExtra(ClipCaptureActivity.EXTRA_APP_NAME, source?.get("label"))
      putExtra(ClipCaptureActivity.EXTRA_PACKAGE, source?.get("packageName"))
    }
    try {
      startActivity(intent)
    } catch (err: Exception) {
      Log.w(TAG, "failed to launch capture activity", err)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Clipboard watch",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps ZeroPaste ready to capture copies from other apps"
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun startAsForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= 34) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("ZeroPaste is ready")
      .setContentText("Watching the clipboard in the background")
      .setSmallIcon(android.R.drawable.ic_menu_agenda)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)

    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val openPi = PendingIntent.getActivity(
        this,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      builder.setContentIntent(openPi)
    }

    val stopIntent = Intent(this, ClipboardWatchService::class.java).setAction(ACTION_STOP)
    val stopPi = PendingIntent.getService(
      this,
      1,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val captureIntent = Intent(this, ClipboardWatchService::class.java).setAction(ACTION_CAPTURE_NOW)
    val capturePi = PendingIntent.getService(
      this,
      2,
      captureIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return builder
      .addAction(0, "Capture now", capturePi)
      .addAction(0, "Stop", stopPi)
      .build()
  }

  companion object {
    private const val TAG = "ClipboardWatch"
    const val CHANNEL_ID = "zeropaste_clipboard_watch"
    const val NOTIFICATION_ID = 7101
    const val ACTION_STOP = "expo.modules.zeropastesource.STOP"
    const val ACTION_CAPTURE_NOW = "expo.modules.zeropastesource.CAPTURE_NOW"

    @Volatile
    var running: Boolean = false
      private set

    var eventSink: ((Map<String, Any?>) -> Unit)? = null

    fun start(context: Context) {
      ClipboardQueue.setEnabled(context, true)
      val intent = Intent(context, ClipboardWatchService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ClipboardWatchService::class.java))
    }

    fun notifyJsCapture(
      context: Context,
      text: String,
      appName: String?,
      packageName: String?,
    ) {
      val payload = mapOf(
        "text" to text,
        "appName" to appName,
        "packageName" to packageName,
        "capturedAt" to System.currentTimeMillis(),
      )
      try {
        eventSink?.invoke(payload)
      } catch (err: Exception) {
        Log.w(TAG, "event sink failed", err)
      }
      // Also broadcast locally in case the module listener was rebound.
      context.sendBroadcast(
        Intent(ACTION_LOCAL_CAPTURE).setPackage(context.packageName).putExtra("payload", text),
      )
    }

    const val ACTION_LOCAL_CAPTURE = "expo.modules.zeropastesource.LOCAL_CAPTURE"
  }
}
