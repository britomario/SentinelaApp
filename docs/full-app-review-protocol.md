# Full App Review Protocol

## 1. Pairing from zero

- Clear app data on parent and child devices.
- Pair via QR code on different Wi-Fi networks.
- Confirm child app auto-loads pairing token and proceeds to PIN setup.

## 2. Realtime location stress

- Start child monitored mode and lock screen.
- Move device physically for at least 5 minutes.
- Confirm parent dashboard map updates with minimal delay.
- Disable network and confirm stale-location alert path works.

## 3. DNS block verification

- Apply child DNS profile in parent config.
- Test blocked domains on Chrome, Firefox and OEM browser.
- Confirm normal domains still resolve.

## 4. Hard exit recovery

- Force-stop child app process.
- Reboot child device.
- Confirm anti-tamper and monitoring state recover automatically.

## 5. Navigation dead-end checks

- Validate every parent tab action and back navigation.
- Validate child restricted mode and master PIN unlock flow.
- Validate no blank screen after PIN on physical device.
