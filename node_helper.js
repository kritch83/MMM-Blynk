/* MagicMirror²
 * Node Helper: MMM-Blynk
 *
 * Talks to the Blynk IoT HTTPS API. One request per device fetches all of that
 * device's configured pins; an optional second request reports whether the
 * hardware is currently connected.
 *
 * Blynk IoT API reference:
 *   https://docs.blynk.io/en/blynk.cloud/device-https-api
 *
 * MIT Licensed.
 */
const NodeHelper = require("node_helper")

module.exports = NodeHelper.create({

  socketNotificationReceived(notification, payload) {
    if (notification === "BLYNK_GET") {
      this.fetchAll(payload.identifier, payload.config)
    }
  },

  async fetchAll(identifier, config) {
    try {
      const devices = await Promise.all(
        (config.devices || []).map(device => this.fetchDevice(device, config))
      )
      this.sendSocketNotification("BLYNK_DATA", { identifier, devices })
    } catch (error) {
      this.sendSocketNotification("BLYNK_ERROR", {
        identifier,
        message: `MMM-Blynk error: ${error.message}`
      })
    }
  },

  /**
   * Fetch one device's pin values (and, optionally, its connection state).
   * Failures are captured per device so one bad token does not blank the rest.
   *
   * @param {object} device - A single entry from the `devices` config array.
   * @param {object} config - The full module config (for global defaults).
   * @returns {Promise<object>} Render-ready device data.
   */
  async fetchDevice(device, config) {
    const result = {
      name: device.name || "Device",
      online: false,
      error: null,
      pins: []
    }

    if (!device.token) {
      result.error = "Missing device token"
      return result
    }

    const server = this.normalizeServer(device.server || config.server)
    const token = encodeURIComponent(device.token)
    const pinsConfig = device.pins || []

    try {
      if (config.showDeviceStatus) {
        const statusUrl = `https://${server}/external/api/isHardwareConnected?token=${token}`
        const statusText = await this.fetchText(statusUrl)
        result.online = statusText.trim() === "true"
      }

      let values = {}
      if (pinsConfig.length > 0) {
        const pinQuery = pinsConfig.map(p => encodeURIComponent(p.pin)).join("&")
        const valuesUrl = `https://${server}/external/api/get?token=${token}&${pinQuery}`
        const valuesText = await this.fetchText(valuesUrl)
        values = this.parseValues(valuesText, pinsConfig)
      }

      result.pins = pinsConfig.map(p => ({
        pin: p.pin,
        label: p.label || p.pin,
        icon: p.icon || "",
        display: this.formatValue(values[String(p.pin).toLowerCase()], p, config.naText)
      }))
    } catch (error) {
      result.error = error.message
      result.online = false
    }

    return result
  },

  /**
   * Turn a Blynk response body into a { pinName: value } map keyed lower-case.
   * A request for a single pin returns the bare value; multiple pins return a
   * JSON object. Both shapes are handled here.
   *
   * @param {string} text - Raw response body.
   * @param {Array} pinsConfig - The device's configured pins.
   * @returns {object} Map of lower-case pin name to raw value.
   */
  parseValues(text, pinsConfig) {
    const trimmed = (text || "").trim()
    const values = {}

    if (pinsConfig.length === 1) {
      values[String(pinsConfig[0].pin).toLowerCase()] = this.coerce(trimmed)
      return values
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach((key) => {
          values[key.toLowerCase()] = parsed[key]
        })
      }
    } catch {
      // Unparseable multi-pin response: leave the map empty so pins show naText.
    }
    return values
  },

  /**
   * Best-effort conversion of a bare response body to a JS value. Numbers,
   * booleans and arrays parse as JSON; anything else stays a string.
   *
   * @param {string} text - Trimmed response body.
   * @returns {*} The coerced value.
   */
  coerce(text) {
    if (text === "") {
      return ""
    }
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  },

  /**
   * Format a raw pin value for display using its per-pin options.
   *
   * @param {*} raw - The value from Blynk.
   * @param {object} pinConfig - { unit, decimals, map }.
   * @param {string} naText - Fallback text for missing values.
   * @returns {string} The display string.
   */
  formatValue(raw, pinConfig, naText) {
    if (raw === undefined || raw === null || raw === "") {
      return naText
    }

    const key = String(raw)
    if (pinConfig.map && Object.prototype.hasOwnProperty.call(pinConfig.map, key)) {
      return this.appendUnit(pinConfig.map[key], pinConfig.unit)
    }

    let value = raw
    if (Array.isArray(raw)) {
      value = raw.join(", ")
    } else if (typeof pinConfig.decimals === "number" && !Number.isNaN(Number(raw))) {
      value = Number(raw).toFixed(pinConfig.decimals)
    }

    return this.appendUnit(value, pinConfig.unit)
  },

  appendUnit(value, unit) {
    return unit ? `${value}${unit}` : `${value}`
  },

  normalizeServer(server) {
    return String(server || "blynk.cloud")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
  },

  /**
   * GET a URL and return its body as text, with a timeout and Blynk-aware
   * error messages.
   *
   * @param {string} url - The full request URL.
   * @param {number} timeoutMs - Abort after this many ms.
   * @returns {Promise<string>} The response body.
   */
  async fetchText(url, timeoutMs = 10000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { signal: controller.signal })
      const body = await response.text()
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const parsed = JSON.parse(body)
          if (parsed && parsed.error && parsed.error.message) {
            message = parsed.error.message
          }
        } catch {
          // Non-JSON error body: keep the HTTP status message.
        }
        throw new Error(message)
      }
      return body
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Request timed out")
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
})
