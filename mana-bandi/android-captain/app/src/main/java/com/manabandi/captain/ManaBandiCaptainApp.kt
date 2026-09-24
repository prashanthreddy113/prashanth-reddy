package com.manabandi.captain

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.data.SessionStore
import com.manabandi.captain.data.api.RideStatus
import com.manabandi.captain.location.TrackingRepository
import com.manabandi.captain.ui.screens.CollectScreen
import com.manabandi.captain.ui.screens.DeliverScreen
import com.manabandi.captain.ui.screens.EarningsScreen
import com.manabandi.captain.ui.screens.EnterOtpScreen
import com.manabandi.captain.ui.screens.HelpScreen
import com.manabandi.captain.ui.screens.HomeScreen
import com.manabandi.captain.ui.screens.KycScreen
import com.manabandi.captain.ui.screens.LanguageScreen
import com.manabandi.captain.ui.screens.OnTripScreen
import com.manabandi.captain.ui.screens.OtpScreen
import com.manabandi.captain.ui.screens.PhoneScreen
import com.manabandi.captain.ui.screens.RequestScreen
import com.manabandi.captain.ui.screens.TermsScreen
import com.manabandi.captain.ui.screens.ToPickupScreen

object Routes {
    const val LANGUAGE = "language"
    const val PHONE = "phone"
    const val OTP = "otp"
    const val TERMS = "terms"
    const val KYC = "kyc"
    const val HOME = "home"
    const val REQUEST = "request"
    const val TO_PICKUP = "to_pickup"
    const val ENTER_OTP = "enter_otp"
    const val ON_TRIP = "on_trip"
    const val DELIVER = "deliver"
    const val COLLECT = "collect"
    const val EARNINGS = "earnings"
    const val HELP = "help"

    /** Screens that work without a login. */
    val PUBLIC = setOf(LANGUAGE, PHONE, OTP)

    /** Screens of a running trip. */
    val TRIP = setOf(TO_PICKUP, ENTER_OTP, ON_TRIP, DELIVER, COLLECT)

    /** Where a new offer may pop up (not during login, KYC or a trip). */
    val OFFER_OK = setOf(HOME, EARNINGS, HELP)
}

