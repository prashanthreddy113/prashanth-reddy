package com.manabandi.captain.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

const val OTP_LENGTH = 4

/**
 * Four visible digit boxes with one invisible text field on top that receives the digits
 * from the numeric keyboard. Used for the login OTP (40 sp) and the ride OTP (56 sp).
 */
@Composable
fun OtpEntry(
    otp: String,
    onOtpChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    boxWidth: Dp = 68.dp,
    boxHeight: Dp = 84.dp,
    fontSize: TextUnit = 40.sp,
    autoFocus: Boolean = true
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(autoFocus) {
        if (autoFocus) {
            try {
                focusRequester.requestFocus()
            } catch (e: Exception) {
                // focus is a convenience only
            }
        }
    }

    Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            repeat(OTP_LENGTH) { index ->
                OtpBox(
                    digit = otp.getOrNull(index)?.toString() ?: "",
                    active = index == otp.length,
                    width = boxWidth,
                    height = boxHeight,
                    fontSize = fontSize
                )
            }
        }
        BasicTextField(
            value = otp,
            onValueChange = { input ->
                if (input.length <= OTP_LENGTH && input.all { it.isDigit() }) onOtpChange(input)
            },
            modifier = Modifier
                .matchParentSize()
                .alpha(0f)
                .focusRequester(focusRequester),
            textStyle = TextStyle(color = Color.Transparent),
            cursorBrush = SolidColor(Color.Transparent),
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done
            )
        )
    }
}

@Composable
private fun OtpBox(digit: String, active: Boolean, width: Dp, height: Dp, fontSize: TextUnit) {
    val colors = MaterialTheme.colorScheme
    Box(
        modifier = Modifier
            .size(width = width, height = height)
            .background(colors.surfaceVariant, RoundedCornerShape(16.dp))
            .border(
                width = 3.dp,
                color = if (active) colors.primary else colors.outline,
                shape = RoundedCornerShape(16.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(text = digit, fontSize = fontSize, fontWeight = FontWeight.Bold)
    }
}
