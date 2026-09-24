package com.manabandi.captain.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.manabandi.captain.data.api.CommissionInfo
import kotlin.math.roundToInt

/**
 * The commission rule the owner configured in the web portal, as the server reports it in
 * `CaptainMe.commission` / `Earnings.commission` (percent, free months, free percent and the
 * percent that applies to this captain today). Nothing is hard-coded any more: every trip's
 * real commission comes from the server in `Trip.commission`; [estimate] is only a fallback
 * for an older trip object without it.
 */
object CommissionConfig {

    var info by mutableStateOf<CommissionInfo?>(null)
        private set

    fun update(fetched: CommissionInfo?) {
        if (fetched != null) info = fetched
    }

    /** Percent that applies to this captain right now (0 until the server has told us). */
    val currentPct: Double
        get() = info?.currentPct ?: 0.0

    /** Fallback commission in rupees for a fare, from [currentPct]. */
    fun estimate(fare: Int): Int = (fare * currentPct / 100.0).roundToInt()

    fun reset() {
        info = null
    }
}
