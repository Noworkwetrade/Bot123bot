(function () {
  if (window.__NWWT_CONTENT_LOADED__) return
  window.__NWWT_CONTENT_LOADED__ = true

  const script = document.createElement("script")

  script.src = chrome.runtime.getURL("page-hook.js")
  script.async = false

  const target = document.head || document.documentElement

  target.appendChild(script)

  script.onload = () => {
    script.remove()
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return

    const message = event.data

    if (!message || message.source !== "NWWT_PAGE_HOOK") {
      return
    }

    chrome.runtime.sendMessage({
      type: "NWWT_PAGE_DATA",
      data: message.data
    }).catch(() => {})
  })
})()
