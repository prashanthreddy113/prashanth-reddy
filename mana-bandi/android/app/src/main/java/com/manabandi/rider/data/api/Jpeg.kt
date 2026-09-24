package com.manabandi.rider.data.api

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/** Photo uploads: longest side at most [maxSide] px, JPEG quality [quality]. */
object Jpeg {
    fun compress(bitmap: Bitmap, maxSide: Int = 1600, quality: Int = 85): ByteArray {
        val longest = max(bitmap.width, bitmap.height)
        val scaled = if (longest > maxSide) {
            val ratio = maxSide.toFloat() / longest
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * ratio).roundToInt().coerceAtLeast(1),
                (bitmap.height * ratio).roundToInt().coerceAtLeast(1),
                true
            )
        } else {
            bitmap
        }
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        if (scaled !== bitmap) scaled.recycle()
        return out.toByteArray()
    }
}
