#!/usr/bin/env bash
set -euo pipefail

usage="usage: scripts/lune-install.sh [--no-build]
Builds Lune (Release), signs it and Chromium's framework with your Apple Development
certificate, and installs it to /Applications/Lune.app.
Env: LUNE_TEAM (default QT5GQB36LC), LUNE_IDENTITY (default: your Apple Development cert)."

build=1
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    -h|--help) echo "$usage"; exit 0 ;;
    *) echo "$usage" >&2; exit 1 ;;
  esac
done

root="$(cd "$(dirname "$0")/.." && pwd)"
app_dir="$root/apps/browser"
ardiacore="$root/packages/ardiacore"
derived="$app_dir/build-lune-release"
built="$derived/Build/Products/Release/Lune.app"
staged="$derived/Lune.app"
target="/Applications/Lune.app"
team="${LUNE_TEAM:-QT5GQB36LC}"
die() { echo "error: $*" >&2; exit 1; }

identity="${LUNE_IDENTITY:-$(security find-identity -v -p codesigning | awk '/Apple Development/ { print $2; exit }')}"
[ -n "$identity" ] || die "no Apple Development certificate (Xcode › Settings › Accounts › Manage Certificates)"

engine="$(git -C "$root" rev-parse HEAD:engine | cut -c1-12)"
framework="${ARDIACORE_FRAMEWORK:-$app_dir/build-ardiacore/prebuilt/$engine/Chromium Framework.framework}"
[ -d "$framework" ] || die "no prebuilt engine $engine: run packages/ardiacore/scripts/fetch-engine.sh"

if [ "$build" = 1 ]; then
  echo "==> Build (Release) against $(basename "$(dirname "$framework")")"
  (cd "$app_dir" && ARDIACORE_FRAMEWORK="$framework" xcodebuild -workspace macos/Ardia.xcworkspace -scheme Ardia-macOS \
    -configuration Release -destination 'generic/platform=macOS' ARCHS=arm64 -derivedDataPath "$derived" \
    DEVELOPMENT_TEAM="$team" CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" \
    -allowProvisioningUpdates build) > "$derived.log" 2>&1 \
    || { grep -E "error:" "$derived.log" | grep -v MACOSX_DEPLOYMENT_TARGET | tail -20 >&2; die "build failed ($derived.log)"; }
fi
[ -d "$built" ] || die "no build at $built"

echo "==> Sign"
rm -rf "$staged"
ditto "$built" "$staged"
"$ardiacore/scripts/prune-bundle.sh" "$staged" >/dev/null
engine_binary="$staged/Contents/Frameworks/Chromium Framework.framework/Versions/Current/Chromium Framework"
upstream_team="$(strings -a "$engine_binary" | sed -n 's/^\([A-Z0-9]\{10\}\)\.com\.ardia\.browser\.webauthn$/\1/p' | sed -n 1p)"
[ -n "$upstream_team" ] || die "can't find the engine's keychain team"
if [ "$upstream_team" != "$team" ]; then
  UPSTREAM="$upstream_team" TEAM="$team" perl -0777 -pi -e 's/\Q$ENV{UPSTREAM}\E/$ENV{TEAM}/g' "$engine_binary"
fi
[[ $'\n'"$(strings -a "$engine_binary")"$'\n' == *$'\n'"$team.com.ardia.browser.webauthn"$'\n'* ]] || die "the engine doesn't use team $team for passkeys"
sign() { codesign --force --sign "$identity" "$@" 2>/dev/null; }
fw="$staged/Contents/Frameworks/Chromium Framework.framework"
fwv="$(cd "$fw/Versions/Current" && pwd -P)"
for lib in "$fwv"/Libraries/*.dylib; do sign "$lib"; done
for helper in "$fwv"/Helpers/*.app; do
  case "$(basename "$helper")" in
    *"Renderer).app") sign --options restrict,kill,runtime --entitlements "$ardiacore/scripts/signing/renderer.entitlements" "$helper" ;;
    *"GPU).app") sign --options restrict,kill,runtime --entitlements "$ardiacore/scripts/signing/gpu.entitlements" "$helper" ;;
    *) sign --options restrict,library,kill,runtime "$helper" ;;
  esac
done
sign --options restrict,library,kill,runtime "$fwv/Helpers/chrome_crashpad_handler"
sign --options restrict,library,kill,runtime "$fwv/Helpers/app_mode_loader"
[ -e "$fwv/Helpers/web_app_shortcut_copier" ] && sign --options restrict,library,kill,runtime "$fwv/Helpers/web_app_shortcut_copier"
sign "$fw"
[ -d "$staged/Contents/Frameworks/hermes.framework" ] \
  && sign --preserve-metadata=identifier,entitlements,flags,runtime "$staged/Contents/Frameworks/hermes.framework"
sign --preserve-metadata=entitlements,requirements,flags,runtime "$staged"
codesign --verify --deep --strict "$staged" || die "the signed app doesn't verify"
[[ "$(codesign -dvv "$staged" 2>&1)" == *"TeamIdentifier=$team"* ]] || die "the app isn't signed by team $team"
[[ "$(codesign -d --entitlements - --xml "$staged" 2>/dev/null)" == *"$team.com.ardia.browser.webauthn"* ]] || die "the app can't reach the engine's passkey keychain group"

echo "==> Install"
if pgrep -f "$target/Contents/MacOS/Lune" >/dev/null; then
  osascript -e 'tell application id "com.chaseballard.lune" to quit' >/dev/null 2>&1 || true
  for _ in $(seq 1 120); do pgrep -f "$target/Contents/MacOS/Lune" >/dev/null || break; sleep 0.25; done
  pgrep -f "$target/Contents/MacOS/Lune" >/dev/null && die "Lune is still running; quit it and run again with --no-build"
fi
rm -rf "$target"
ditto "$staged" "$target"
echo "Installed $target"
