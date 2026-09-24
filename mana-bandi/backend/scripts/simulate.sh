#!/usr/bin/env bash
# End-to-end simulation of one bike ride against a running Mana Bandi API.
# Needs: Otp__DevMode=true (the OTP comes back as devCode) and Seed__DemoData=true (verified demo captains).
#   ./scripts/simulate.sh                  # http://localhost:5080
#   BASE=https://staging.example ./scripts/simulate.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5080}"
RIDER_PHONE="${RIDER_PHONE:-98480$(printf '%05d' $((RANDOM % 100000)))}"
CAPTAIN_PHONE="${CAPTAIN_PHONE:-900000000$((RANDOM % 7))}"   # demo bike captains +919000000000…06

command -v jq >/dev/null || { echo "jq is required (apt-get install -y jq)"; exit 1; }

# Bus stand (pickup), captain start ~250 m away, drop ~2.5 km north-east
PICK_LAT=18.0338; PICK_LNG=77.7562
CAP_LAT=18.0356;  CAP_LNG=77.7580
DROP_LAT=18.0520; DROP_LNG=77.7700

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
api() { # api METHOD PATH TOKEN [JSON]
  local method=$1 path=$2 token=${3:-} body=${4:-}
  local args=(-sS -X "$method" "$BASE$path" -H 'Content-Type: application/json' -H 'X-App-Version: sim-1.0' -w '\n%{http_code}')
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $body ]] && args+=(-d "$body")
  local out; out=$(curl "${args[@]}")
  HTTP_CODE=${out##*$'\n'}
  BODY=${out%$'\n'*}
}
must() { # must EXPECTED_CODE METHOD PATH TOKEN [JSON]
  local want=$1; shift
  api "$@"
  if [[ $HTTP_CODE != "$want" ]]; then echo "FAILED: $2 $3 → $HTTP_CODE (wanted $want): $BODY" >&2; exit 1; fi
}
login() { # login PHONE ROLE NAME → token
  must 200 POST /api/auth/otp/request "" "{\"phone\":\"$1\",\"role\":\"$2\",\"channel\":\"sms\",\"lang\":\"te\"}"
  local code; code=$(jq -r '.devCode // empty' <<<"$BODY")
  [[ -n $code ]] || { echo "No devCode: start the server with Otp__DevMode=true" >&2; exit 1; }
  must 200 POST /api/auth/otp/verify "" "{\"phone\":\"$1\",\"role\":\"$2\",\"code\":\"$code\",\"name\":\"$3\",\"lang\":\"te\"}"
  jq -r .token <<<"$BODY"
}
now() { date -u +%Y-%m-%dT%H:%M:%S.%3NZ; }
beat() { # beat TOKEN LAT LNG → heartbeat response in BODY
  must 200 POST /api/captain/location "$1" "{\"points\":[{\"lat\":$2,\"lng\":$3,\"accuracy\":8,\"speed\":7,\"heading\":45,\"at\":\"$(now)\"}]}"
}
lerp() { awk -v a="$1" -v b="$2" -v f="$3" 'BEGIN{printf "%.6f", a+(b-a)*f}'; }
rider_view() {
  must 200 GET "/api/rides/$RIDE_ID" "$RIDER"
  jq -r '"   rider sees: \(.status)  captain=\(.captain.name // "-") \(.captain.vehicleNo // "")  at=\(.captain.location.lat // "-"),\(.captain.location.lng // "-")  eta=\(.captain.etaMin // "-") min"' <<<"$BODY"
}

say "Health"
must 200 GET /healthz ""; echo "   $BODY"

say "Rider login ($RIDER_PHONE) + terms"
RIDER=$(login "$RIDER_PHONE" rider "Lakshmi (sim)")
must 200 GET "/api/terms/current?audience=rider&lang=te" ""; TERMS=$(jq -r .version <<<"$BODY")
must 200 POST /api/me/terms "$RIDER" "{\"version\":\"$TERMS\"}"; echo "   accepted terms v$TERMS"

