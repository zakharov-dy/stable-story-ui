// Router supplies Linking.getInitialURL() (cold) and Linking's URL event (warm).
// Production Metro replaces this module with the identity handler.
export { redirectSystemPath } from '../src/data/dev/native-intent.ts';
