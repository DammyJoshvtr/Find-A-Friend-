try {
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'react-native' || id === 'react-native-svg') {
      return {};
    }
    return originalRequire.apply(this, arguments);
  };

  const lucide = require('../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js');
  const icons = ['MapPin', 'BookOpen', 'Building2', 'Gamepad2', 'Ghost', 'MessageSquare', 'Store', 'User'];
  for (const name of icons) {
    console.log(`${name}:`, typeof lucide[name]);
  }
} catch (e) {
  console.error(e);
}