@Composable
fun ManaBandiCaptainApp(startDestination: String, prefs: LocalePrefs, session: SessionStore) {
    val context = LocalContext.current
    val navController = rememberNavController()
    val vm: CaptainViewModel = viewModel()
    val currentSession by session.session.collectAsState()
    val loggedIn = currentSession != null
    val kycDone by prefs.kycDone.collectAsState(initial = false)
    val termsAccepted by prefs.termsAccepted.collectAsState(initial = false)
    val tracking by TrackingRepository.state.collectAsState()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Token cleared (401 from the server or logout): back to the phone screen.
    LaunchedEffect(loggedIn) {
        if (!loggedIn) {
            val route = navController.currentDestination?.route
            if (route != null && route !in Routes.PUBLIC) {
                navController.navigate(Routes.PHONE) {
                    popUpTo(0) { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
    }

    // The trip drives the screens: accepted → pickup, arrived → OTP, started → on trip
    // (or delivery proof), finished → collect; no trip any more → Home.
    val trip = tracking.trip
    val tripRoute = when (trip?.status) {
        RideStatus.ACCEPTED -> Routes.TO_PICKUP
        RideStatus.ARRIVED -> Routes.ENTER_OTP
        RideStatus.STARTED -> Routes.ON_TRIP
        RideStatus.FINISHED -> Routes.COLLECT
        else -> null
    }
    LaunchedEffect(tripRoute, trip?.rideId, currentRoute) {
        val current = currentRoute ?: return@LaunchedEffect
        if (current in Routes.PUBLIC || current == Routes.TERMS || current == Routes.KYC || current == Routes.LANGUAGE) {
            return@LaunchedEffect
        }
        if (tripRoute != null) {
            val allowed = if (tripRoute == Routes.ON_TRIP) setOf(Routes.ON_TRIP, Routes.DELIVER) else setOf(tripRoute)
            if (current !in allowed) navController.navigateStep(tripRoute)
        } else if (current in Routes.TRIP) {
            navController.popBackStack(Routes.HOME, inclusive = false)
        }
    }

    // A new offer from the heartbeat opens the request screen.
    val offerId = tracking.offer?.id
    LaunchedEffect(offerId, currentRoute) {
        if (offerId != null && trip == null && currentRoute != null && currentRoute in Routes.OFFER_OK) {
            navController.navigate(Routes.REQUEST) { launchSingleTop = true }
        }
    }

    // One-shot messages: offer expired / taken, rider cancelled.
    val message = vm.message
    LaunchedEffect(message) {
        if (message != null) {
            Toast.makeText(context, context.getString(message), Toast.LENGTH_LONG).show()
            vm.consumeMessage()
        }
    }
    LaunchedEffect(tracking.tripEndedByOther) {
        if (tracking.tripEndedByOther) {
            Toast.makeText(context, context.getString(R.string.trip_ended_by_rider), Toast.LENGTH_LONG).show()
            TrackingRepository.consumeTripEndedNotice()
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(Routes.LANGUAGE) {
            LanguageScreen(
                onLanguageChosen = { tag ->
                    // Navigate first so the restored back stack is right after the
                    // locale-change recreation, then persist + apply the language.
                    val next = when {
                        !loggedIn -> Routes.PHONE
                        !termsAccepted -> Routes.TERMS
                        !kycDone -> Routes.KYC
                        else -> Routes.HOME
                    }
                    navController.navigate(next) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                    vm.chooseLanguage(tag)
                }
            )
        }

        composable(Routes.PHONE) {
            PhoneScreen(
                busy = vm.authBusy,
                error = vm.authError,
                onNext = { phone ->
                    vm.phone = phone
                    vm.requestOtp(channel = "sms") {
                        navController.navigate(Routes.OTP) { launchSingleTop = true }
                    }
                }
            )
        }

        composable(Routes.OTP) {
            OtpScreen(
                phone = vm.phone,
                devCode = vm.devCode,
                busy = vm.authBusy,
                error = vm.authError,
                onBack = {
                    vm.clearAuthError()
                    navController.popBackStack()
                },
                onVerify = { code ->
                    vm.verifyOtp(code) { accepted, needsKyc ->
                        // First login: terms, then the KYC checklist.
                        val next = when {
                            !accepted -> Routes.TERMS
                            needsKyc -> Routes.KYC
                            else -> Routes.HOME
                        }
                        navController.navigate(next) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
                onCallMe = { vm.requestOtp(channel = "call") {} }
            )
        }

        composable(Routes.TERMS) {
            TermsScreen(
                busy = vm.termsBusy,
                error = vm.termsError,
                version = vm.termsVersionToShow,
                onAccept = {
                    vm.acceptTerms {
                        val me = vm.me
                        val needsKyc = if (me != null) vm.kycIncomplete(me) else !kycDone
                        navController.navigate(if (needsKyc) Routes.KYC else Routes.HOME) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Routes.KYC) {
            KycScreen(
                vm = vm,
                onDone = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            LaunchedEffect(Unit) { vm.resumeOnStart() }
            HomeScreen(
                vm = vm,
                onKyc = { navController.navigate(Routes.KYC) },
                onEarnings = { navController.navigateTab(Routes.EARNINGS) },
                onHelp = { navController.navigateTab(Routes.HELP) }
            )
        }

        composable(Routes.REQUEST) {
            RequestScreen(
                vm = vm,
                onDismiss = { navController.popBackStack(Routes.HOME, inclusive = false) }
            )
        }

        composable(Routes.TO_PICKUP) {
            ToPickupScreen(
                vm = vm,
                onCancelled = { navController.popBackStack(Routes.HOME, inclusive = false) }
            )
        }

        composable(Routes.ENTER_OTP) {
            EnterOtpScreen(vm = vm)
        }

        composable(Routes.ON_TRIP) {
            OnTripScreen(
                vm = vm,
                onDeliver = { navController.navigateStep(Routes.DELIVER) }
            )
        }

        composable(Routes.DELIVER) {
            DeliverScreen(vm = vm)
        }

        composable(Routes.COLLECT) {
            CollectScreen(
                vm = vm,
                onDone = { navController.popBackStack(Routes.HOME, inclusive = false) }
            )
        }

        composable(Routes.EARNINGS) {
            EarningsScreen(
                vm = vm,
                onHome = { navController.navigateTab(Routes.HOME) },
                onHelp = { navController.navigateTab(Routes.HELP) }
            )
        }

        composable(Routes.HELP) {
            HelpScreen(
                onHome = { navController.navigateTab(Routes.HOME) },
                onEarnings = { navController.navigateTab(Routes.EARNINGS) },
                onChangeLanguage = { navController.navigate(Routes.LANGUAGE) },
                onLogout = {
                    vm.logout {
                        navController.navigate(Routes.PHONE) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }
    }
}

/** Bottom-tab navigation: one copy of each tab, Home stays at the root. */
private fun NavHostController.navigateTab(route: String) {
    navigate(route) {
        popUpTo(Routes.HOME) { inclusive = false }
        launchSingleTop = true
    }
}

/** Trip steps replace each other above Home, so Back always returns to Home, never to a finished step. */
private fun NavHostController.navigateStep(route: String) {
    navigate(route) {
        popUpTo(Routes.HOME) { inclusive = false }
        launchSingleTop = true
    }
}
