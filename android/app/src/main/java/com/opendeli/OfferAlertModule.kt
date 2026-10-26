package com.opendeli

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The little the offer alert needs from Android that no installed library gives
 * (row 58, spec 0003): whether the phone will ring (ringer mode, Do Not Disturb),
 * whether full screen alerts are allowed and the setting that allows them, the sound
 * settings, the offer ring played once, and closing or leaving the alert screen.
 *
 * It only reads settings at the moment it is asked and opens Android's own settings
 * screens. It never changes a setting itself and never sends anything anywhere
 * (value 5): the rider decides.
 *
 * JavaScript reaches it as NativeModules.OfferAlert (src/services/offerPush/phone.ts).
 */
class OfferAlertModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "OfferAlert"

  // The ring playing now. Held here until it finishes: a player kept only in a local
  // variable can be garbage collected, which cuts the sound off after a moment.
  private var ringPlayer: MediaPlayer? = null

  /** { ringerMode: "normal" | "vibrate" | "silent", doNotDisturb: boolean }. */
  // @ReactMethod makes the function callable from JavaScript; its answer comes back
  // through the Promise argument, which JavaScript sees as an ordinary promise.
  @ReactMethod
  fun getRingerState(promise: Promise) {
    try {
      val audio = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notifications =
          reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val ringerMode =
          when (audio.ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> "silent"
            AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
            else -> "normal"
          }
      // Any filter other than "let everything through" means Do Not Disturb is on in
      // some form (priority only, alarms only, total silence).
      val filter = notifications.currentInterruptionFilter
      val doNotDisturb =
          filter != NotificationManager.INTERRUPTION_FILTER_ALL &&
              filter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN
      val result = Arguments.createMap()
      result.putString("ringerMode", ringerMode)
      result.putBoolean("doNotDisturb", doNotDisturb)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("ringer_state_failed", error)
    }
  }

  /**
   * True when an offer may take the whole screen of a locked phone. Android 14 and later
   * let the rider refuse it per app; before that, declaring the permission was enough.
   */
  @ReactMethod
  fun canUseFullScreenAlert(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val notifications =
          reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      promise.resolve(notifications.canUseFullScreenIntent())
    } else {
      promise.resolve(true)
    }
  }

  /** Opens the screen where the rider allows full screen alerts for this app. */
  @ReactMethod
  fun openFullScreenAlertSettings() {
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          Intent(
              Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
              Uri.parse("package:" + reactContext.packageName))
        } else {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
        }
    startSettings(intent)
  }

  /** Opens Android's sound settings, where the rider can turn the ringer back on. */
  @ReactMethod
  fun openSoundSettings() {
    startSettings(Intent(Settings.ACTION_SOUND_SETTINGS))
  }

  /**
   * Plays the offer ring once, for an offer that arrives while the app is open on the
   * offers list (AC-12): the list shows it, so no system alert is posted. Plays only when
   * the ringer is on, as a notification sound would.
   */
  @ReactMethod
  fun playOfferSound() {
    val audio = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (audio.ringerMode != AudioManager.RINGER_MODE_NORMAL) {
      return
    }
    val attributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
    val player =
        MediaPlayer.create(reactContext, R.raw.offer_ring, attributes, audio.generateAudioSessionId())
            ?: return
    // A new ring replaces one still playing.
    ringPlayer?.release()
    ringPlayer = player
    player.setOnCompletionListener {
      it.release()
      if (ringPlayer === it) {
        ringPlayer = null
      }
    }
    player.start()
  }

  /**
   * True while the offer screen is the app's screen in front. React Native calls the app
   * "active" whichever of its screens is in front, so the offers list asks this before it
   * quiets an alert: the rider may be looking at that alert over the lock screen.
   */
  @ReactMethod
  fun isAlertScreenInFront(promise: Promise) {
    promise.resolve(currentActivity is OfferAlertActivity)
  }

  /** Closes the offer screen, if it is the screen in front. */
  @ReactMethod
  fun closeAlertScreen() {
    val activity = currentActivity
    if (activity is OfferAlertActivity) {
      activity.finish()
    }
  }

  /**
   * From the offer screen, opens the app itself. On a locked phone Android first asks the
   * rider to unlock: the rest of the app never shows over the lock screen.
   */
  @ReactMethod
  fun openApp() {
    val activity = currentActivity
    val launch =
        Intent(reactContext, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    if (activity !is OfferAlertActivity) {
      reactContext.startActivity(launch)
      return
    }
    val keyguard = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard.isKeyguardLocked) {
      keyguard.requestDismissKeyguard(
          activity,
          object : KeyguardManager.KeyguardDismissCallback() {
            override fun onDismissSucceeded() {
              activity.startActivity(launch)
              activity.finish()
            }
          })
    } else {
      activity.startActivity(launch)
      activity.finish()
    }
  }

  private fun startSettings(intent: Intent) {
    try {
      reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (error: Exception) {
      // Some phones lack a given settings screen: fall back to the app's own page.
      reactContext.startActivity(
          Intent(
                  Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                  Uri.parse("package:" + reactContext.packageName))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
