package com.manabandi.rider

import androidx.compose.runtime.Composable
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

    fun book(service: Service) = "book/${service.name}"
}

@Composable
fun ManaBandiApp(startDestination: String, prefs: LocalePrefs) {
    val navController = rememberNavController()
    val vm: RideViewModel = viewModel()
    val loggedIn by prefs.loggedIn.collectAsState(initial = false)
    val termsAccepted by prefs.termsAccepted.collectAsState(initial = false)

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
                onNext = { phone ->
                    vm.phone = phone
                    navController.navigate(Routes.OTP)
                }
            )
        }

        composable(Routes.OTP) {
            OtpScreen(
                phone = vm.phone,
                onBack = { navController.popBackStack() },
                onVerified = {
                    vm.login(vm.phone)
                    navController.navigate(if (termsAccepted) Routes.HOME else Routes.TERMS) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.TERMS) {
            TermsScreen(
                onAccept = {
                    vm.acceptTerms()
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                onService = { service ->
                    vm.startBooking(service)
                    if (service == Service.PARCEL) {
                        navController.navigate(Routes.PARCEL)
                    } else {
                        navController.navigate(Routes.book(service))
                    }
                },
                onPlace = { label ->
                    vm.startBooking(Service.BIKE, presetDrop = label)
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
                onBook = { navController.navigate(Routes.FINDING) }
            )
        }

        composable(Routes.PARCEL) {
            ParcelScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
                onConfirm = { navController.navigate(Routes.FINDING) }
            )
        }

        composable(Routes.FINDING) {
            FindingCaptainScreen(
                vm = vm,
                onFound = {
                    navController.navigate(Routes.RIDE) {
                        popUpTo(Routes.HOME) { inclusive = false }
                    }
                },
                onCancel = {
                    vm.clearRide()
                    navController.popBackStack(Routes.HOME, inclusive = false)
                }
            )
        }

        composable(Routes.RIDE) {
            RideScreen(
                vm = vm,
                onDone = {
                    vm.clearRide()
                    navController.popBackStack(Routes.HOME, inclusive = false)
                }
            )
        }

        composable(Routes.RIDES) {
            MyRidesScreen(
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
