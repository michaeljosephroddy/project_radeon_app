if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    const LogBoxLog = require('react-native/Libraries/LogBox/Data/LogBoxLog').default;
    const prototype = LogBoxLog?.prototype;

    if (prototype && !prototype.__soberSpaceStackGuardInstalled) {
      const getAvailableStack = prototype.getAvailableStack;

      prototype.getAvailableStack = function getAvailableStackWithArrayGuard() {
        const stack = getAvailableStack.call(this);
        return Array.isArray(stack) ? stack : [];
      };

      Object.defineProperty(prototype, '__soberSpaceStackGuardInstalled', {
        value: true,
        enumerable: false,
      });
    }
  } catch {
    // LogBox internals are development-only and may move between React Native releases.
  }
}
