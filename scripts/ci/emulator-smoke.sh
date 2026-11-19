#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-apk/app-release.apk}"
PACKAGE_NAME="com.kage049754.newapk"
ACTIVITY_NAME="${PACKAGE_NAME}/.MainActivity"
REPORT_DIR="${SMOKE_REPORT_DIR:-smoke-output}"

mkdir -p "$REPORT_DIR"
if [[ ! -s "$APK_PATH" ]]; then
  echo "Standalone QA APK not found: $APK_PATH" >&2
  exit 1
fi

adb logcat -c
adb install -r "$APK_PATH" | tee "$REPORT_DIR/install.txt"

# Prove the standalone bundle starts without Wi-Fi or mobile-data access.
adb shell svc wifi disable >/dev/null 2>&1 || true
adb shell svc data disable >/dev/null 2>&1 || true

adb shell am start -W -n "$ACTIVITY_NAME" 2>&1 | tee "$REPORT_DIR/activity-start.txt"
sleep 5

PID="$(adb shell pidof "$PACKAGE_NAME" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  adb logcat -d -v threadtime > "$REPORT_DIR/logcat-full.txt"
  echo "NewApk process did not remain alive after launch." >&2
  exit 1
fi
printf 'NewApk process started: %s\n' "$PID" | tee "$REPORT_DIR/process.txt"

# Wait for React Native to render the Home screen, not just the native activity shell.
HOME_RENDERED=false
for attempt in $(seq 1 20); do
  adb shell uiautomator dump --compressed /sdcard/newapk-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/newapk-window.xml "$REPORT_DIR/window.xml" >/dev/null 2>&1 || true
  if [[ -s "$REPORT_DIR/window.xml" ]] && grep -Fq "Make today count." "$REPORT_DIR/window.xml"; then
    HOME_RENDERED=true
    break
  fi
  sleep 1
done

adb shell screencap -p /sdcard/newapk-home.png
adb pull /sdcard/newapk-home.png "$REPORT_DIR/home-screen.png" >/dev/null

adb logcat -d -v threadtime -s AndroidRuntime:E ReactNativeJS:E > "$REPORT_DIR/logcat-errors.txt"
if grep -Eiq 'FATAL EXCEPTION|Unable to load script|Invariant Violation|Unhandled JS Exception' "$REPORT_DIR/logcat-errors.txt"; then
  cat "$REPORT_DIR/logcat-errors.txt"
  echo "Fatal Android or React Native error detected during launch." >&2
  exit 1
fi

if grep -Fq "Storage unavailable" "$REPORT_DIR/window.xml"; then
  echo "Storage initialization error dialog appeared; current Android UI hierarchy:" >&2
  cat "$REPORT_DIR/window.xml" >&2
  echo "See home-screen.png and logcat-errors.txt in this artifact." >&2
  exit 1
fi

if [[ "$HOME_RENDERED" != "true" ]]; then
  echo "Home screen text was not found in the emulator UI hierarchy." >&2
  cat "$REPORT_DIR/window.xml" >&2
  exit 1
fi

echo "Standalone APK installed and launched offline; Home screen rendered and no fatal Android/React Native errors were logged." | tee "$REPORT_DIR/result.txt"
