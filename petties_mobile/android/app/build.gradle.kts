buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // Add Google Services classpath
        classpath("com.google.gms:google-services:4.4.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")  // ✅ ADD THIS LINE - Must be last
}

android {
    namespace = "world.petties.mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "28.2.13676358"  // Fixed version for plugin compatibility

    compileOptions {
        // Enable core library desugaring for flutter_local_notifications
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "world.petties.mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
        manifestPlaceholders["MAP_API_KEY"] = project.findProperty("MAP_API_KEY") as String? ?: ""
    }

    // Flavor configuration for dev/test/prod environments
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            versionNameSuffix = "-dev"
            resValue("string", "app_name", "Petties Dev")
        }
        create("staging") {
            dimension = "environment"
            versionNameSuffix = "-staging"
            resValue("string", "app_name", "Petties Staging")
        }
        create("prod") {
            dimension = "environment"
            resValue("string", "app_name", "Petties")
        }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}

flutter {
    source = "../.."
}
