package com.manabandi.captain.location

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.manabandi.captain.MainActivity
import com.manabandi.captain.R
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.api.Offer

/**
 * Notification channels and notifications of the captain app:
 * - "tracking" (low importance): the persistent "🟢 Online" notification of [TrackingService]
 *   with a "Go offline" action.
 * - "ride_offers" (high importance): a new ride offer while the app is in the background, with a
 *   full-screen intent that opens the request screen (over the lock screen where allowed).
 * Texts come from a context in the app language (services are not localised by AppCompat on
 * Android 12 and below).
 */
object CaptainNotifications {

    const val CHANNEL_TRACKING = "tracking"
    const val CHANNEL_OFFERS = "ride_offers"
    const val TRACKING_ID = 1001
    const val OFFER_ID = 1002
    const val EXTRA_OPEN_OFFER = "com.manabandi.captain.OPEN_OFFER"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val text = LocalePrefs.localizedContext(context)
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val tracking = NotificationChannel(
            CHANNEL_TRACKING,
            text.getString(R.string.channel_tracking),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            setShowBadge(false)
        }
        // Sound and vibration are played by TrackingService itself (ringtone + buzz + speech),
        // so the channel stays silent to avoid a double alarm.
        val offers = NotificationChannel(
            CHANNEL_OFFERS,
            text.getString(R.string.channel_offers),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannels(listOf(tracking, offers))
    }

    /** Opens the app like the launcher does (brings the running task to the front). */
    private fun openAppIntent(context: Context, requestCode: Int, openOffer: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (openOffer != null) intent.putExtra(EXTRA_OPEN_OFFER, openOffer)
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** The foreground-service notification. On a trip it has no "go offline" action. */
    fun tracking(context: Context, onTrip: Boolean): Notification {
        val text = LocalePrefs.localizedContext(context)
        val builder = NotificationCompat.Builder(context, CHANNEL_TRACKING)
            .setSmallIcon(R.drawable.ic_stat_bandi)
            .setContentTitle(text.getString(if (onTrip) R.string.tracking_notif_trip else R.string.tracking_notif_title))
            .setContentText(text.getString(R.string.tracking_notif_text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent(context, 10, null))
        if (!onTrip) {
            val offline = PendingIntent.getService(
                context,
                11,
                Intent(context, TrackingService::class.java).setAction(TrackingService.ACTION_GO_OFFLINE),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(0, text.getString(R.string.tracking_notif_offline), offline)
        }
        return builder.build()
    }

    /** New ride offer while the app is not visible: heads-up + full-screen intent. */
    fun showOffer(context: Context, offer: Offer, spokenText: String) {
        val text = LocalePrefs.localizedContext(context)
        val open = openAppIntent(context, 12, offer.id)
        val notification = NotificationCompat.Builder(context, CHANNEL_OFFERS)
            .setSmallIcon(R.drawable.ic_stat_bandi)
            .setContentTitle(text.getString(R.string.request_title) + " · ₹" + offer.fare)
            .setContentText(spokenText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(spokenText))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setTimeoutAfter(offer.secondsLeft.coerceAtLeast(1) * 1000L)
            .build()
        notifySafely(context, OFFER_ID, notification)
    }

    fun cancelOffer(context: Context) {
        NotificationManagerCompat.from(context).cancel(OFFER_ID)
    }

    /** Posting needs POST_NOTIFICATIONS on Android 13+; without it we simply skip. */
    @SuppressLint("MissingPermission")
    fun notifySafely(context: Context, id: Int, notification: Notification) {
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        try {
            manager.notify(id, notification)
        } catch (e: SecurityException) {
            // permission revoked meanwhile
        }
    }
}
