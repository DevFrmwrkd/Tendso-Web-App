const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withAndroidOptimization(config) {
  return withAppBuildGradle(config, (config) => {
    const defaultProguardFile = /^[ \t]*proguardFiles[ \t]+getDefaultProguardFile\(\s*(['"])proguard-android(?:-optimize)?\.txt\1\s*\)/m;

    if (config.modResults.language !== 'groovy' || !defaultProguardFile.test(config.modResults.contents)) {
      throw new Error(
        'withAndroidOptimization expected a Groovy proguardFiles getDefaultProguardFile entry in android/app/build.gradle using proguard-android.txt or proguard-android-optimize.txt.'
      );
    }

    config.modResults.contents = config.modResults.contents.replace(
      defaultProguardFile,
      (entry) => entry.replace('proguard-android.txt', 'proguard-android-optimize.txt')
    );

    return config;
  });
};
