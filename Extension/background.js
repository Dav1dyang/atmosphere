chrome.browserAction.onClicked.addListener((activeTab) => {
    var newURL = "https://davidyang.cc/";
    chrome.windows.create({
        url: newURL,
        type: "popup",
        focused: true,
        height: 600,
        width: 340
    }, function (win) { });
});