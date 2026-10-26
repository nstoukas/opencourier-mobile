package com.opendeli

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Hands OfferAlertModule to React Native (added by hand in MainApplication). */
class OfferAlertPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(OfferAlertModule(context))

  override fun createViewManagers(
      context: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
