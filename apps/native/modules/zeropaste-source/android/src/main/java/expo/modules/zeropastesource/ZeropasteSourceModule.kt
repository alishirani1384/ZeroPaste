package expo.modules.zeropastesource

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ZeropasteSourceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZeropasteSource")

    Events("onClipboardCaptured")

    Function("hasUsageAccess") {
      val context = appContext.reactContext ?: return@Function false
      SourceAppHelper.hasUsageAccess(context)
    }

    Function("openUsageAccessSettings") {
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    }

    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val pm = context.getSystemService(PowerManager::class.java) ?: return@Function true
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    @SuppressLint("BatteryLife")
    Function("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val pm = context.getSystemService(PowerManager::class.java)
      if (pm != null && pm.isIgnoringBatteryOptimizations(context.packageName)) {
        return@Function true
      }
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } catch (_: Exception) {
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(fallback)
        true
      }
    }

    Function("getLastForegroundApp") {
      val context = appContext.reactContext ?: return@Function null
      SourceAppHelper.lastForegroundApp(context, excludeSelf = true)
    }

    Function("isClipboardWatchAvailable") {
      true
    }

    Function("isClipboardWatchEnabled") {
      val context = appContext.reactContext ?: return@Function false
      ClipboardQueue.isEnabled(context)
    }

    Function("setClipboardWatchEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@Function false
      ClipboardQueue.setEnabled(context, enabled)
      true
    }

    Function("isClipboardWatchRunning") {
      ClipboardWatchService.running
    }

    AsyncFunction("startClipboardWatch") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      ClipboardWatchService.eventSink = { payload ->
        try {
          sendEvent("onClipboardCaptured", payload)
        } catch (_: Exception) {
          /* JS may be paused */
        }
      }
      ClipboardQueue.setEnabled(context, true)
      ClipboardWatchService.start(context)
      true
    }

    AsyncFunction("stopClipboardWatch") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      ClipboardWatchService.stop(context)
      true
    }

    Function("suppressNextClipboardCapture") {
      val context = appContext.reactContext ?: return@Function false
      ClipboardQueue.suppressNext(context)
      true
    }

    Function("drainPendingCaptures") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any?>>()
      ClipboardQueue.drain(context)
    }

    Function("openNotificationSettings") {
      val context = appContext.reactContext ?: return@Function false
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${context.packageName}")
        }
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }
}
