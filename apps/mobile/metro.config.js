// Expo auto-configures Metro for pnpm monorepos (watchFolders + symlinked workspace packages).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
