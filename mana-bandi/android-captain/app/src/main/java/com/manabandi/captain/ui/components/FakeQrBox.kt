package com.manabandi.captain.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.random.Random

private const val CELLS = 21

/**
 * Placeholder QR: a 21x21 grid of black squares from a fixed seed, with the three
 * finder squares in the corners so it reads as "a QR code". Replace with a real UPI
 * QR (upi://pay?...) once payments exist.
 */
@Composable
fun FakeQrBox(modifier: Modifier = Modifier, seed: Int = 45) {
    val pattern = remember(seed) {
        val random = Random(seed)
        BooleanArray(CELLS * CELLS) { random.nextBoolean() }
    }
    Canvas(
        modifier = modifier
            .aspectRatio(1f)
            .background(Color.White, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        val cell = size.minDimension / CELLS
        for (row in 0 until CELLS) {
            for (col in 0 until CELLS) {
                val black = finderCell(row, col) ?: pattern[row * CELLS + col]
                if (black) {
                    drawRect(
                        color = Color.Black,
                        topLeft = Offset(col * cell, row * cell),
                        size = Size(cell, cell)
                    )
                }
            }
        }
    }
}

/** Returns the colour of a finder-pattern cell, or null when (row, col) is outside the three corners. */
private fun finderCell(row: Int, col: Int): Boolean? {
    val top = row < 7
    val bottom = row >= CELLS - 7
    val left = col < 7
    val right = col >= CELLS - 7
    if (!((top && left) || (top && right) || (bottom && left))) return null
    val r = if (top) row else row - (CELLS - 7)
    val c = if (left) col else col - (CELLS - 7)
    return r == 0 || r == 6 || c == 0 || c == 6 || (r in 2..4 && c in 2..4)
}
