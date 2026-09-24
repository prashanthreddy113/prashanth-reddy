package com.manabandi.rider

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.manabandi.rider.data.LocalePrefs
import com.manabandi.rider.data.Service
import com.manabandi.rider.data.SessionStore
import com.manabandi.rider.data.api.RideStatus
import com.manabandi.rider.ui.screens.BookRideScreen
import com.manabandi.rider.ui.screens.FindingCaptainScreen
import com.manabandi.rider.ui.screens.HelpScreen
import com.manabandi.rider.ui.screens.HomeScreen
import com.manabandi.rider.ui.screens.LanguageScreen
import com.manabandi.rider.ui.screens.MyRidesScreen
import com.manabandi.rider.ui.screens.OtpScreen
import com.manabandi.rider.ui.screens.ParcelScreen
import com.manabandi.rider.ui.screens.PhoneScreen
import com.manabandi.rider.ui.screens.RideScreen
import com.manabandi.rider.ui.screens.TermsScreen

object Routes {
    const val LANGUAGE = "language"
    const val PHONE = "phone"
    const val OTP = "otp"
    const val TERMS = "terms"
    const val HOME = "home"
    const val BOOK = "book/{service}"
    const val FINDING = "finding"
    const val RIDE = "ride"
    const val PARCEL = "parcel"
    const val RIDES = "rides"
    const val HELP = "help"

    /** Screens that work without a login. */
    val PUBLIC = setOf(LANGUAGE, PHONE, OTP)

    fun book(service: Service) = "book/${service.name}"
}

@Composable
fun ManaBandiApp(startDestination: String, prefs: LocalePrefs, session: SessionStore) {
    val navController = rememberNavController()
    val vm: RideViewModel = viewModel()
    val currentSession by session.session.collectAsState()
    val loggedIn = currentSession != null
    val termsAccepted by prefs.termsAccepted.collectAsState(initial = false)

    // Token cleared (401 from the server): back to the phone screen.
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

    val goToTerms: () -> Unit = {
        navController.navigate(Routes.TERMS) { launchSingleTop = true }
    }
    val openActiveRide: () -> Unit = {
        val status = vm.ride?.status
        val route = if (status == RideStatus.SEARCHING || status == RideStatus.NO_CAPTAIN) Routes.FINDING else Routes.RIDE
        navController.navigate(route) {
            popUpTo(Routes.HOME) { inclusive = false }
            launchSingleTop = true
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
                    vm.verifyOtp(code) { accepted ->
                        navController.navigate(if (accepted) Routes.HOME else Routes.TERMS) {
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
                        navController.navigate(Routes.HOME) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            LaunchedEffect(Unit) {
                vm.refreshTownQuietly()
                // Resume a ride that was running when the app was closed (GET /api/rides/active).
                vm.resumeActiveRide { openActiveRide() }
            }
            HomeScreen(
                userName = currentSession?.user?.name,
                landmarks = vm.landmarks,
                onService = { service ->
                    vm.startBooking(service)
                    if (service == Service.PARCEL) {
                        navController.navigate(Routes.PARCEL)
                    } else {
                        navController.navigate(Routes.book(service))
                    }
                },
                onPlace = { landmark ->
                    vm.startBooking(Service.BIKE, presetDrop = landmark)
                    navController.navigate(Routes.book(Service.BIKE))
                },
                onRides = { navController.navigateTab(Routes.RIDES) },
                onHelp = { navController.navigateTab(Routes.HELP) }
            )
        }

        composable(
            route = Routes.BOOK,
            arguments = listOf(navArgument("service") { type = NavType.StringType })
        ) { entry ->
            val name = entry.arguments?.getString("service") ?: Service.BIKE.name
            val service = runCatching { Service.valueOf(name) }.getOrDefault(Service.BIKE)
            BookRideScreen(
                vm = vm,
                service = service,
                onBack = { navController.popBackStack() },
                onBooked = {
                    navController.navigate(Routes.FINDING) {
                        popUpTo(Routes.HOME) { inclusive = false }
                    }
                },
                onTermsRequired = goToTerms
            )
        }

        composable(Routes.PARCEL) {
            ParcelScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
                onConfirm = {
                    navController.navigate(Routes.FINDING) {
                        popUpTo(Routes.HOME) { inclusive = false }
                    }
                },
                onTermsRequired = goToTerms
            )
        }

        composable(Routes.FINDING) {
            FindingCaptainScreen(
                vm = vm,
                onAccepted = {
                    navController.navigate(Routes.RIDE) {
                        popUpTo(Routes.HOME) { inclusive = false }
                        launchSingleTop = true
                    }
                },
                onHome = { navController.popBackStack(Routes.HOME, inclusive = false) },
                onTermsRequired = goToTerms
            )
        }

        composable(Routes.RIDE) {
            RideScreen(
                vm = vm,
                onHome = { navController.popBackStack(Routes.HOME, inclusive = false) },
                onBackToFinding = {
                    navController.navigate(Routes.FINDING) {
                        popUpTo(Routes.HOME) { inclusive = false }
                        launchSingleTop = true
                    }
                }
            )
        }

        composable(Routes.RIDES) {
            MyRidesScreen(
                vm = vm,
                onHome = { navController.navigateTab(Routes.HOME) },
                onHelp = { navController.navigateTab(Routes.HELP) }
            )
        }

        composable(Routes.HELP) {
            HelpScreen(
                onHome = { navController.navigateTab(Routes.HOME) },
                onRides = { navController.navigateTab(Routes.RIDES) },
                onChangeLanguage = { navController.navigate(Routes.LANGUAGE) }
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
