package expo.modules.zeropastesource

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process

object SourceAppHelper {
  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
      ?: return false
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /** Last non-self app that was in the foreground (best-effort source for a copy). */
  fun lastForegroundApp(context: Context, excludeSelf: Boolean = true): Map<String, String>? {
    if (!hasUsageAccess(context)) return null
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: return null

    val end = System.currentTimeMillis()
    val begin = end - 60_000L
    val events = usm.queryEvents(begin, end)
    val event = UsageEvents.Event()
    var lastPkg: String? = null
    var lastClass: String? = null
    val self = context.packageName
    val resumeType =
      if (Build.VERSION.SDK_INT >= 29) UsageEvents.Event.ACTIVITY_RESUMED else -1

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val isFg =
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
          event.eventType == resumeType
      if (!isFg) continue
      val pkg = event.packageName ?: continue
      if (excludeSelf && pkg == self) continue
      if (pkg.startsWith("com.android.systemui")) continue
      if (pkg.contains("launcher", ignoreCase = true)) continue
      lastPkg = pkg
      lastClass = event.className
    }

    val packageName = lastPkg ?: return null
    val label = try {
      val pm = context.packageManager
      val ai: ApplicationInfo = pm.getApplicationInfo(packageName, 0)
      pm.getApplicationLabel(ai).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      packageName.substringAfterLast('.').replaceFirstChar { it.uppercase() }
    }

    return mapOf(
      "label" to label,
      "packageName" to packageName,
      "className" to (lastClass ?: ""),
    )
  }

  fun isOurAppForeground(context: Context): Boolean {
    if (!hasUsageAccess(context)) return false
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: return false
    val end = System.currentTimeMillis()
    val begin = end - 5_000L
    val events = usm.queryEvents(begin, end)
    val event = UsageEvents.Event()
    var lastPkg: String? = null
    val self = context.packageName
    val resumeType =
      if (Build.VERSION.SDK_INT >= 29) UsageEvents.Event.ACTIVITY_RESUMED else -1

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val isFg =
        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
          event.eventType == resumeType
      if (!isFg) continue
      lastPkg = event.packageName
    }
    return lastPkg == self
  }
}