say "Captain login ($CAPTAIN_PHONE, demo captain)"
CAPTAIN=$(login "$CAPTAIN_PHONE" captain "")
must 200 GET /api/me "$CAPTAIN"
jq -r '"   \(.captain.name) · \(.captain.vehicleNo) · status=\(.captain.status) · commission now \(.captain.commission.currentPct)%"' <<<"$BODY"
[[ $(jq -r .captain.status <<<"$BODY") == verified ]] || { echo "Captain is not verified: start with Seed__DemoData=true" >&2; exit 1; }
must 200 POST /api/me/terms "$CAPTAIN" "{\"version\":\"$TERMS\"}"

# leftovers from an interrupted earlier run
api GET /api/captain/trip "$CAPTAIN"
if [[ $HTTP_CODE == 200 ]]; then
  case $(jq -r .status <<<"$BODY") in
    accepted|arrived) api POST /api/captain/trip/cancel "$CAPTAIN" '{"reason":"simulation reset"}' ;;
    started) api POST /api/captain/trip/finish "$CAPTAIN" "{\"lat\":$CAP_LAT,\"lng\":$CAP_LNG}"; api POST /api/captain/trip/collected "$CAPTAIN" '{"method":"cash"}' ;;
    finished) api POST /api/captain/trip/collected "$CAPTAIN" '{"method":"cash"}' ;;
  esac
  echo "   cleaned up a trip left over from an earlier run"
fi

say "Captain goes online near the bus stand"
must 200 POST /api/captain/online "$CAPTAIN" "{\"online\":true,\"lat\":$CAP_LAT,\"lng\":$CAP_LNG}"
jq -r '"   online=\(.online) town=\(.townId)"' <<<"$BODY"
beat "$CAPTAIN" "$CAP_LAT" "$CAP_LNG"

say "Rider quotes and books a bike: RTC Bus stand → Farm house"
PLACES="\"pickup\":{\"lat\":$PICK_LAT,\"lng\":$PICK_LNG},\"drop\":{\"lat\":$DROP_LAT,\"lng\":$DROP_LNG,\"name\":\"Farm house\",\"nameTe\":\"ఫామ్ హౌస్\"}"
must 200 POST /api/rider/quote "$RIDER" "{\"service\":\"bike\",$PLACES}"
jq -r '"   quote: ₹\(.fare) for \(.distanceKm) km (night=\(.night)), captain ETA \(.etaPickupMin // "-") min"' <<<"$BODY"
CLIENT_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)
must 201 POST /api/rides "$RIDER" "{\"clientId\":\"$CLIENT_ID\",\"service\":\"bike\",\"payment\":\"cash\",$PLACES}"
RIDE_ID=$(jq -r .id <<<"$BODY"); TRACK=$(jq -r .trackUrl <<<"$BODY")
jq -r '"   ride \(.id) status=\(.status) pickup=\(.pickup.name) fare=₹\(.fareQuoted)\n   share link: \(.trackUrl)"' <<<"$BODY"

say "Captain heartbeat until the offer arrives"
OFFER_ID=""
for i in $(seq 1 40); do
  beat "$CAPTAIN" "$CAP_LAT" "$CAP_LNG"
  OFFER_ID=$(jq -r --arg r "$RIDE_ID" 'if .offer and .offer.rideId == $r then .offer.id else empty end' <<<"$BODY")
  if [[ -n $OFFER_ID ]]; then
    jq -r '"   offer \(.offer.id): ₹\(.offer.fare), \(.offer.distanceToPickupKm) km to pickup, trip \(.offer.tripKm) km, \(.offer.secondsLeft) s left (heartbeat #'"$i"')"' <<<"$BODY"
    break
  fi
  sleep 0.5
done
[[ -n $OFFER_ID ]] || { echo "No offer received in 20 s (is another captain nearer / online?)" >&2; exit 1; }

say "Captain accepts"
must 200 POST "/api/captain/offers/$OFFER_ID/accept" "$CAPTAIN"
jq -r '"   trip \(.rideId) status=\(.status) rider=\(.rider.name) commission \(.commission.pct)% (\(.commission.rule))"' <<<"$BODY"
must 200 GET "/api/rides/$RIDE_ID" "$RIDER"; OTP=$(jq -r .otp <<<"$BODY")
echo "   rider's ride OTP: $OTP"

