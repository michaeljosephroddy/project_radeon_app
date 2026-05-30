import { registerRootComponent } from 'expo';
import './src/utils/installLogBoxStackGuard';
import App from './App';

// Expo looks for a single registered root component when bootstrapping native entry points.
registerRootComponent(App);
