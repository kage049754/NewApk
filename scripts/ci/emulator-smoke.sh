#!/usr/bin/env bash
set -euo pipefail

APK_PATH=apk/app-release.apk
if [[ "$#" -gt 0 ]]; then APK_PATH="$1"; fi
PACKAGE_NAME=com.kage049754.newapk
ACTIVITY_NAME="$PACKAGE_NAME/.MainActivity"
REPORT_DIR=smoke-output
TASK_TITLE=NewApkCiSmokeTask
TEST_ACTIVITY_TITLE=NewApkCiReminderTest
EXPENSE_TITLE=NewApkCiSmokeExpense
EXPENSE_AMOUNT=25

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

dismiss_launcher_anr() {
  local coordinates
  coordinates="$(python3 - "$REPORT_DIR/window.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("text") != "Wait" and node.attrib.get("resource-id") != "android:id/aerr_wait":
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    raise SystemExit(0)
raise SystemExit("Launcher ANR dialog has no visible Wait control.")
PY
)" || return 1
  local x y
  read -r x y <<< "$coordinates"
  echo "EMULATOR: dismissing transient Pixel Launcher ANR with Wait at ($x,$y)." | tee -a "$REPORT_DIR/tap-events.txt"
  adb shell input tap "$x" "$y"
}

