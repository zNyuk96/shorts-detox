const { withAndroidManifest, withPlugins } = require("@expo/config-plugins");

const withUsageStatsPermission = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;

    if (!manifest.manifest["uses-permission"]) manifest.manifest["uses-permission"] = [];
    const permissions = manifest.manifest["uses-permission"];
    const perm = "android.permission.PACKAGE_USAGE_STATS";
    if (!permissions.some((p) => p.$?.["android:name"] === perm)) {
      permissions.push({ $: { "android:name": perm, "tools:ignore": "ProtectedPermissions" } });
    }

    const attrs = manifest.manifest.$;
    if (!attrs["xmlns:tools"]) attrs["xmlns:tools"] = "http://schemas.android.com/tools";

    const targets = [
      "com.google.android.youtube",
      "com.zhiliaoapp.musically",
      "com.ss.android.ugc.tiktok",
      "com.instagram.android",
      "com.facebook.katana",
    ];

    if (!manifest.manifest.queries) manifest.manifest.queries = [{ package: [] }];
    if (!manifest.manifest.queries[0].package) manifest.manifest.queries[0].package = [];

    const existing = manifest.manifest.queries[0].package.map((p) => p.$?.["android:name"]);
    for (const pkg of targets) {
      if (!existing.includes(pkg)) manifest.manifest.queries[0].package.push({ $: { "android:name": pkg } });
    }

    return mod;
  });
};

module.exports = (config) => withPlugins(config, [withUsageStatsPermission]);
