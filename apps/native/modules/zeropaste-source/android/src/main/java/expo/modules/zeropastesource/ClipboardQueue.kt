package expo.modules.zeropastesource

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Small pending-capture queue so clips survive when JS is paused. */
object ClipboardQueue {
  private const val PREFS = "zeropaste_clipboard_watch"
  private const val KEY_QUEUE = "pending"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_SUPPRESS_UNTIL = "suppress_until"
  private const val MAX = 40

  fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ENABLED, true)

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun suppressNext(context: Context, ms: Long = 2500L) {
    prefs(context).edit().putLong(KEY_SUPPRESS_UNTIL, System.currentTimeMillis() + ms).apply()
  }

  fun isSuppressed(context: Context): Boolean =
    System.currentTimeMillis() < prefs(context).getLong(KEY_SUPPRESS_UNTIL, 0L)

  fun enqueue(
    context: Context,
    text: String,
    appName: String?,
    packageName: String?,
  ) {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return
    val arr = JSONArray(prefs(context).getString(KEY_QUEUE, "[]"))
    // Dedup consecutive identical bodies.
    if (arr.length() > 0) {
      val last = arr.getJSONObject(arr.length() - 1)
      if (last.optString("text") == trimmed) return
    }
    val obj = JSONObject()
      .put("text", trimmed)
      .put("appName", appName ?: "")
      .put("packageName", packageName ?: "")
      .put("capturedAt", System.currentTimeMillis())
    arr.put(obj)
    while (arr.length() > MAX) {
      arr.remove(0)
    }
    prefs(context).edit().putString(KEY_QUEUE, arr.toString()).apply()
  }

  fun drain(context: Context): List<Map<String, Any?>> {
    val raw = prefs(context).getString(KEY_QUEUE, "[]") ?: "[]"
    prefs(context).edit().putString(KEY_QUEUE, "[]").apply()
    val arr = JSONArray(raw)
    val out = ArrayList<Map<String, Any?>>(arr.length())
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      out.add(
        mapOf(
          "text" to o.optString("text"),
          "appName" to o.optString("appName").ifEmpty { null },
          "packageName" to o.optString("packageName").ifEmpty { null },
          "capturedAt" to o.optLong("capturedAt"),
        ),
      )
    }
    return out
  }
}
