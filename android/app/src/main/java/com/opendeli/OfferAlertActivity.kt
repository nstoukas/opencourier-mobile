package com.opendeli

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * The screen an offer alert opens (row 58, spec 0003): over the lock screen when the
 * phone is locked (the full screen alert), or on top of the app when the rider taps the
 * alert. It draws only the React component "OfferAlert", which shows the offer card's
 * facts from the push message itself. It is a separate activity from MainActivity on
 * purpose: only this one may show over the lock screen, so nobody holding a locked
 * phone can reach the rest of the app (earnings, a customer's address on a job).
 */
class OfferAlertActivity : ReactActivity() {

  override fun getMainComponentName(): String = "OfferAlert"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // The manifest sets showWhenLocked and turnScreenOn, which Android reads from
    // version 8.1 (API 27). Older phones need the same as window flags.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
      @Suppress("DEPRECATION")
      window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
              WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
  }
}
