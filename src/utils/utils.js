const prefix = "[FORECAST]"

const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const browserType = typeof browser !== 'undefined' ? FIREFOX : CHROMIUM

function println(...args) {
    console.log('%c[%cFORE%cCAST%c]:', 'color: white; background-color: black;', 'color: orange; font-weight: bold; background-color: black;', 'color: white; font-weight: bold; background-color: black;', 'color: white; background-color: black;', args.join(" "));
}

function error(...args) {
    console.error(prefix + " " + args.join(" "));
}

function hideNode(node) {
    node.style.display = 'none';
    node.setAttribute("hided", "true");
}

function hideWithCSS(selector) {
    let style = document.getElementById("hideStyleElement");
    if (!style) {
        style = document.createElement('style');
        style.id = "hideStyleElement";
        document.documentElement.appendChild(style);
    }

    const sheet = style.sheet;
    const rules = Array.from(sheet.cssRules || []);
    const existingRule = rules.find(rule => rule.selectorText === selector);

    if (!existingRule) {
        sheet.insertRule(`${selector} { display: none; }`, sheet.cssRules.length);
    }
}

function appendTo(sourceNode,targetNode) {
    targetNode.insertAdjacentElement('afterend', sourceNode);
}

function appendToAndHide(sourceNode,hiddenNode) {
    appendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
}

function preppendTo(sourceNode,targetNode) {
    targetNode.insertAdjacentElement('afterbegin', sourceNode);
}

function preppendToAndHide(sourceNode,hiddenNode) {
    preppendTo(sourceNode,hiddenNode);
    hideNode(hiddenNode);
}

async function getSliderValue() {
    return new Promise((resolve, reject) => {
        const storageAPI = browserType === FIREFOX ? browser.storage.sync : chrome.storage.sync;

        storageAPI.get(['sliderValue'], (result) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                const sliderValue = result.sliderValue !== undefined ? result.sliderValue : 20;
                resolve(sliderValue);
            }
        });
    });
}

async function isSettingEnabled(name) {
    const storageAPI = browserType === FIREFOX ? browser.storage.sync : chrome.storage.sync;
    const settings = await new Promise((resolve, reject) => {
        storageAPI.get([name], (result) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(result);
            }
        });
    });

    return settings[name] !== undefined ? settings[name] : true;
}

async function isExtensionEnabled() {
    const storageAPI = browserType === FIREFOX ? browser.storage.sync : chrome.storage.sync;
    const settings = await new Promise((resolve, reject) => {
        storageAPI.get(['isEnabled'], (result) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(result);
            }
        });
    });

    return settings.isEnabled !== undefined ? settings.isEnabled : true;
}

function setGradientColor(winrateCell, percent) {
    percent = Math.min(Math.max(percent, 0), 100);
    const ratio = percent / 100;
    const colorStops = ["#ff0022", "#fbec1e", "#32d35a"];
    const gradientColor = ratio < 0.5
        ? interpolateColor(colorStops[0], colorStops[1], ratio * 2)
        : interpolateColor(colorStops[1], colorStops[2], (ratio - 0.5) * 2);
    winrateCell.style.color = gradientColor;
}

function interpolateColor(color1, color2, factor) {
    const [r1, g1, b1] = [color1.slice(1, 3), color1.slice(3, 5), color1.slice(5, 7)].map(c => parseInt(c, 16));
    const [r2, g2, b2] = [color2.slice(1, 3), color2.slice(3, 5), color2.slice(5, 7)].map(c => parseInt(c, 16));
    const [r, g, b] = [r1 + (r2 - r1) * factor, g1 + (g2 - g1) * factor, b1 + (b2 - b1) * factor].map(c => Math.round(c).toString(16).padStart(2, '0'));
    return `#${r}${g}${b}`;
}