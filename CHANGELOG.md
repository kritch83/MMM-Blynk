# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 - 2026-06-01
### Added
- Initial release.
- Read virtual pin (datastream) values from multiple Blynk IoT devices.
- One batched request per device for all configured pins.
- Optional per-device online/offline status via `isHardwareConnected`.
- Per-pin `label`, `unit`, `decimals`, `icon`, and value `map` options.
- Per-device `server` override and configurable `fontSize`.
- Optional Compliments-style rotating display (`rotate`, `rotateInterval`,
  `rotateBy`, `rotateRandom`) that fades through one slide at a time.