say "Captain drives to the pickup (10 GPS points)"
for i in $(seq 1 10); do
  f=$(awk -v i="$i" 'BEGIN{print i/10}')
  beat "$CAPTAIN" "$(lerp $CAP_LAT $PICK_LAT "$f")" "$(lerp $CAP_LNG $PICK_LNG "$f")"
  if (( i % 3 == 1 || i == 10 )); then rider_view; fi
  sleep 0.3
done
must 200 POST /api/captain/trip/arrived "$CAPTAIN"; echo "   captain arrived"
rider_view

say "Start with the ride OTP (a wrong code first)"
WRONG=$([[ $OTP == 0000 ]] && echo 1111 || echo 0000)
api POST /api/captain/trip/start "$CAPTAIN" "{\"otp\":\"$WRONG\"}"; echo "   wrong OTP → $HTTP_CODE $(jq -r .code <<<"$BODY")"
must 200 POST /api/captain/trip/start "$CAPTAIN" "{\"otp\":\"$OTP\"}"; echo "   right OTP → $(jq -r .status <<<"$BODY")"

say "Captain drives to the drop (10 GPS points)"
for i in $(seq 1 10); do
  f=$(awk -v i="$i" 'BEGIN{print i/10}')
  side=$(( i == 10 ? 0 : (i % 2 == 0 ? 1 : -1) ))
  lat=$(awk -v a=$PICK_LAT -v b=$DROP_LAT -v f="$f" -v s=$side 'BEGIN{printf "%.6f", a+(b-a)*f - s*0.00037}')
  lng=$(awk -v a=$PICK_LNG -v b=$DROP_LNG -v f="$f" -v s=$side 'BEGIN{printf "%.6f", a+(b-a)*f + s*0.00054}')
  beat "$CAPTAIN" "$lat" "$lng"
  if (( i % 3 == 1 || i == 10 )); then rider_view; fi
  sleep 0.3
done

say "Public share page (no login)"
TOKEN=${TRACK##*/}
must 200 GET "/api/public/track/$TOKEN" ""
jq -r '"   /t/…: status=\(.status) captain=\(.captain.name) \(.captain.vehicleNo) at \(.captain.location.lat),\(.captain.location.lng)"' <<<"$BODY"

say "Finish and collect"
must 200 POST /api/captain/trip/finish "$CAPTAIN" "{\"lat\":$DROP_LAT,\"lng\":$DROP_LNG}"
jq -r '"   finished: fare ₹\(.fareFinal) (quoted ₹\(.fareQuoted), GPS \(.tripKm) km) · commission \(.commission.pct)% = ₹\(.commission.amount) · captain gets ₹\(.commission.captainGets)"' <<<"$BODY"
must 200 POST /api/captain/trip/collected "$CAPTAIN" '{"method":"cash"}'
jq -r '"   collected cash · earningsToday ₹\(.earningsToday) · tripsToday \(.tripsToday)"' <<<"$BODY"
must 200 POST "/api/rides/$RIDE_ID/rate" "$RIDER" '{"stars":5,"tip":0}'; echo "   rider rated 5★"

say "Rider's final view"
must 200 GET "/api/rides/$RIDE_ID" "$RIDER"
jq -r '"   \(.id) \(.status) · ₹\(.fareFinal) \(.payment) · events: \([.events[].type] | join(" → "))"' <<<"$BODY"

say "Captain earnings"
must 200 GET /api/captain/earnings "$CAPTAIN"
jq -r '"   today: gross ₹\(.today.gross) · commission ₹\(.today.commission) · net ₹\(.today.net) · trips \(.today.trips)\n   week:  gross ₹\(.week.gross) · net ₹\(.week.net) · trips \(.week.trips) · settlement due ₹\(.settlementDue)\n   last trip: \(.trips[0].rideId) → \(.trips[0].dropName) ₹\(.trips[0].fare) (\(.trips[0].payment))"' <<<"$BODY"

must 200 POST /api/captain/online "$CAPTAIN" '{"online":false}'
say "Done ✔"
