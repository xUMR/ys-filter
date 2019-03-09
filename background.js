/*jshint esversion: 6 */

const ICON_ENABLED = "icons/128.png";
const ICON_DISABLED = "icons/128g.png";
const URL_FILTER = { url: [{ urlPrefix: "https://www.yemeksepeti.com/*-*" }] };

const MSG_MAP = { "enableIcon": () => { chrome.browserAction.setIcon({ path: ICON_ENABLED }); },
                  "disableIcon": () => { chrome.browserAction.setIcon({ path: ICON_DISABLED }); } };

chrome.runtime.onMessage.addListener((msg, sender, response) => {
    MSG_MAP[msg]();
});

