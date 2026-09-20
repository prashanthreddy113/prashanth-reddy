package com.manabandi.captain.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.manabandi.captain.CaptainViewModel
import com.manabandi.captain.R
import com.manabandi.captain.ui.components.BigButton
import com.manabandi.captain.ui.components.CallButton
import com.manabandi.captain.ui.components.NavigateButton
import com.manabandi.captain.ui.components.SpeakTopBar
import com.manabandi.captain.ui.theme.GreenLight

/** Go to the rider: fake map, rider card, 📞 call, 🧭 navigate, ✅ I have arrived. */
@Composable
fun ToPickupScreen(vm: CaptainViewModel, onArrived: () -> Unit) {
    val request = vm.request ?: return
    val pickupName = stringResource(request.pickupNameRes)

    Scaffold(
        topBar = {
            SpeakTopBar(
                title = stringResource(R.string.pickup_title),
                speechText = stringResource(R.string.pickup_speech)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            FakeMapBox(label = pickupName, emoji = "📍")

            // Rider card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = GreenLight)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(Color.White, CircleShape)
                            .border(3.dp, MaterialTheme.colorScheme.primary, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🧑", fontSize = 44.sp)
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = "${request.service.emoji} " + stringResource(R.string.rider),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(text = request.riderName, style = MaterialTheme.typography.headlineMedium)
                        Text(text = request.riderPhone, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }

            CallButton(
                label = stringResource(R.string.call_rider),
                phoneNumber = request.riderPhone
            )
            NavigateButton(
                lat = request.pickupLat,
                lng = request.pickupLng,
                label = pickupName
            )

            Spacer(modifier = Modifier.height(8.dp))
            BigButton(
                text = stringResource(R.string.arrived),
                emoji = "✅",
                onClick = onArrived
            )
        }
    }
}

/** Placeholder for the map: a tinted box with a big pin and the place name. */
@Composable
fun FakeMapBox(label: String, emoji: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(200.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(24.dp))
            .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(24.dp)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = emoji, fontSize = 64.sp)
            Text(
                text = label,
                fontSize = 34.sp,
                lineHeight = 42.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }
    }
}
