chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.tabs.update({ url: "http://davidyang.cc" });
});