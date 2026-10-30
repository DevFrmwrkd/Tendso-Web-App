const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Expo SDK 54 discovers the npm workspace and configures Metro for it.
const config = getDefaultConfig(__dirname);
// The canonical generated API lives outside an npm workspace package.
config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []),
    path.resolve(__dirname, '../../convex/_generated'),
    path.resolve(__dirname, '../../lib'),
    // Field-agent design choices use the canonical, framework-free catalog.
    path.resolve(__dirname, '../../components/editor'),
  ]),
];

// Windows + Node 24 has been flaky during release bundles — jest-worker IPC
// drops pipes under high parallelism, surfacing as "write UNKNOWN" errors
// during `gradlew assembleRelease`. Capping workers avoids the crash.
// Safe to remove after upgrading Node to a known-stable LTS.
config.maxWorkers = 2;

// Hoisted native libraries must use this app's React, including JSX runtimes,
// rather than the web app's newer React. Preserve Expo's resolver behavior.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  const appContext = /^(react|react-dom)(\/|$)/.test(moduleName)
    ? { ...context, originModulePath: path.join(__dirname, 'package.json') }
    : context;
  return resolve(appContext, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: path.resolve(__dirname, 'global.css'),
  configPath: path.resolve(__dirname, 'tailwind.config.js'),
  // The checked-in declaration and tsconfig include already provide this.
  disableTypeScriptGeneration: true,
});
