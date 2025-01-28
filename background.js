chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.includes("leboncoin.fr")) {
      console.log("Page leboncoin.fr détectée, changement d'icône en vert.");
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: "icons/icon-green.png",
          48: "icons/icon-green.png",
          128: "icons/icon-green.png",
        },
      });
    } else {
      console.log(
        "Page non-leboncoin.fr détectée, changement d'icône en gris."
      );
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: "icons/icon-gray.png",
          48: "icons/icon-gray.png",
          128: "icons/icon-gray.png",
        },
      });
    }
  }
});
