const { withProjectBuildGradle } = require("@expo/config-plugins");

const KSP_CLASSPATH = `classpath('com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:2.1.20-2.0.1')`;

const withKsp = (config) => {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("com.google.devtools.ksp")) {
      return mod;
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      "classpath('com.facebook.react:react-native-gradle-plugin')",
      `classpath('com.facebook.react:react-native-gradle-plugin')\n        ${KSP_CLASSPATH}`
    );
    return mod;
  });
};

module.exports = withKsp;
