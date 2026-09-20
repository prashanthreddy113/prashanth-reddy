package com.manabandi.captain.ui.components

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import com.manabandi.captain.R

/**
 * 📷 button that asks for the CAMERA permission (declared in the manifest, so it must be
 * granted before ACTION_IMAGE_CAPTURE) and then takes a small preview-size photo.
 * Demo: the bitmap stays in memory, nothing is uploaded.
 */
@Composable
fun PhotoButton(
    label: String,
    onPhoto: (Bitmap) -> Unit,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
    primary: Boolean = false
) {
    val context = LocalContext.current
    val cameraUnavailable = stringResource(R.string.camera_unavailable)

    val photoLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) onPhoto(bitmap)
    }
    val launchCamera: () -> Unit = {
        try {
            photoLauncher.launch(null)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(context, cameraUnavailable, Toast.LENGTH_LONG).show()
        }
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchCamera() else Toast.makeText(context, cameraUnavailable, Toast.LENGTH_LONG).show()
    }
    val onClick: () -> Unit = {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (granted) launchCamera() else permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    if (primary) {
        BigButton(text = label, emoji = "📷", onClick = onClick, modifier = modifier, containerColor = color)
    } else {
        SecondaryButton(text = label, emoji = "📷", onClick = onClick, modifier = modifier, color = color)
    }
}
