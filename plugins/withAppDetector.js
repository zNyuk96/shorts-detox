const { withAndroidManifest, withPlugins } = require("@expo/config-plugins");

// ── 1. 권한 + 쿼리 패키지 + 서비스 등록 ──
const withAndroidConfig = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;

    // xmlns:tools
    if (!manifest.manifest.$["xmlns:tools"]) {
      manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    // uses-permission
    if (!manifest.manifest["uses-permission"]) manifest.manifest["uses-permission"] = [];
    const permissions = manifest.manifest["uses-permission"];
    const addPerm = (name, extra = {}) => {
      if (!permissions.some((p) => p.$?.["android:name"] === name)) {
        permissions.push({ $: { "android:name": name, ...extra } });
      }
    };
    addPerm("android.permission.PACKAGE_USAGE_STATS", { "tools:ignore": "ProtectedPermissions" });
    addPerm("android.permission.FOREGROUND_SERVICE");
    addPerm("android.permission.FOREGROUND_SERVICE_DATA_SYNC");
    addPerm("android.permission.BIND_VPN_SERVICE");

    // queries
    if (!manifest.manifest.queries) manifest.manifest.queries = [{ package: [] }];
    if (!manifest.manifest.queries[0].package) manifest.manifest.queries[0].package = [];
    const targets = [
      "com.google.android.youtube",
      "com.zhiliaoapp.musically",
      "com.ss.android.ugc.tiktok",
      "com.instagram.android",
      "com.facebook.katana",
    ];
    const existing = manifest.manifest.queries[0].package.map((p) => p.$?.["android:name"]);
    for (const pkg of targets) {
      if (!existing.includes(pkg))
        manifest.manifest.queries[0].package.push({ $: { "android:name": pkg } });
    }

    // services
    const app = manifest.manifest.application[0];
    if (!app.service) app.service = [];

    const hasService = (name) => app.service.some((s) => s.$?.["android:name"] === name);

    // AppMonitorService (Foreground Service)
    if (!hasService("com.shortsdetox.appdetector.AppMonitorService")) {
      app.service.push({
        $: {
          "android:name": "com.shortsdetox.appdetector.AppMonitorService",
          "android:foregroundServiceType": "dataSync",
          "android:exported": "false",
        },
      });
    }

    // ShortsVpnService (VPN DNS 차단)
    if (!hasService("com.shortsdetox.appdetector.vpn.ShortsVpnService")) {
      app.service.push({
        $: {
          "android:name": "com.shortsdetox.appdetector.vpn.ShortsVpnService",
          "android:permission": "android.permission.BIND_VPN_SERVICE",
          "android:exported": "false",
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.net.VpnService" } }] },
        ],
      });
    }

    return mod;
  });
};

module.exports = (config) => withPlugins(config, [withAndroidConfig]);
