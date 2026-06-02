# MMM-Blynk

A module for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) that displays
[Blynk IoT](https://blynk.io) **virtual pin (datastream) values from one or more devices**.

Each Blynk device has its own auth token, so this module reads from every device you list and
shows their pins together. Values are fetched server-side by the node helper through the
[Blynk HTTPS API](https://docs.blynk.io/en/blynk.cloud/device-https-api), which avoids browser
CORS issues and keeps your tokens out of the front-end.

> **Blynk version:** This module targets **Blynk IoT (Blynk 2.0 / blynk.cloud)**. The legacy
> Blynk 0.1 cloud (`blynk-cloud.com`) is shut down and is not supported. If you self-host the
> legacy server its API differs and will not work here.

## Screenshot

```text
Greenhouse
  🌡  Temperature        23.4°C
  💧  Humidity              48%
Garage
  🚪  Door                 Open
```

*(Add your own `example.png` and reference it here once it's running.)*

## Installation

### Install

Clone (or copy) this folder into your MagicMirror `modules` directory. The folder **must** be
named `MMM-Blynk`:

```bash
cd ~/MagicMirror/modules
git clone <your-repo-url> MMM-Blynk
```

No runtime dependencies are required (the module uses Node's built-in `fetch`, available in
Node 18+, which MagicMirror already requires).

### Update

```bash
cd ~/MagicMirror/modules/MMM-Blynk
git pull
```

## Prerequisites

For each device you want to show, from the [Blynk Console](https://blynk.cloud):

1. Create the **datastreams** (virtual pins, e.g. `V0`, `V1`) your firmware writes to.
2. Open the device → **Device Info** and copy its **AuthToken**.
3. Note your server region (top-left of the console, e.g. `fra1.blynk.cloud`,
   `ny3.blynk.cloud`, `sgp1.blynk.cloud`, `lon1.blynk.cloud`). The generic `blynk.cloud` also
   works but a regional host is slightly faster.

## Configuration

Add a configuration block to the `modules` array in `config/config.js`.

### Example configuration

```js
{
  module: "MMM-Blynk",
  position: "top_right",
  header: "Blynk",
  config: {
    server: "blynk.cloud",
    updateInterval: 60 * 1000,
    devices: [
      {
        name: "Greenhouse",
        token: "YourDeviceAuthToken",
        pins: [
          { pin: "V0", label: "Temperature", unit: "°C", decimals: 1, icon: "fa-temperature-half" },
          { pin: "V1", label: "Humidity", unit: "%", decimals: 0, icon: "fa-droplet" }
        ]
      },
      {
        name: "Garage",
        token: "AnotherDeviceAuthToken",
        // server: "ny3.blynk.cloud", // optional per-device override
        pins: [
          { pin: "V5", label: "Door", icon: "fa-warehouse", map: { "0": "Closed", "1": "Open" } }
        ]
      }
    ]
  }
}
```

### Module options

| Option             | Type      | Default        | Description                                                                 |
| ------------------ | --------- | -------------- | --------------------------------------------------------------------------- |
| `server`           | `string`  | `"blynk.cloud"`| Default Blynk server host. Can be overridden per device.                    |
| `title`            | `string`  | `""`           | Optional header text. If empty, the standard `header` config field is used. |
| `updateInterval`   | `number`  | `60000`        | How often to poll Blynk, in ms.                                             |
| `animationSpeed`   | `number`  | `500`          | DOM fade speed on update, in ms.                                            |
| `initialLoadDelay` | `number`  | `0`            | Delay before the first poll, in ms.                                         |
| `fontSize`         | `string`  | `"small"`      | One of MagicMirror's sizes: `xsmall`, `small`, `medium`, `large`, `xlarge`. |
| `showDeviceName`   | `boolean` | `true`         | Show a header row with each device's name.                                  |
| `showDeviceStatus` | `boolean` | `true`         | Show an online/offline dot. Adds **one extra request per device** per poll. |
| `showIcons`        | `boolean` | `true`         | Render per-pin Font Awesome icons when a pin defines `icon`.                |
| `naText`           | `string`  | `"N/A"`        | Text shown when a pin has no stored value.                                  |
| `rotate`           | `boolean` | `false`        | Show one slide at a time (Compliments-style) instead of the full table.     |
| `rotateInterval`   | `number`  | `10000`        | ms each slide stays on screen. Only used when `rotate: true`.               |
| `rotateBy`         | `string`  | `"pin"`        | `"pin"` = one reading per slide; `"device"` = one device (all pins) per slide. |
| `rotateRandom`     | `boolean` | `false`        | Pick the next slide at random instead of in order.                          |
| `devices`          | `array`   | `[]`           | The list of devices to read. See below.                                     |

### Device options (each entry in `devices`)

| Option   | Type     | Required | Description                                                       |
| -------- | -------- | -------- | ----------------------------------------------------------------- |
| `name`   | `string` | no       | Label shown above the device's pins. Defaults to `"Device"`.      |
| `token`  | `string` | **yes**  | The device AuthToken from Blynk → Device Info.                    |
| `server` | `string` | no       | Per-device server host override (defaults to the module `server`).|
| `pins`   | `array`  | **yes**  | The datastreams to display. See below.                            |

### Pin options (each entry in a device's `pins`)

| Option     | Type     | Required | Description                                                                          |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `pin`      | `string` | **yes**  | Virtual pin / datastream, e.g. `"V0"` (case-insensitive).                            |
| `label`    | `string` | no       | Display label. Defaults to the pin name.                                             |
| `unit`     | `string` | no       | Appended verbatim after the value. Include a leading space if you want one (`" W"`). |
| `decimals` | `number` | no       | Round numeric values to this many decimal places.                                    |
| `icon`     | `string` | no       | A [Font Awesome](https://fontawesome.com/icons) class, e.g. `"fa-temperature-half"`. |
| `map`      | `object` | no       | Map raw values to text, e.g. `{ "0": "Closed", "1": "Open" }`. Matched as strings.   |

## Rotating display

By default every device and pin is shown together in a table. Set `rotate: true` to instead
cycle through one item at a time, fading between them like the default Compliments module —
handy for a small or center region. Each slide shows for `rotateInterval` ms and fades using
`animationSpeed`.

```js
{
  module: "MMM-Blynk",
  position: "top_center",
  config: {
    rotate: true,
    rotateInterval: 10 * 1000,
    rotateBy: "pin", // or "device"
    devices: [ /* … same as above … */ ]
  }
}
```

- `rotateBy: "pin"` (default) shows the device name, the value (enlarged), and the label, one
  reading per slide.
- `rotateBy: "device"` shows one device and all of its pins per slide.
- `rotateRandom: true` picks the next slide at random instead of cycling in order.

## How it works

- For each device, the node helper makes **one** request for all of that device's pins
  (`/external/api/get?token=…&V0&V1`) and, if `showDeviceStatus` is on, one request to
  `/external/api/isHardwareConnected`.
- A failing device (bad token, network error) shows an inline error and does not blank the others.
- Keep `updateInterval` reasonable (the default 60s is plenty for a wall display) to stay within
  Blynk's HTTP API rate limits.

## Developer commands

- `npm install` — install devDependencies (ESLint).
- `npm run lint` — run lint / formatter checks.
- `npm run lint:fix` — auto-fix lint / formatting issues.

## License

MIT — see [LICENSE.md](LICENSE.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
