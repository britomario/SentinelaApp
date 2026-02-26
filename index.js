/**
 * @format
 * Polyfills must be imported before any crypto-dependent code.
 */
import 'react-native-get-random-values';
// WebCrypto polyfill for Hermes (crypto.subtle) - sets global.crypto.subtle
import 'react-native-webview-crypto';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
