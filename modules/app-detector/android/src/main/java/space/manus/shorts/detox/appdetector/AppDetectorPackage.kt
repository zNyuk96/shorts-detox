package space.manus.shorts.detox.appdetector

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.BasePackage

class AppDetectorPackage : BasePackage() {
  override fun createModules(): List<Module> = listOf(AppDetectorModule())
}
