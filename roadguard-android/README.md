# Road Guard Android wrapper

This Android app opens the production PWA shell at `https://flipkart-06iz.onrender.com/webapp/`.
The website and API remain hosted services; the APK does not contain a second database or backend.

Build a locally installable debug APK with Java 17 and Android SDK 35 by
running `gradlew.bat assembleDebug` from this directory (or `./gradlew assembleDebug` on macOS/Linux).
The debug APK is suitable for sideloading on a
personal Android phone. Public distribution should use a separately managed release signing key and
a production release build.
