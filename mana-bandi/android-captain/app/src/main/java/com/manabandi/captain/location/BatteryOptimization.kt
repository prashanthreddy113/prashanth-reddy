package com.manabandi.captain.location

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Helpers for phones that kill background apps (Xiaomi / Redmi / POCO, Realme / OPPO,
 * Vivo / iQOO, …). A killed captain app stops sending its location and gets no rides.
 *
 * - [openBatterySettings]: asks Android to stop battery-optimising this app (one system
 *   dialog), falling back to the battery-optimisation list or the app's settings page.
 * - [openAutoStart]: the maker's own "Autostart" / "Background start" screen where it exists.
 */
object BatteryOptimization {

    private val AGGRESSIVE_MAKERS = setOf(
        "xiaomi", "redmi", "poco", "realme", "oppo", "oneplus", "vivo", "iqoo", "huawei", "honor", "tecno", "infinix"
    )

    /** Known maker screens for "allow auto-start / background activity". */
    private val AUTO_START_SCREENS = listOf(
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
    )

    /** Phone brands known to kill background apps. */
    val isAggressiveMaker: Boolean
        get() = Build.MANUFACTURER.lowercase() in AGGRESSIVE_MAKERS || Build.BRAND.lowercase() in AGGRESSIVE_MAKERS

    /** True when Android already lets this app run in the background without battery limits. */
    fun isIgnoringOptimizations(context: Context): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    @SuppressLint("BatteryLife")
    fun openBatterySettings(context: Context) {
        if (!isIgnoringOptimizations(context)) {
            val ask = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + context.packageName))
            if (tryStart(context, ask)) return
        }
        if (tryStart(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) return
        tryStart(
            context,
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
        )
    }

    /** Opens the maker's auto-start screen; returns false when this phone has none we know. */
    fun openAutoStart(context: Context): Boolean {
        for (component in AUTO_START_SCREENS) {
            if (tryStart(context, Intent().setComponent(component))) return true
        }
        return false
    }

    private fun tryStart(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }
}
