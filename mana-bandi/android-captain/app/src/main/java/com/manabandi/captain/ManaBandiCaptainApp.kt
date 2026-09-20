package com.manabandi.captain

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.manabandi.captain.data.LocalePrefs
import com.manabandi.captain.ui.screens.CollectScreen
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
    const val COLLECT = "collect"
    const val EARNINGS = "earnings"
    const val HELP = "help"
}

@Composable
fun ManaBandiCaptainApp(startDestination: String, prefs: LocalePrefs) {
    val navController = rememberNavController()
    val vm: CaptainViewModel = viewModel()
    val loggedIn by prefs.loggedIn.collectAsState(initial = false)
    val kycDone by prefs.kycDone.collectAsState(initial = false)
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
                    // First login: terms, then the KYC checklist once.
                    val next = when {
                        !termsAccepted -> Routes.TERMS
                        !kycDone -> Routes.KYC
                        else -> Routes.HOME
                    }
                    navController.navigate(next) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.TERMS) {
            TermsScreen(
                onAccept = {
                    vm.acceptTerms()
                    navController.navigate(if (kycDone) Routes.HOME else Routes.KYC) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.KYC) {
            KycScreen(
                vm = vm,
                onDone = {
                    vm.submitKyc()
                    navController.navigate(Routes.HOME) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                vm = vm,
                onRequest = { navController.navigate(Routes.REQUEST) },
                onEarnings = { navController.navigateTab(Routes.EARNINGS) },
                onHelp = { navController.navigateTab(Routes.HELP) }
            )
        }

        composable(Routes.REQUEST) {
            RequestScreen(
                vm = vm,
                onAccept = {
                    vm.acceptRequest()
                    navController.navigateStep(Routes.TO_PICKUP)
                },
                onDismiss = {
                    vm.rejectRequest()
                    navController.popBackStack(Routes.HOME, inclusive = false)
                }
            )
        }

        composable(Routes.TO_PICKUP) {
            ToPickupScreen(
                vm = vm,
                onArrived = { navController.navigateStep(Routes.ENTER_OTP) }
            )
        }

        composable(Routes.ENTER_OTP) {
            EnterOtpScreen(
                vm = vm,
                onStarted = { navController.navigateStep(Routes.ON_TRIP) }
            )
        }

        composable(Routes.ON_TRIP) {
            OnTripScreen(
                vm = vm,
                onFinish = { navController.navigateStep(Routes.COLLECT) }
            )
        }

        composable(Routes.COLLECT) {
            CollectScreen(
                vm = vm,
                onDone = {
                    vm.finishTrip()
                    navController.popBackStack(Routes.HOME, inclusive = false)
                }
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

/** Trip steps replace each other above Home, so Back always returns to Home, never to a finished step. */
private fun NavHostController.navigateStep(route: String) {
    navigate(route) {
        popUpTo(Routes.HOME) { inclusive = false }
        launchSingleTop = true
    }
}
