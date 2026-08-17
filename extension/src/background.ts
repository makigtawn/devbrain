import { saveEntry } from "./lib/api"

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-selection-to-devbrain",
    title: 'Save "%s" to devbrain',
    contexts: ["selection"]
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-selection-to-devbrain" || !info.selectionText) {
    return
  }

  try {
    await saveEntry({
      title: tab?.title ?? info.selectionText.slice(0, 60),
      content: info.selectionText,
      sourceUrl: info.pageUrl
    })
    chrome.action.setBadgeText({ text: "✓" })
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000)
  } catch {
    chrome.action.setBadgeText({ text: "!" })
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000)
  }
})
