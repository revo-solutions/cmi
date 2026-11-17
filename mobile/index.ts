import { registerRootComponent } from 'expo';

import App from './App';
import './src/lib/heartbeat';

// Registers the notification task at startup, which a "Tomei" tapped with the app closed needs.
import './src/lib/reminders';

registerRootComponent(App);
