import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

const brand = "#673EB7";

export default defineConfig({
  preset: combinePresetAndAppleSplashScreens(
    {
      ...minimal2023Preset,
      maskable: {
        ...minimal2023Preset.maskable,
        padding: 0.05,
        resizeOptions: {
          ...minimal2023Preset.maskable.resizeOptions,
          background: brand,
          fit: "contain",
        },
      },
      apple: {
        ...minimal2023Preset.apple,
        padding: 0.03,
        resizeOptions: {
          ...minimal2023Preset.apple.resizeOptions,
          background: brand,
          fit: "contain",
        },
      },
    },
    {
      padding: 0.3,
      resizeOptions: { background: brand, fit: "contain" },
      linkMediaOptions: { addMediaScreen: true, basePath: "/", xhtml: false },
    },
  ),
  images: ["assets/Prompt 2.png"],
});
