chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({user: '', key: '', auth_error: false}, function() {
    });
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {hostContains: 'challonge.com'},
        })
        ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
      }]);
    });
 });

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.cmd == "options") {
       chrome.runtime.openOptionsPage()
    }
});