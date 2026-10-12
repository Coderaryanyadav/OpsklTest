# Mobile Development: Simulators, Emulators & Physical Devices

## 1. iOS Simulator (macOS)
1. Install **Xcode** from the Mac App Store.
2. Install Command Line Tools:
   ```bash
   xcode-select --install
   ```
3. Open Xcode > Settings > Platforms, and install the latest iOS Simulator runtime (e.g. iOS 18).
4. Run the desired app:
   ```bash
   npm run ios:worker
   # or
   npm run ios:organizer
   ```

---

## 2. Android Emulator (macOS / Windows / Linux)
1. Install **Android Studio**.
2. Open Android Studio > Virtual Device Manager, and create an AVD (e.g. Pixel 8 with Android API 34/35).
3. Ensure Android SDK platform tools are on your system PATH (`adb` command available):
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
4. Start the emulator and run:
   ```bash
   npm run android:worker
   # or
   npm run android:organizer
   ```

---

## 3. Physical Devices (Expo Go)
1. Install **Expo Go** from Apple App Store (iOS) or Google Play Store (Android).
2. Ensure your mobile phone and development machine are connected to the same Wi-Fi network.
3. Start the app:
   ```bash
   npm run start:worker
   ```
4. iOS: Open the native Camera app and tap the QR code banner.
5. Android: Open the Expo Go app, select "Scan QR code", and point at the terminal.
*If on different subnets/firewalls, pass tunnel mode: `npx expo start --tunnel`.*

---

## 4. Standalone Builds (Expo EAS Build)
Each mobile app includes a preconfigured `eas.json` supporting `development`, `preview` (internal APK / Ad-Hoc IPA), and `production` (Play Store / TestFlight).

```bash
# Login to EAS
npx eas-cli login

# Build internal preview APK for Android
cd apps/worker
npx eas-cli build --platform android --profile preview

# Build internal Ad-Hoc build for iOS
npx eas-cli build --platform ios --profile preview
```
