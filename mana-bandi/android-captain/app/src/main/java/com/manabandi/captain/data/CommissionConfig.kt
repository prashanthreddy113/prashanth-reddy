package com.manabandi.captain.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.roundToInt

/**
 * A commission rule as configured by the owner in the web portal
 * (Commission page → GET /config/commission?town=&service=&captainId=).
 *
 * @param percent          commission after the free period, 0–30
 * @param freeMonths       months after joining during which [freePercent] applies
 * @param freePercent      commission during the free period (usually 0)
 */
data class CommissionRule(
    val percent: Int,
    val freeMonths: Int,
    val freePercent: Int = 0
)

/**
 * Holds the rule the app last received from the owner portal. Demo: a fixed default that
 * matches the launch offer (0 % for 3 months, then 10 %). Replace [refresh] with the real
 * API call; the rule is per town and per service, and per captain when the owner overrides it.
 */
object CommissionConfig {

    var rule by mutableStateOf(CommissionRule(percent = 10, freeMonths = 3))
        private set

    /** Called after login and on every Home screen visit; the backend returns the current rule. */
    fun refresh(fetched: CommissionRule?) {
        if (fetched != null) rule = fetched
    }

    /** Percent that applies to this captain today. */
    fun rateFor(monthsSinceJoining: Int): Int =
        if (monthsSinceJoining < rule.freeMonths) rule.freePercent else rule.percent

    /** Commission in rupees for one trip (rounded to the nearest rupee). */
    fun commissionFor(fare: Int, monthsSinceJoining: Int): Int =
        (fare * rateFor(monthsSinceJoining) / 100.0).roundToInt()
}
