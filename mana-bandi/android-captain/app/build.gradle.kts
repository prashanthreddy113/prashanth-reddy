import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Backend base URL. Debug talks to the emulator's host (10.0.2.2), release to production.
// Testers can point a real phone at a laptop on the same Wi-Fi without editing code:
//   local.properties:      manabandi.apiBaseUrl=http://192.168.1.20:5080
//   or on the command line: ./gradlew :app:assembleDebug -Pmanabandi.apiBaseUrl=http://192.168.1.20:5080
// The override applies to both build types; release builds only allow https (see
// src/main/res/xml/network_security_config.xml).
val localProps = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val apiBaseUrlOverride: String? =
    (project.findProperty("manabandi.apiBaseUrl") as String?)
        ?: localProps.getProperty("manabandi.apiBaseUrl")

fun apiUrlField(default: String): String = "\"" + (apiBaseUrlOverride ?: default).trimEnd('/') + "\""

android {
    // `in` is a Kotlin keyword, so the Kotlin package is com.manabandi.captain
    // while the store / install id stays in.manabandi.captain.
    namespace = "com.manabandi.captain"
    compileSdk = 35

    defaultConfig {
        applicationId = "in.manabandi.captain"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", apiUrlField("http://10.0.2.2:5080"))
        }
        release {
            buildConfigField("String", "API_BASE_URL", apiUrlField("https://api.manabandi.in"))
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)

    // Backend + GPS + maps
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)
    implementation(libs.play.services.location)
    implementation(libs.osmdroid.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
