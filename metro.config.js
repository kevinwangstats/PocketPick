if (process.env.MOONSHOT_API_KEY && !process.env.EXPO_PUBLIC_MOONSHOT_API_KEY) {
  process.env.EXPO_PUBLIC_MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
