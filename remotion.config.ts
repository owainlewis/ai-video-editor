import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
// ProRes (reel export) takes no CRF, so it is set only when exporting H.264.
if (!process.env.REEL_PRORES) Config.setCrf(17);
Config.setPublicDir("projects");
