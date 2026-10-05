#!/bin/sh
# Build an unsigned iOS .ipa on a Mac with Xcode.
# Run after `npm run build`, a preview on :8081, and `node scripts/package-www.mjs`.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Unsigned IPA builds need macOS with Xcode. This machine is $(uname -s)."
  exit 1
fi

if [ ! -f www/index.html ]; then
  echo "www/index.html is missing. Start the preview and run: node scripts/package-www.mjs"
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild was not found. Install Xcode on the runner."
  exit 1
fi

npm install --no-save @capacitor/core@7 @capacitor/cli@7 @capacitor/ios@7

if [ ! -d ios/App ]; then
  npx cap add ios
fi
npx cap sync ios

if [ -f ios/App/Podfile ]; then
  if ! command -v pod >/dev/null 2>&1; then
    sudo gem install cocoapods --no-document
  fi
  (cd ios/App && pod install)
fi

DERIVED="$ROOT/ios/build"
rm -rf "$DERIVED"
SIGN=(
  CODE_SIGNING_ALLOWED=NO
  CODE_SIGNING_REQUIRED=NO
  CODE_SIGN_IDENTITY=
  EXPANDED_CODE_SIGN_IDENTITY=
  DEVELOPMENT_TEAM=
  AD_HOC_CODE_SIGNING_ALLOWED=NO
)

if [ -d ios/App/App.xcworkspace ]; then
  xcodebuild \
    -workspace ios/App/App.xcworkspace \
    -scheme App \
    -configuration Release \
    -sdk iphoneos \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$DERIVED" \
    "${SIGN[@]}" \
    build
else
  xcodebuild \
    -project ios/App/App.xcodeproj \
    -scheme App \
    -configuration Release \
    -sdk iphoneos \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$DERIVED" \
    "${SIGN[@]}" \
    build
fi

APP_PATH="$(find "$DERIVED/Build/Products" -type d -name "*.app" | head -n 1)"
if [ -z "$APP_PATH" ]; then
  echo "xcodebuild finished without an .app bundle."
  exit 1
fi

STAGE="$ROOT/release/ipa-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE/Payload" "$ROOT/release"
BASE="$(basename "$APP_PATH")"
cp -R "$APP_PATH" "$STAGE/Payload/$BASE"
rm -rf "$STAGE/Payload/$BASE/_CodeSignature"
(
  cd "$STAGE"
  zip -qry "$ROOT/release/Shell-unsigned.ipa" Payload
)
echo "Wrote $ROOT/release/Shell-unsigned.ipa"
echo "This IPA is unsigned. Stock iPhones will not install it until a sideload tool re-signs it."
