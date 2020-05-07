var windowClosed = true;
var popupID;
var xhr = new XMLHttpRequest();

chrome.browserAction.onClicked.addListener((activeTab) => {
    var newURL = "https://davidyang.cc/";
    if (windowClosed) {
        chrome.windows.create({
            url: newURL,
            type: "popup",
            focused: true,
            height: 600,
            width: 340
        }, (win) => {
            popupID = win.id;
            // console.log(String(popupID));
        });
        windowClosed = false;
    } else if (windowClosed == false) {
        chrome.windows.remove(popupID);
        windowClosed = true;
    } else {
        console.error('if windowClosed logic not working');
    }
});

chrome.windows.onRemoved.addListener(function (windowId) {
    if (windowId == popupID) {
        // alert("atmosphere window closed")
        windowClosed = true;
    } else {
        // alert("window closed")
    }
})


chrome.tabs.onActivated.addListener((callback) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        let url = tabs[0].url;
        console.log(url);
        xhr.open('POST', 'https://davidyang.cc/senddata');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send('currentURL=' + url);
        // use `url` here inside the callback because it's asynchronous!
    });
})
