#!/usr/bin/env bash
set -euo pipefail

APK_PATH=apk/app-release.apk
if [[ "$#" -gt 0 ]]; then APK_PATH="$1"; fi
PACKAGE_NAME=com.kage049754.newapk
ACTIVITY_NAME="$PACKAGE_NAME/.MainActivity"
REPORT_DIR=smoke-output
TASK_TITLE=NewApkCiSmokeTask

mkdir -p "$REPORT_DIR"
capture_diagnostics() {
  local exit_code=$?
  trap - EXIT
  adb shell screencap -p /sdcard/newapk-diagnostic.png >/dev/null 2>&1 || true
  adb pull /sdcard/newapk-diagnostic.png "$REPORT_DIR/diagnostic-screen.png" >/dev/null 2>&1 || true
  adb logcat -d -v threadtime > "$REPORT_DIR/logcat-full.txt" 2>/dev/null || true
  adb shell dumpsys activity activities > "$REPORT_DIR/activities.txt" 2>/dev/null || true
  adb shell dumpsys cpuinfo > "$REPORT_DIR/cpuinfo.txt" 2>/dev/null || true
  exit "$exit_code"
}
trap capture_diagnostics EXIT
if [[ ! -s "$APK_PATH" ]]; then
  echo "Standalone QA APK not found: $APK_PATH" >&2
  exit 1
fi

adb logcat -c
adb install -r "$APK_PATH" | tee "$REPORT_DIR/install.txt"

# Prove the standalone bundle starts without Wi-Fi or mobile-data access.
adb shell svc wifi disable >/dev/null 2>&1 || true
adb shell svc data disable >/dev/null 2>&1 || true

SCREEN_SIZE="$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -n 1 | tr -d '\r')"
SCREEN_WIDTH="$(echo "$SCREEN_SIZE" | cut -d x -f 1)"
SCREEN_HEIGHT="$(echo "$SCREEN_SIZE" | cut -d x -f 2)"
TAB_Y=$((SCREEN_HEIGHT * 96 / 100))
NAV_RIGHT_X=$((SCREEN_WIDTH * 92 / 100))
NAV_LEFT_X=$((SCREEN_WIDTH * 15 / 100))
SCREEN_CENTER_X=$((SCREEN_WIDTH / 2))
SCROLL_START_Y=$((SCREEN_HEIGHT * 80 / 100))
SCROLL_END_Y=$((SCREEN_HEIGHT * 35 / 100))

dump_ui() {
  timeout 12s adb shell uiautomator dump --compressed /sdcard/newapk-window.xml >/dev/null 2>&1 || return 1
  adb pull /sdcard/newapk-window.xml "$REPORT_DIR/window.xml" >/dev/null 2>&1 || return 1
  [[ -s "$REPORT_DIR/window.xml" ]]
}

ui_has_text() {
  python3 - "$REPORT_DIR/window.xml" "$1" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, needle = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(path).getroot()
except (OSError, ET.ParseError):
    raise SystemExit(1)
for node in root.iter():
    if needle in node.attrib.get("text", "") or needle in node.attrib.get("content-desc", ""):
        raise SystemExit(0)
raise SystemExit(1)
PY
}

ui_wait_text() {
  local needle="$1"
  local attempts=30
  if [[ "$#" -gt 1 ]]; then attempts="$2"; fi
  for attempt in $(seq 1 "$attempts"); do
    if dump_ui; then
      if ui_has_text "Pixel Launcher isn't responding"; then
        # Ask Android to wait for a transient launcher ANR, then retry the app assertion.
        ui_click_text "Wait" bottom || true
        sleep 2
      elif ui_has_text "$needle"; then
        return 0
      fi
    fi
    sleep 1
  done
  echo "Timed out waiting for UI text: $needle" >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
}

ui_click_text() {
  local needle="$1"
  local preference=first
  if [[ "$#" -gt 1 ]]; then preference="$2"; fi
  local coordinates
  coordinates="$(python3 - "$REPORT_DIR/window.xml" "$needle" "$preference" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, needle, preference = sys.argv[1], sys.argv[2], sys.argv[3]
root = ET.parse(path).getroot()
candidates = []
for node in root.iter():
    if node.attrib.get("text") != needle and node.attrib.get("content-desc") != needle:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    if x2 <= x1 or y2 <= y1:
        continue
    candidates.append((x1, y1, x2, y2))
if not candidates:
    raise SystemExit(f"No visible UI text bounds found for: {needle}")
if preference == "bottom":
    x1, y1, x2, y2 = max(candidates, key=lambda item: item[3])
elif preference == "top":
    x1, y1, x2, y2 = min(candidates, key=lambda item: item[1])
else:
    x1, y1, x2, y2 = candidates[0]
# Tap the exact text node, not the center of a larger Pressable ancestor.
print((x1 + x2) // 2, (y1 + y2) // 2, x1, y1, x2, y2)
PY
)"
  local x y x1 y1 x2 y2
  read -r x y x1 y1 x2 y2 <<< "$coordinates"
  printf 'TAP text=%q point=(%s,%s) bounds=[%s,%s][%s,%s]\n' "$needle" "$x" "$y" "$x1" "$y1" "$x2" "$y2" | tee -a "$REPORT_DIR/tap-events.txt"
  adb shell input tap "$x" "$y"
}
ui_click_input_hint() {
  local hint="$1"
  local coordinates
  coordinates="$(python3 - "$REPORT_DIR/window.xml" "$hint" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, hint = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("class") != "android.widget.EditText":
        continue
    if node.attrib.get("hint") != hint and node.attrib.get("text") != hint:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    raise SystemExit(0)
raise SystemExit(f"Text input with hint not found: {hint}")
PY
)"
  local x y
  read -r x y <<< "$coordinates"
  printf 'INPUT hint=%q point=(%s,%s)\n' "$hint" "$x" "$y" | tee -a "$REPORT_DIR/tap-events.txt"
  adb shell input tap "$x" "$y"
}

