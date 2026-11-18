# Tank Spartan: Portal Siege — Android APK Build Guide

This project is configured with **Capacitor 7** to build a native Android APK for devices such as **Vivo T4x**, **Redmi 9A**, and other Android phones.

---

## Method 1: Automatic Cloud Build (Recommended — No Android Studio Required)

This repository includes a GitHub Actions workflow at [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml).

1. Push this project to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initialize Tank Spartan Android project"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Open your repository on GitHub in your browser.
3. Click the **Actions** tab at the top.
4. Select the **Build Android APK** workflow run.
5. Under **Artifacts** at the bottom of the page, download **`Tank-Spartan-Debug-APK`**.
6. Extract the zip file to get `app-debug.apk` and transfer it to your phone!

---

## Method 2: Local Build with Android Studio

If you have or want to install **Android Studio** on your PC:

### Prerequisites:
- **Node.js**: Installed (`node -v`)
- **JDK 21**: Already installed on your PC at `C:\Program Files\Java\jdk-21.0.12`
- **Android Studio**: [Download Android Studio](https://developer.android.com/studio)

### Steps:

1. **Install Node Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Production Web Assets**:
   ```bash
   npm run build
   ```

3. **Initialize the Android Native Project**:
   ```bash
   npx cap add android
   ```

4. **Sync Assets to Android**:
   ```bash
   npx cap sync android
   ```

5. **Open in Android Studio & Generate APK**:
   ```bash
   npx cap open android
   ```
   - In Android Studio, wait for Gradle sync to complete.
   - Go to menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Once finished, click **locate** in the popup notification to get your `app-debug.apk`.

---

## Method 3: Instant 1-Click Online Generation (PWABuilder)

Since this game is already a 100% compliant Progressive Web App (PWA):

1. Deploy the `dist/` build to any free hosting provider ([Vercel](https://vercel.com), [Netlify](https://netlify.com), or [GitHub Pages](https://pages.github.com)).
2. Go to [https://www.pwabuilder.com/](https://www.pwabuilder.com/).
3. Paste your live URL and click **Start**.
4. Click **Package for Android** -> **Generate APK / AAB**.
5. Download your signed, ready-to-install `.apk` in seconds.

---

## Installing on Your Phone (Vivo T4x / Redmi 9A)

1. Send `app-debug.apk` to your phone via:
   - USB cable
   - WhatsApp / Telegram (Save to Downloads)
   - Google Drive
2. Tap `app-debug.apk` in your phone's File Manager.
3. If prompted:
   - **Vivo (Funtouch OS)**: Tap *Settings* -> Enable *Allow from this source* -> Tap *Install*.
   - **Redmi (MIUI / HyperOS)**: Tap *Settings* -> Enable *Install unknown apps* -> Accept safety disclaimer -> Tap *Install*.
4. Launch **Tank Spartan** and play in full-screen landscape!
