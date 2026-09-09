const popupConnections = new Set()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "nwwt-popup") return

  popupConnections.add(port)

  port.onDisconnect.addListener(() => {
    popupConnections.delete(port)
  })
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "NWWT_PAGE_DATA") {
    return
  }

  for (const port of popupConnections) {
    try {
      port.postMessage(message.data)
    } catch {
      popupConnections.delete(port)
    }
  }
})