dump_ui() {
  # Pixel Launcher can briefly ANR during first install / package indexing.
  # Keep waiting on the launcher rather than letting its modal hide NewApk UI.
  for attempt in $(seq 1 8); do
    timeout 12s adb shell uiautomator dump --compressed /sdcard/newapk-window.xml >/dev/null 2>&1 || {
      sleep 1
      continue
    }
    adb pull /sdcard/newapk-window.xml "$REPORT_DIR/window.xml" >/dev/null 2>&1 || {
      sleep 1
      continue
    }
    [[ -s "$REPORT_DIR/window.xml" ]] || continue
    if grep -Fq "Pixel Launcher isn't responding" "$REPORT_DIR/window.xml"; then
      dismiss_launcher_anr || return 1
      sleep 2
      continue
    fi
    return 0
  done
  echo "Android UI remained blocked by a system dialog after repeated Wait attempts." >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
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

ui_has_visible_text() {
  python3 - "$REPORT_DIR/window.xml" "$1" "$SCREEN_WIDTH" "$SCREEN_HEIGHT" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, needle, width, height = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
try:
    root = ET.parse(path).getroot()
except (OSError, ET.ParseError):
    raise SystemExit(1)
# Reserve the bottom 10% for the fixed navigation bar and system gesture area.
visible_bottom = int(height * 0.90)
for node in root.iter():
    if needle not in node.attrib.get("text", "") and needle not in node.attrib.get("content-desc", ""):
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    # A positive rectangle can still be fully obscured by the pinned bottom
    # tab bar. Accept only coordinates inside the actual scrollable viewport.
    if x2 > x1 and y2 > y1 and x1 >= 0 and y1 >= 0 and x2 <= width and y2 <= visible_bottom:
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
      if ui_has_text "$needle"; then
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
  dump_ui || return 1
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
  dump_ui || return 1
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
    if node.attrib.get("hint") != hint and node.attrib.get("text") != hint and node.attrib.get("content-desc") != hint:
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

ui_focused_edit_text_raw_value() {
  local target_hint="$1"
  python3 - "$REPORT_DIR/window.xml" "$target_hint" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, target_hint = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("class") != "android.widget.EditText" or node.attrib.get("focused") != "true":
        continue
    label = node.attrib.get("content-desc", "")
    hint = node.attrib.get("hint", "")
    value = node.attrib.get("text", "")
    if label == target_hint or hint == target_hint or value in (target_hint, target_hint + " *"):
        print(value)
        raise SystemExit(0)
raise SystemExit("Focused Android text field did not match: " + target_hint)
PY
}

ui_focused_edit_text_value() {
  local target_hint="$1"
  local empty_placeholder="${2:-}"
  python3 - "$REPORT_DIR/window.xml" "$target_hint" "$empty_placeholder" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, target_hint, empty_placeholder = sys.argv[1], sys.argv[2], sys.argv[3]
root = ET.parse(path).getroot()
# React Native TextInput's date example remains visible as Android EditText text
# after clearing. The form also has fixed examples for its time fields.
known_placeholders = {
    "Activity date": "2026-11-25",
    "Activity start time": "09:00",
    "Activity end time": "10:00",
}
for node in root.iter():
    if node.attrib.get("class") != "android.widget.EditText" or node.attrib.get("focused") != "true":
        continue
    value = node.attrib.get("text", "")
    # Capture the actual initial value before clearing it and also recognize
    # the control's configured placeholder. This avoids treating a date/time
    # example as user-entered content after the field has been emptied.
    if (
        value in (target_hint, target_hint + " *", known_placeholders.get(target_hint))
        or (empty_placeholder and value == empty_placeholder)
    ):
        value = ""
    print(value)
    raise SystemExit(0)
raise SystemExit("No focused Android text field was found.")
PY
}

ui_type_text_slow() {
  local value="$1"
  local target_hint="$2"
  local empty_placeholder="${3:-}"
  local entered=""
  # Pixel Launcher can repeatedly raise its ANR dialog while the emulator is
  # receiving input. Type one character, then dump the hierarchy so dump_ui
  # can press Android's Wait action before the next character is sent. Verify
  # the focused field after every character and retry lost key events.
  for ((index = 0; index < ${#value}; index++)); do
    local character="${value:index:1}"
    local expected="${entered}${character}"
    local inserted=false
    for attempt in $(seq 1 5); do
      if ! dump_ui; then
        sleep 1
        continue
      fi
      local current
      current="$(ui_focused_edit_text_value "$target_hint" "$empty_placeholder" 2>/dev/null || true)"
      if [[ "$current" != "$entered" ]]; then
        echo "TYPE recovery index=$((index + 1)) expected_prefix=${entered} current=${current}" | tee -a "$REPORT_DIR/tap-events.txt"
        ui_click_input_hint "$target_hint" || true
        dump_ui || true
        current="$(ui_focused_edit_text_value "$target_hint" "$empty_placeholder" 2>/dev/null || true)"
      fi
      if [[ "$current" == "$expected" ]]; then
        inserted=true
        entered="$expected"
        break
      fi
      if [[ "$current" != "$entered" ]]; then
        echo "Unexpected text field value while typing $target_hint: expected prefix '$entered', found '$current'." >&2
        return 1
      fi
      printf 'TYPE character=%q index=%s/%s attempt=%s\n' "$character" "$((index + 1))" "${#value}" "$attempt" | tee -a "$REPORT_DIR/tap-events.txt"
      adb shell input text "$character"
      # UIAutomator can briefly return an older, empty TextInput value just
      # after Android accepted the key event (especially for date fields).
      # Poll the focused field before deciding that the character was lost.
      for settle_attempt in $(seq 1 8); do
        if dump_ui; then
          current="$(ui_focused_edit_text_value "$target_hint" "$empty_placeholder" 2>/dev/null || true)"
          if [[ "$current" == "$expected" ]]; then
            inserted=true
            entered="$expected"
            break
          fi
        fi
        sleep 0.35
      done
      if [[ "$inserted" == "true" ]]; then
        break
      fi
      if [[ -n "$current" && "$current" != "$entered" ]]; then
        echo "Unexpected value after typing $target_hint: expected '$expected', found '$current'." >&2
        return 1
      fi
      # If the hierarchy stayed stale or the key event was swallowed by a
      # system dialog, retry the same character before advancing.
    done
    if [[ "$inserted" != "true" ]]; then
      echo "Could not enter character $((index + 1)) of $target_hint after repeated Android UI recovery attempts." >&2
      return 1
    fi
  done
  echo "PASS: typed complete value into $target_hint: $entered" | tee -a "$REPORT_DIR/tap-events.txt"
}

ui_wait_edit_text_value() {
  local expected="$1"
  for attempt in $(seq 1 20); do
    dump_ui || { sleep 1; continue; }
    if python3 - "$REPORT_DIR/window.xml" "$expected" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, expected = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("class") == "android.widget.EditText" and node.attrib.get("text") == expected:
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      echo "PASS: text input contains the complete value: $expected" | tee -a "$REPORT_DIR/tap-events.txt"
      return 0
    fi
    sleep 1
  done
  echo "Text input did not contain the complete expected value: $expected" >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
}

ui_hide_keyboard() {
  local ime_state
  for attempt in $(seq 1 10); do
    ime_state="$(adb shell dumpsys input_method 2>/dev/null | grep -Eo 'mInputShown[[:space:]]*=[[:space:]]*(true|false)' | tail -n 1 | tr -d '[:space:]' || true)"
    if [[ "$ime_state" == "mInputShown=false" ]]; then
      echo "PASS: software keyboard is hidden before form submission." | tee -a "$REPORT_DIR/tap-events.txt"
      return 0
    fi
    # dump_ui also detects and dismisses transient Android launcher ANR
    # dialogs, which can otherwise consume the Back key intended for Gboard.
    dump_ui || true
    adb shell input keyevent 4
    sleep 1
  done
  adb shell dumpsys input_method > "$REPORT_DIR/input-method.txt" 2>&1 || true
  if grep -Eq 'mInputShown[[:space:]]*=[[:space:]]*false' "$REPORT_DIR/input-method.txt"; then
    echo "PASS: software keyboard is hidden before form submission." | tee -a "$REPORT_DIR/tap-events.txt"
    return 0
  fi
  echo "Could not confirm that the software keyboard was hidden before tapping the form action." >&2
  cat "$REPORT_DIR/input-method.txt" >&2
  return 1
}

ui_wait_text_absent() {
  local needle="$1"
  for attempt in $(seq 1 20); do
    if dump_ui && ! ui_has_text "$needle"; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for UI text to disappear: $needle" >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
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

pin_home_widget() {
  local button_text="$1"
  local provider_name="$2"
  local stage_name="$3"

  ui_scroll_to_text "Home screen widgets"
  ui_wait_text "$button_text"
  ui_click_text "$button_text"
  sleep 2
  dump_ui
  if ! ui_has_text "Add to home screen"; then
    echo "Android launcher did not show the widget pin confirmation for $button_text." >&2
    [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
    return 1
  fi
  capture_stage "${stage_name}-confirmation"
  # Pixel Launcher uses the full button label shown in its pin-preview sheet.
  ui_click_text "Add to home screen" bottom
  sleep 3
  adb shell dumpsys appwidget > "$REPORT_DIR/${stage_name}-appwidget.txt"
  if ! grep -Fq "$provider_name" "$REPORT_DIR/${stage_name}-appwidget.txt"; then
    echo "Launcher did not register the pinned provider $provider_name." >&2
    cat "$REPORT_DIR/${stage_name}-appwidget.txt" >&2
    return 1
  fi
  adb shell input keyevent 3
  sleep 3
  dump_ui
  echo "PASS: launcher pinned $provider_name." | tee -a "$REPORT_DIR/widget-results.txt"
}

ui_wait_checked_checkbox() {
  local expected_label="$1"
  for attempt in $(seq 1 20); do
    if dump_ui && python3 - "$REPORT_DIR/window.xml" "$expected_label" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, expected_label = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("content-desc") == expected_label and node.attrib.get("checked") == "true":
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      echo "PASS: checkbox state is checked: $expected_label" | tee -a "$REPORT_DIR/tap-events.txt"
      return 0
    fi
    sleep 1
  done
  echo "Checkbox did not reach the checked state: $expected_label" >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
}

ui_click_switch_accessibility() {
  local label="$1"
  dump_ui || return 1
  local coordinates
  coordinates="$(python3 - "$REPORT_DIR/window.xml" "$label" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, label = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter():
    if node.attrib.get("content-desc") != label:
        continue
    if node.attrib.get("class") not in ("android.widget.Switch", "android.widget.CompoundButton"):
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    raise SystemExit(0)
raise SystemExit(f"Accessible switch not found: {label}")
PY
)" || return 1
  local x y
  read -r x y <<< "$coordinates"
  echo "SWITCH label=$label point=($x,$y)" | tee -a "$REPORT_DIR/tap-events.txt"
  adb shell input tap "$x" "$y"
}

ui_scroll_to_text() {
  local needle="$1"
  local attempts=16
  if [[ "$#" -gt 1 ]]; then attempts="$2"; fi
  # Swipe upward within the active ScrollView to reveal later controls. Do
  # not reverse direction before checking: a text node may be in the XML while
  # its real bounds are still clipped underneath the fixed navigation bar.
  for attempt in $(seq 1 "$attempts"); do
    if dump_ui && ui_has_visible_text "$needle"; then
      echo "PASS: visible and tappable UI target: $needle" | tee -a "$REPORT_DIR/tap-events.txt"
      return 0
    fi
    adb shell input swipe "$SCREEN_CENTER_X" "$SCROLL_START_Y" "$SCREEN_CENTER_X" "$SCROLL_END_Y" 450
    sleep 1
  done
  echo "Could not scroll to a visible UI target: $needle" >&2
  [[ -s "$REPORT_DIR/window.xml" ]] && cat "$REPORT_DIR/window.xml" >&2
  return 1
}

ui_replace_accessible_input() {
  local label="$1"
  local value="$2"
  ui_click_input_hint "$label"
  dump_ui
  local empty_placeholder
  empty_placeholder="$(ui_focused_edit_text_raw_value "$label" 2>/dev/null || true)"
  # Some forms prefill a meaningful value (the current date is an example).
  # Keep it intact when it already equals the value this test needs; treating
  # that same string as a placeholder would make the later assertion ambiguous.
  if [[ "$empty_placeholder" == "$value" ]]; then
    echo "PASS: $label already contains the requested value: $value" | tee -a "$REPORT_DIR/tap-events.txt"
    ui_wait_edit_text_value "$value"
    return 0
  fi
  adb shell input keyevent 123
  for attempt in $(seq 1 16); do
    adb shell input keyevent 67
  done
  ui_type_text_slow "$value" "$label" "$empty_placeholder"
  ui_wait_edit_text_value "$value"
}

create_activity_reminder() {
  # Use the emulator clock so the activity is 20 minutes in the future,
  # leaving time for input while React Native and AlarmManager use the same zone.
  local device_now
  device_now="$(adb shell "date '+%Y-%m-%d %H:%M'" | tr -d '\r')"
  local date_value start_value end_value
  read -r date_value start_value end_value <<< "$(python3 - "$device_now" <<'PY'
from datetime import datetime, timedelta
import sys

now = datetime.strptime(sys.argv[1], "%Y-%m-%d %H:%M")
# Leave time for the slow emulator text-entry flow while still triggering the
# reminder immediately via the existing catch-up scheduling behavior.
start = now + timedelta(minutes=20)
end = start + timedelta(minutes=10)
print(start.strftime("%Y-%m-%d"), start.strftime("%H:%M"), end.strftime("%H:%M"))
PY
)"
  echo "REMINDER TEST: activity date=$date_value start=$start_value end=$end_value device_now=$device_now" | tee "$REPORT_DIR/reminder-test.txt"

  ui_scroll_to_text "＋ Add activity"
  ui_click_text "＋ Add activity"
  ui_wait_text "New activity"
  ui_replace_accessible_input "Activity name" "$TEST_ACTIVITY_TITLE"
  ui_replace_accessible_input "Activity date" "$date_value"
  ui_replace_accessible_input "Activity start time" "$start_value"
  ui_replace_accessible_input "Activity end time" "$end_value"
  capture_stage activity-form-ready-to-save
  ui_hide_keyboard
  dump_ui
  ui_click_text "Save activity"
  ui_wait_text_absent "New activity"
  ui_wait_text "Personal activities"
  ui_wait_text "$TEST_ACTIVITY_TITLE"
  echo "PASS: future activity saved for reminder delivery." | tee -a "$REPORT_DIR/reminder-test.txt"
}

verify_reminder_delivery() {
  # The emulator grants these permissions ahead of the in-app switch action.
  # The app still requests/checks them through its normal React Native flow.
  adb shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS
  adb shell appops set "$PACKAGE_NAME" SCHEDULE_EXACT_ALARM allow >/dev/null 2>&1 || true
  adb shell appops get "$PACKAGE_NAME" SCHEDULE_EXACT_ALARM > "$REPORT_DIR/exact-alarm-appop.txt" 2>&1 || true
  adb shell dumpsys package "$PACKAGE_NAME" > "$REPORT_DIR/package-permissions.txt"

  dump_ui
  # Settings is the rightmost item in the horizontally scrollable bottom tab
  # bar. Reveal it before attempting to tap it, as the first screen width only
  # shows the preceding tabs.
  adb shell input swipe "$NAV_RIGHT_X" "$TAB_Y" "$NAV_LEFT_X" "$TAB_Y" 450
  dump_ui
  ui_click_text "Settings" bottom
  ui_scroll_to_text "Notifications & reminders"
  ui_wait_text "Enable reminders"
  ui_click_switch_accessibility "Enable reminders"

  local delivered=false
  for attempt in $(seq 1 25); do
    adb shell dumpsys notification --noredact > "$REPORT_DIR/notifications.txt"
    if grep -Fq "Upcoming: $TEST_ACTIVITY_TITLE" "$REPORT_DIR/notifications.txt"; then
      delivered=true
      break
    fi
    sleep 1
  done
  adb shell dumpsys alarm > "$REPORT_DIR/alarms.txt"
  if [[ "$delivered" != "true" ]]; then
    adb logcat -d -v threadtime > "$REPORT_DIR/reminder-logcat-full.txt"
    echo "Reminder notification was not found in Android notification records." >&2
    grep -Ei "newapk|REMINDER|alarm" "$REPORT_DIR/alarms.txt" | tail -n 60 >&2 || true
    grep -Ei "newapk|notification|alarm|REMINDER" "$REPORT_DIR/reminder-logcat-full.txt" | tail -n 100 >&2 || true
    return 1
  fi
  echo "PASS: Android notification delivered for $TEST_ACTIVITY_TITLE." | tee -a "$REPORT_DIR/reminder-test.txt"
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
dump_ui
TASK_TITLE_PLACEHOLDER="$(ui_focused_edit_text_raw_value "Title" 2>/dev/null || true)"
ui_type_text_slow "$TASK_TITLE" "Title" "$TASK_TITLE_PLACEHOLDER"
ui_wait_edit_text_value "$TASK_TITLE"
capture_stage task-form-ready-to-save
ui_hide_keyboard
dump_ui
ui_click_text "Save"
ui_wait_text_absent "New task"
ui_wait_text "$TASK_TITLE"
capture_stage after-task-save
echo "PASS: task form closed and the saved task row is visible in Tasks." | tee "$REPORT_DIR/task-save-result.txt"

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
ui_click_text "Tasks" bottom
ui_wait_text "$TASK_TITLE"
ui_wait_text_absent "New task"
echo "PASS: locally saved task survived app force-stop and relaunch and is visible in Tasks." | tee "$REPORT_DIR/persistence-result.txt"

# Reminder setup lives on Home, so return there explicitly after the Tasks
# persistence assertion before creating the future activity.
ui_click_text "Home" bottom
ui_wait_text "Make today count."

# Add an activity five minutes ahead, then enable reminders so the app's
# existing catch-up logic schedules the notification within this CI run.
create_activity_reminder
verify_reminder_delivery

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

# Add a live SQLite-backed widget and verify its task content on the launcher.
pin_home_widget "＋ Upcoming Tasks" "UpcomingTasksWidgetProvider" "upcoming-tasks-widget"
ui_wait_text "$TASK_TITLE"
capture_stage upcoming-tasks-widget-home

# Change the source task after pinning. The launcher widget must refresh from
# SQLite without requiring the user to remove and re-add it.
adb shell am start -W -n "$ACTIVITY_NAME" 2>&1 | tee "$REPORT_DIR/reopen-for-widget-refresh.txt"
sleep 3
dump_ui
ui_click_text "Tasks" bottom
ui_wait_text "$TASK_TITLE"
ui_click_text "Mark $TASK_TITLE complete"
ui_wait_checked_checkbox "Mark $TASK_TITLE incomplete"
adb shell input keyevent 3
sleep 3
ui_wait_text "No pending tasks."
capture_stage upcoming-tasks-widget-after-live-refresh
echo "PASS: Upcoming Tasks widget refreshed after the task was completed in NewApk." | tee -a "$REPORT_DIR/widget-results.txt"

# Return to Settings and pin Quick Expense to exercise its deep-link handoff.
adb shell am start -W -n "$ACTIVITY_NAME" 2>&1 | tee "$REPORT_DIR/reopen-for-quick-expense-widget.txt"
sleep 3
dump_ui
adb shell input swipe "$NAV_RIGHT_X" "$TAB_Y" "$NAV_LEFT_X" "$TAB_Y" 450
dump_ui
ui_click_text "Settings" bottom
pin_home_widget "＋ Quick Expense" "QuickExpenseWidgetProvider" "quick-expense-widget"
ui_wait_text "＋ Add expense"
ui_click_text "＋ Add expense"
# The launcher widget itself contains the words "Add expense"; require the
# Budget screen's unique hero label too, so a missed deep link cannot pass.
ui_wait_text "AVAILABLE THIS MONTH"
ui_wait_text "Add expense"
capture_stage quick-expense-widget-handoff
echo "PASS: Quick Expense widget opened the Budget expense form." | tee -a "$REPORT_DIR/widget-results.txt"

# Save a local expense from the widget-opened form and verify the Budget totals.
ui_replace_accessible_input "Details (optional)" "$EXPENSE_TITLE"
ui_replace_accessible_input "Amount (₱)" "$EXPENSE_AMOUNT"
ui_hide_keyboard
dump_ui
ui_click_text "Save transaction"
ui_wait_text "₱25.00"
echo "PASS: Quick Expense saved a ₱25 test transaction and Budget totals refreshed." | tee -a "$REPORT_DIR/widget-results.txt"

# The same transaction must be reflected on Home without a manual reload.
ui_click_text "Home" bottom
ui_wait_text "Budget snapshot"
ui_wait_text "₱25.00"
capture_stage home-budget-sync
echo "PASS: Home Budget snapshot synchronized to the new expense." | tee -a "$REPORT_DIR/widget-results.txt"

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
ui_wait_text "0 tasks to finish"
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

echo "Standalone APK passed offline startup, SQLite task write, process-relaunch persistence, Android reminder notification delivery and primary-module navigation checks; no fatal Android/React Native errors were logged." | tee "$REPORT_DIR/result.txt"
