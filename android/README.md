# G.I Bookshelf — Native Android

This is a native Kotlin + Jetpack Compose companion to the existing Next.js G.I Bookshelf repository. The web application remains intact.

## Native build features
- Android 8.0+ baseline; targets Android 10 / ARMv7 compatibility.
- Import local PDF files through Android Storage Access Framework.
- Persist document URI permissions and maintain a local bookshelf.
- Render PDF pages with Android PdfRenderer.
- Extract selectable PDF text offline with PDFBox-Android.
- Previous/next page navigation and local library records.
- Optional Android TextToSpeech voice if a Burmese voice is installed.
- Midnight chocolate / metallic gold visual identity and native launcher vector icon.

## MyanmarTTS integration status
The upstream MyanmarTTS weights are PyTorch StableTTS + Vocos checkpoints. They are not an Android inference runtime. Copying model files into an APK does not make inference work. Android graph conversion, an ARMv7-compatible runtime, memory profiling, and device validation are still required. This first native build does not claim MyanmarTTS inference is working. The voice button uses the Android system TTS only when a Burmese voice is available; it does not silently fall back to a cloud service.

Scanned/image-only PDF OCR is not included in this build.

## Build
GitHub Actions builds a debug APK on pushes to the native Android branch and on manual dispatch. The APK is uploaded as a workflow artifact.

Package ID: com.ikoko.gibookshelf
