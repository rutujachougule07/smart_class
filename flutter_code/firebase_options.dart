import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
/// Connected to Firebase Project: smartclass-3e828
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE',
    appId: '1:315485791146:web:68257ef1f1ff327d4c01d3',
    messagingSenderId: '315485791146',
    projectId: 'smartclass-3e828',
    authDomain: 'smartclass-3e828.firebaseapp.com',
    storageBucket: 'smartclass-3e828.firebasestorage.app',
    measurementId: 'G-E53GVH3JP3',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE',
    appId: '1:315485791146:android:68257ef1f1ff327d4c01d3',
    messagingSenderId: '315485791146',
    projectId: 'smartclass-3e828',
    storageBucket: 'smartclass-3e828.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE',
    appId: '1:315485791146:ios:68257ef1f1ff327d4c01d3',
    messagingSenderId: '315485791146',
    projectId: 'smartclass-3e828',
    storageBucket: 'smartclass-3e828.firebasestorage.app',
    iosBundleId: 'com.example.smartclass',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE',
    appId: '1:315485791146:ios:68257ef1f1ff327d4c01d3',
    messagingSenderId: '315485791146',
    projectId: 'smartclass-3e828',
    storageBucket: 'smartclass-3e828.firebasestorage.app',
    iosBundleId: 'com.example.smartclass',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE',
    appId: '1:315485791146:web:68257ef1f1ff327d4c01d3',
    messagingSenderId: '315485791146',
    projectId: 'smartclass-3e828',
    authDomain: 'smartclass-3e828.firebaseapp.com',
    storageBucket: 'smartclass-3e828.firebasestorage.app',
  );
}