capture_stage() {
  local stage="$1"
  dump_ui
  cp "$REPORT_DIR/window.xml" "$REPORT_DIR/$stage.xml"
  adb shell screencap -p "/sdcard/newapk-$stage.png"
  adb pull "/sdcard/newapk-$stage.png" "$REPORT_DIR/$stage.png" >/dev/null
  echo "CAPTURED stage=$stage" | tee -a "$REPORT_DIR/tap-events.txt"
}

verify_tab() {
  local tab="$1"
  local expected="$2"
  dump_ui
  ui_click_text "$tab" bottom
  ui_wait_text "$expected"
  echo "PASS: $tab module rendered ($expected)." | tee -a "$REPORT_DIR/navigation-results.txt"
}

adb shell am start -W -n "$ACTIVITY_NAME" 2>&1 | tee "$REPORT_DIR/activity-start.txt"
sleep 5

PID="$(adb shell pidof "$PACKAGE_NAME" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  adb logcat -d -v threadtime > "$REPORT_DIR/logcat-full.txt"
  echo "NewApk process did not remain alive after launch." >&2
  exit 1
fi
printf 'NewApk process started: %s\n' "$PID" | tee "$REPORT_DIR/process.txt"
ui_wait_text "Make today count."
capture_stage home-before-task

# Exercise the task form and write through the native SQLite bridge.
ui_click_text "Add task" top
ui_wait_text "New task"
capture_stage task-form
ui_click_input_hint "Title"
adb shell input text "$TASK_TITLE"
adb shell input keyevent 4
dump_ui
capture_stage task-form-ready-to-save
ui_click_text "Save"
capture_stage after-task-save
ui_wait_text "YOUR WEEKLY OVERVIEW"
sleep 2

# Restart the process to prove that the inserted record survives a cold app relaunch.
adb shell am force-stop "$PACKAGE_NAME"
adb shell am start -W -n "$ACTIVITY_NAME" 2>&1 | tee "$REPORT_DIR/relaunch.txt"
sleep 5
PID="$(adb shell pidof "$PACKAGE_NAME" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  echo "NewApk process did not remain alive after relaunch." >&2
  adb logcat -d -v threadtime > "$REPORT_DIR/logcat-full.txt"
  exit 1
fi
printf 'NewApk process after relaunch: %s\n' "$PID" | tee -a "$REPORT_DIR/process.txt"
ui_wait_text "1 tasks to finish"
echo "PASS: locally saved task survived app force-stop and relaunch." | tee "$REPORT_DIR/persistence-result.txt"

# Visit every primary content module to catch navigation/render regressions.
verify_tab "Schedule" "Weekly timetable"
verify_tab "Tasks" "$TASK_TITLE"
verify_tab "Budget" "AVAILABLE THIS MONTH"
verify_tab "Notes" "Ideas worth keeping."
verify_tab "Files" "Keep your study files close."

# Settings may sit beyond the first visible portion of the horizontal tab bar.
dump_ui
adb shell input swipe "$NAV_RIGHT_X" "$TAB_Y" "$NAV_LEFT_X" "$TAB_Y" 450
dump_ui
ui_click_text "Settings" bottom
# Scroll within Settings because the reminder section follows profile and appearance cards.
for attempt in $(seq 1 8); do
  if dump_ui && ui_has_text "Notifications & reminders"; then break; fi
  adb shell input swipe "$SCREEN_CENTER_X" "$SCROLL_START_Y" "$SCREEN_CENTER_X" "$SCROLL_END_Y" 450
done
ui_wait_text "Notifications & reminders"
echo "PASS: Settings module rendered (Notifications & reminders)." | tee -a "$REPORT_DIR/navigation-results.txt"

# Return to Home and keep a final screenshot/UI hierarchy for review.
dump_ui
adb shell input swipe "$NAV_LEFT_X" "$TAB_Y" "$NAV_RIGHT_X" "$TAB_Y" 450
dump_ui
ui_click_text "Home" bottom

# React Native keeps the Home ScrollView offset when changing tabs. Move it
# back to the top before asserting the greeting and saving the final screenshot.
for attempt in $(seq 1 8); do
  if dump_ui && ui_has_text "Make today count."; then break; fi
  adb shell input swipe "$SCREEN_CENTER_X" "$SCROLL_END_Y" "$SCREEN_CENTER_X" "$SCROLL_START_Y" 450
  sleep 1
done
ui_wait_text "Make today count."
ui_wait_text "1 tasks to finish"
adb shell screencap -p /sdcard/newapk-home.png
adb pull /sdcard/newapk-home.png "$REPORT_DIR/home-screen.png" >/dev/null

adb logcat -d -v threadtime -s AndroidRuntime:E ReactNativeJS:E > "$REPORT_DIR/logcat-errors.txt"
if grep -Eiq 'FATAL EXCEPTION|Unable to load script|Invariant Violation|Unhandled JS Exception' "$REPORT_DIR/logcat-errors.txt"; then
  cat "$REPORT_DIR/logcat-errors.txt"
  echo "Fatal Android or React Native error detected during smoke test." >&2
  exit 1
fi

if grep -Fq "Storage unavailable" "$REPORT_DIR/window.xml"; then
  echo "Storage initialization error dialog appeared; current Android UI hierarchy:" >&2
  cat "$REPORT_DIR/window.xml" >&2
  exit 1
fi

echo "Standalone APK passed offline startup, SQLite task write, process-relaunch persistence and primary-module navigation checks; no fatal Android/React Native errors were logged." | tee "$REPORT_DIR/result.txt"
