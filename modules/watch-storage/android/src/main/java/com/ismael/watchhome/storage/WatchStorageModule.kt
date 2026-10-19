package com.ismael.watchhome.storage

import android.content.Context
import android.net.Uri
import android.os.Environment
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class WatchStorageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WatchStorage")

    OnCreate {
      initializeAppSpecificStorage()
    }

    AsyncFunction("initializeAsync") {
      initializeAppSpecificStorage()
    }

    AsyncFunction("inspectAsync") {
      inspectStorage()
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun fileUri(file: File?): String? =
    file?.let { Uri.fromFile(it).toString().trimEnd('/') + "/" }

  private fun externalStorageState(file: File?): String =
    file?.let { Environment.getExternalStorageState(it) } ?: Environment.MEDIA_UNKNOWN

  private fun initializeAppSpecificStorage(): Map<String, Any?> {
    val externalRoot = context.getExternalFilesDir(null)
    val storageState = externalStorageState(externalRoot)
    val mounted = storageState == Environment.MEDIA_MOUNTED
    val directoryNames = listOf("photos", "music", "downloads", "other")
    val directories = mutableMapOf<String, String>()
    var initialized = mounted && externalRoot != null

    if (initialized && externalRoot != null) {
      initialized = externalRoot.isDirectory || externalRoot.mkdirs()
      directoryNames.forEach { name ->
        val directory = File(externalRoot, name)
        val created = directory.isDirectory || directory.mkdirs()
        if (created) {
          directories[name] = requireNotNull(fileUri(directory))
        } else {
          initialized = false
        }
      }
    }

    return storageResult(externalRoot, directories, storageState, initialized)
  }

  private fun inspectStorage(): Map<String, Any?> {
    val externalRoot = context.getExternalFilesDir(null)
    val directories = listOf("photos", "music", "downloads", "other")
      .mapNotNull { name ->
        val directory = externalRoot?.let { File(it, name) }
        if (directory?.isDirectory == true) name to requireNotNull(fileUri(directory)) else null
      }
      .toMap()
    return storageResult(
      externalRoot,
      directories,
      externalStorageState(externalRoot),
      externalRoot?.isDirectory == true && directories.size == 4
    )
  }

  private fun storageResult(
    externalRoot: File?,
    directories: Map<String, String>,
    storageState: String,
    initialized: Boolean
  ): Map<String, Any?> {
    val obbDirectory = context.obbDir
    val obbState = externalStorageState(obbDirectory)
    return mapOf(
      "applicationId" to context.packageName,
      "externalFiles" to mapOf(
        "available" to (externalRoot != null && storageState == Environment.MEDIA_MOUNTED),
        "initialized" to initialized,
        "exists" to (externalRoot?.isDirectory == true),
        "uri" to fileUri(externalRoot),
        "path" to externalRoot?.absolutePath,
        "state" to storageState,
        "directories" to directories
      ),
      "obb" to mapOf(
        "available" to (obbDirectory != null && obbState == Environment.MEDIA_MOUNTED),
        "exists" to (obbDirectory?.isDirectory == true),
        "uri" to fileUri(obbDirectory),
        "path" to obbDirectory?.absolutePath,
        "state" to obbState,
        "initialized" to false,
        "purpose" to "apk-expansion-files-only"
      )
    )
  }
}
