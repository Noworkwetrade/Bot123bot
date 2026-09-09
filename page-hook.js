(function () {
  if (window.__NWWT_PAGE_HOOK__) return
  window.__NWWT_PAGE_HOOK__ = true

  const OriginalWebSocket = window.WebSocket

  let activeAsset = null
  let activePeriod = null

  function send(data) {
    window.postMessage(
      {
        source: "NWWT_PAGE_HOOK",
        data
      },
      "*"
    )
  }

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value)
  }

  function normalizeTimestamp(value) {
    if (!isNumber(value)) return null

    if (value < 10000000000) {
      return value * 1000
    }

    return value
  }

  function normalizeCandle(item, fallbackAsset = null) {
    if (!Array.isArray(item)) return null

    if (item.length >= 5) {
      const timestamp = normalizeTimestamp(Number(item[0]))
      const open = Number(item[1])
      const close = Number(item[2])
      const high = Number(item[3])
      const low = Number(item[4])

      if (
        timestamp &&
        isNumber(open) &&
        isNumber(close) &&
        isNumber(high) &&
        isNumber(low)
      ) {
        return {
          asset: fallbackAsset || activeAsset,
          timestamp,
          open,
          close,
          high,
          low
        }
      }
    }

    return null
  }

  function normalizeObjectCandle(item, fallbackAsset = null) {
    if (!item || typeof item !== "object") {
      return null
    }

    const timestamp =
      normalizeTimestamp(
        Number(
          item.timestamp ??
          item.time ??
          item.t ??
          item.from ??
          item.at
        )
      )

    const open = Number(item.open ?? item.o)
    const close = Number(item.close ?? item.c)
    const high = Number(item.high ?? item.h)
    const low = Number(item.low ?? item.l)

    if (
      timestamp &&
      isNumber(open) &&
      isNumber(close) &&
      isNumber(high) &&
      isNumber(low)
    ) {
      return {
        asset:
          item.asset ??
          item.symbol ??
          item.active ??
          fallbackAsset ??
          activeAsset,
        timestamp,
        open,
        close,
        high,
        low
      }
    }

    return null
  }

  function processCandle(item, fallbackAsset = null) {
    const candle =
      normalizeCandle(item, fallbackAsset) ||
      normalizeObjectCandle(item, fallbackAsset)

    if (!candle) return

    send({
      type: "candle",
      candle
    })
  }

  function scanValue(value, fallbackAsset = null) {
    if (value == null) return

    if (Array.isArray(value)) {
      const direct = normalizeCandle(value, fallbackAsset)

      if (direct) {
        send({
          type: "candle",
          candle: direct
        })

        return
      }

      for (const item of value) {
        const objectCandle = normalizeObjectCandle(item, fallbackAsset)

        if (objectCandle) {
          send({
            type: "candle",
            candle: objectCandle
          })

          continue
        }

        if (Array.isArray(item)) {
          processCandle(item, fallbackAsset)
        }
      }

      return
    }

    if (typeof value === "object") {
      const direct = normalizeObjectCandle(value, fallbackAsset)

      if (direct) {
        send({
          type: "candle",
          candle: direct
        })
      }

      for (const key of Object.keys(value)) {
        const child = value[key]

        if (Array.isArray(child) || typeof child === "object") {
          scanValue(child, fallbackAsset)
        }
      }
    }
  }

  function parseSocketMessage(raw) {
    if (typeof raw !== "string") return

    if (raw.startsWith("0")) {
      send({
        type: "socket",
        status: "connected"
      })

      return
    }

    if (raw === "2") {
      return
    }

    if (raw.startsWith("40")) {
      send({
        type: "socket",
        status: "connected"
      })

      return
    }

    if (!raw.startsWith("42")) {
      return
    }

    let payload

    try {
      payload = JSON.parse(raw.slice(2))
    } catch {
      return
    }

    if (!Array.isArray(payload)) return

    const eventName = payload[0]
    const eventData = payload[1]

    if (
      eventName === "subfor" ||
      eventName === "changeSymbol" ||
      eventName === "setSymbol"
    ) {
      if (typeof eventData === "string") {
        activeAsset = eventData
      }

      if (eventData && typeof eventData === "object") {
        activeAsset =
          eventData.active ??
          eventData.symbol ??
          eventData.asset ??
          activeAsset

        activePeriod =
          eventData.period ??
          eventData.timeframe ??
          eventData.time ??
          activePeriod
      }

      send({
        type: "market",
        asset: activeAsset,
        period: activePeriod
      })
    }

    if (eventName === "NotAuthorized") {
      send({
        type: "socket",
        status: "not_authorized"
      })

      return
    }

    scanValue(eventData, activeAsset)
  }

  function NWWTWebSocket(...args) {
    const socket = new OriginalWebSocket(...args)

    send({
      type: "socket",
      status: "connecting"
    })

    const originalSend = socket.send.bind(socket)

    socket.send = function (data) {
      try {
        if (typeof data === "string") {
          parseSocketMessage(data)
        }
      } catch {}

      return originalSend(data)
    }

    socket.addEventListener("open", () => {
      send({
        type: "socket",
        status: "connected"
      })
    })

    socket.addEventListener("close", () => {
      send({
        type: "socket",
        status: "disconnected"
      })
    })

    socket.addEventListener("error", () => {
      send({
        type: "socket",
        status: "error"
      })
    })

    socket.addEventListener("message", (event) => {
      try {
        parseSocketMessage(event.data)
      } catch {}
    })

    return socket
  }

  NWWTWebSocket.prototype = OriginalWebSocket.prototype

  Object.defineProperties(NWWTWebSocket, {
    CONNECTING: {
      value: OriginalWebSocket.CONNECTING
    },
    OPEN: {
      value: OriginalWebSocket.OPEN
    },
    CLOSING: {
      value: OriginalWebSocket.CLOSING
    },
    CLOSED: {
      value: OriginalWebSocket.CLOSED
    }
  })

  window.WebSocket = NWWTWebSocket

  send({
    type: "hook",
    status: "ready"
  })
})()
