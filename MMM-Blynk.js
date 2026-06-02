/* MagicMirror²
 * Module: MMM-Blynk
 *
 * Displays Blynk IoT virtual pin (datastream) values from one or more Blynk
 * devices. All HTTP calls happen in node_helper.js via the Blynk HTTPS API,
 * which avoids browser CORS problems and keeps device tokens out of the
 * front-end console.
 *
 * Two layouts:
 *   - table (default): every device and pin shown together.
 *   - rotate: one slide at a time, fading between them like the default
 *     Compliments module (set `rotate: true`).
 *
 * MIT Licensed.
 */
Module.register("MMM-Blynk", {

  defaults: {
    // Blynk cloud server. Use your region for lower latency, e.g.
    // "fra1.blynk.cloud", "ny3.blynk.cloud", "sgp1.blynk.cloud", "lon1.blynk.cloud".
    server: "blynk.cloud",
    title: "", // optional header; falls back to the module `header` config
    updateInterval: 60 * 1000, // how often to poll Blynk, in ms
    animationSpeed: 500, // dom fade speed, in ms
    initialLoadDelay: 0, // delay before the very first poll, in ms
    fontSize: "small", // xsmall | small | medium | large | xlarge
    showDeviceName: true, // render the device name
    showDeviceStatus: true, // show an online/offline dot (1 extra request per device)
    showIcons: true, // render per-pin Font Awesome icons when configured
    naText: "N/A", // shown when a pin has no stored value

    // Optional Compliments-style rotating display.
    rotate: false, // show one slide at a time instead of the full table
    rotateInterval: 10 * 1000, // how long each slide stays on screen, in ms
    rotateBy: "pin", // "pin" (one reading per slide) or "device" (one device per slide)
    rotateRandom: false, // pick the next slide at random instead of in order

    devices: []
    // devices: [
    //   {
    //     name: "Greenhouse",
    //     token: "YourDeviceAuthToken",
    //     // server: "fra1.blynk.cloud", // optional per-device override
    //     pins: [
    //       { pin: "V0", label: "Temperature", unit: "°C", decimals: 1, icon: "fa-temperature-half" },
    //       { pin: "V1", label: "Humidity", unit: "%", decimals: 0, icon: "fa-droplet" }
    //     ]
    //   },
    //   {
    //     name: "Garage",
    //     token: "AnotherDeviceAuthToken",
    //     pins: [
    //       { pin: "V5", label: "Door", map: { "0": "Closed", "1": "Open" }, icon: "fa-warehouse" }
    //     ]
    //   }
    // ]
  },

  getStyles() {
    return ["font-awesome.css", "MMM-Blynk.css"]
  },

  getHeader() {
    return this.config.title || this.data.header || ""
  },

  start() {
    Log.info(`Starting module: ${this.name}`)
    this.loaded = false
    this.devices = []
    this.error = null
    this.rotateIndex = 0
    this.scheduleUpdate(this.config.initialLoadDelay)
    if (this.config.rotate) {
      this.scheduleRotation()
    }
  },

  /**
   * Poll Blynk once after `delay` ms, then repeat every `updateInterval` ms.
   *
   * @param {number} delay - ms to wait before the first fetch.
   */
  scheduleUpdate(delay) {
    const firstDelay = typeof delay === "number" ? delay : 0
    setTimeout(() => {
      this.fetchData()
      this.intervalId = setInterval(() => this.fetchData(), this.config.updateInterval)
    }, firstDelay)
  },

  scheduleRotation() {
    this.rotateTimer = setInterval(() => this.rotateTick(), this.config.rotateInterval)
  },

  /**
   * Advance to the next slide (in order, or at random) and re-render with a fade.
   */
  rotateTick() {
    const slides = this.buildSlides()
    if (slides.length > 1) {
      const current = this.rotateIndex % slides.length
      if (this.config.rotateRandom) {
        let next = current
        while (next === current) {
          next = Math.floor(Math.random() * slides.length)
        }
        this.rotateIndex = next
      } else {
        this.rotateIndex = (current + 1) % slides.length
      }
    }
    this.updateDom(this.config.animationSpeed)
  },

  fetchData() {
    this.sendSocketNotification("BLYNK_GET", {
      identifier: this.identifier,
      config: this.config
    })
  },

  /**
   * Receive results from the node helper. The identifier check keeps multiple
   * instances of this module from reading each other's data.
   *
   * @param {string} notification - The notification identifier.
   * @param {object} payload - Data returned by the node helper.
   */
  socketNotificationReceived(notification, payload) {
    if (!payload || payload.identifier !== this.identifier) {
      return
    }
    if (notification === "BLYNK_DATA") {
      this.loaded = true
      this.error = null
      this.devices = payload.devices
      this.updateDom(this.config.animationSpeed)
    } else if (notification === "BLYNK_ERROR") {
      this.loaded = true
      this.error = payload.message
      this.updateDom(this.config.animationSpeed)
    }
  },

  getDom() {
    const wrapper = document.createElement("div")
    wrapper.className = `mmm-blynk ${this.config.fontSize}`

    if (!this.config.devices || this.config.devices.length === 0) {
      wrapper.className = "mmm-blynk small dimmed light"
      wrapper.innerHTML = "MMM-Blynk: please configure at least one device."
      return wrapper
    }

    if (!this.loaded) {
      wrapper.className = "mmm-blynk small dimmed light"
      wrapper.innerHTML = "Loading …"
      return wrapper
    }

    if (this.error) {
      wrapper.className = "mmm-blynk small dimmed light"
      wrapper.innerHTML = this.error
      return wrapper
    }

    if (this.config.rotate) {
      return this.getRotatingDom(wrapper)
    }
    return this.getTableDom(wrapper)
  },

  getTableDom(wrapper) {
    const table = document.createElement("table")
    table.className = "mmm-blynk-table"

    this.devices.forEach((device) => {
      if (this.config.showDeviceName) {
        table.appendChild(this.createDeviceRow(device))
      }
      if (device.error) {
        table.appendChild(this.createMessageRow(device.error, "blynk-device-error"))
        return
      }
      device.pins.forEach(pin => table.appendChild(this.createPinRow(pin)))
    })

    wrapper.appendChild(table)
    return wrapper
  },

  getRotatingDom(wrapper) {
    wrapper.classList.add("blynk-rotate-wrapper")
    const slides = this.buildSlides()

    if (slides.length === 0) {
      wrapper.className = "mmm-blynk small dimmed light"
      wrapper.innerHTML = "No pins to display."
      return wrapper
    }

    const slide = slides[this.rotateIndex % slides.length]
    wrapper.appendChild(this.renderSlide(slide))
    return wrapper
  },

  /**
   * Flatten the current device data into an ordered list of slides.
   * `rotateBy: "pin"` yields one slide per reading; `"device"` yields one slide
   * per device (showing all of its pins).
   *
   * @returns {Array} The slide list.
   */
  buildSlides() {
    const slides = []
    this.devices.forEach((device) => {
      if (this.config.rotateBy === "device") {
        slides.push({ type: "device", device })
        return
      }
      if (device.error) {
        slides.push({ type: "deviceError", device })
        return
      }
      device.pins.forEach(pin => slides.push({ type: "pin", device, pin }))
    })
    return slides
  },

  renderSlide(slide) {
    if (slide.type === "device") {
      return this.renderDeviceSlide(slide.device)
    }
    if (slide.type === "deviceError") {
      const container = document.createElement("div")
      container.className = "blynk-slide"
      container.appendChild(this.createDeviceNameNode(slide.device))
      const message = document.createElement("div")
      message.className = "blynk-device-error"
      message.textContent = slide.device.error
      container.appendChild(message)
      return container
    }
    return this.renderPinSlide(slide.device, slide.pin)
  },

  renderPinSlide(device, pin) {
    const container = document.createElement("div")
    container.className = "blynk-slide blynk-slide-pin"

    if (this.config.showDeviceName) {
      container.appendChild(this.createDeviceNameNode(device))
    }

    const valueLine = document.createElement("div")
    valueLine.className = "blynk-slide-value bright"
    if (this.config.showIcons && pin.icon) {
      const icon = document.createElement("i")
      icon.className = `fa fa-fw ${pin.icon}`
      valueLine.appendChild(icon)
      valueLine.appendChild(document.createTextNode(" "))
    }
    valueLine.appendChild(document.createTextNode(pin.display))
    container.appendChild(valueLine)

    const label = document.createElement("div")
    label.className = "blynk-slide-label dimmed"
    label.textContent = pin.label
    container.appendChild(label)

    return container
  },

  renderDeviceSlide(device) {
    const container = document.createElement("div")
    container.className = "blynk-slide"

    const table = document.createElement("table")
    table.className = "mmm-blynk-table"
    if (this.config.showDeviceName) {
      table.appendChild(this.createDeviceRow(device))
    }
    if (device.error) {
      table.appendChild(this.createMessageRow(device.error, "blynk-device-error"))
    } else {
      device.pins.forEach(pin => table.appendChild(this.createPinRow(pin)))
    }
    container.appendChild(table)
    return container
  },

  /**
   * A device-name line with an optional online/offline dot, used by slides.
   *
   * @param {object} device - The device data.
   * @returns {HTMLElement} The name element.
   */
  createDeviceNameNode(device) {
    const name = document.createElement("div")
    name.className = "blynk-slide-device dimmed"
    if (this.config.showDeviceStatus) {
      const dot = document.createElement("span")
      dot.className = `blynk-status ${device.online ? "blynk-online" : "blynk-offline"}`
      dot.title = device.online ? "Online" : "Offline"
      name.appendChild(dot)
    }
    name.appendChild(document.createTextNode(device.name))
    return name
  },

  createDeviceRow(device) {
    const row = document.createElement("tr")
    row.className = "blynk-device-row"

    const cell = document.createElement("td")
    cell.className = "blynk-device-name bright"
    cell.colSpan = 3

    if (this.config.showDeviceStatus) {
      const dot = document.createElement("span")
      dot.className = `blynk-status ${device.online ? "blynk-online" : "blynk-offline"}`
      dot.title = device.online ? "Online" : "Offline"
      cell.appendChild(dot)
    }

    cell.appendChild(document.createTextNode(device.name))
    row.appendChild(cell)
    return row
  },

  createPinRow(pin) {
    const row = document.createElement("tr")
    row.className = "blynk-pin-row"

    if (this.config.showIcons) {
      const iconCell = document.createElement("td")
      iconCell.className = "blynk-icon dimmed"
      if (pin.icon) {
        const icon = document.createElement("i")
        icon.className = `fa fa-fw ${pin.icon}`
        iconCell.appendChild(icon)
      }
      row.appendChild(iconCell)
    }

    const labelCell = document.createElement("td")
    labelCell.className = "blynk-label dimmed"
    labelCell.textContent = pin.label
    row.appendChild(labelCell)

    const valueCell = document.createElement("td")
    valueCell.className = "blynk-value bright align-right"
    valueCell.textContent = pin.display
    row.appendChild(valueCell)

    return row
  },

  createMessageRow(message, className) {
    const row = document.createElement("tr")
    const cell = document.createElement("td")
    cell.colSpan = 3
    cell.className = `${className} dimmed`
    cell.textContent = message
    row.appendChild(cell)
    return row
  }
})
