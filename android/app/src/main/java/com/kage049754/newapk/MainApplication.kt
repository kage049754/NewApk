package com.kage049754.newapk

import android.app.Application
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {
    override fun onCreate() {
        super.onCreate()
        // React Native 0.76 merges native libraries; use the merged DSO mapping
        // so HermesExecutor resolves its libraries from libreactnative.so.
        SoLoader.init(this, OpenSourceMergedSoMapping)
    }

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply { add(LectureFilesPackage()); add(ReminderPackage()); add(PlannerWidgetsPackage()); add(BackupPackage()) }

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override fun getJSMainModuleName(): String = "index"
            override val isNewArchEnabled: Boolean = false
            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)
}