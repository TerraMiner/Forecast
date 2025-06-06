const FIREFOX = "FIREFOX"
const CHROMIUM = "CHROMIUM"

const browserType = typeof browser !== 'undefined' ? FIREFOX : CHROMIUM

async function getStorage(keys) {
    return new Promise((resolve, reject) => {
        const storageAPI = browserType === "FIREFOX" ? browser.storage.sync : chrome.storage.sync;

        if (storageAPI) {
            storageAPI.get(keys, resolve);
        } else {
            reject("Storage API not available.");
        }
    });
}

async function setStorage(items) {
    return new Promise((resolve, reject) => {
        const storageAPI = browserType === "FIREFOX" ? browser.storage.sync : chrome.storage.sync;

        if (storageAPI) {
            storageAPI.set(items, resolve);
        } else {
            reject("Storage API not available.");
        }
    });
}

async function loadManifestInfo() {
    const runtime = browserType === "FIREFOX" ? browser.runtime : chrome.runtime;
    const manifest = runtime.getManifest()

    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = manifest.version;
    }

    const authorElement = document.getElementById('author');
    if (authorElement) {
        authorElement.textContent = manifest.author;
    }
}

async function popupLoad() {
    try {
        const settings = await getStorage(['isEnabled']);
        const enabled = settings.isEnabled !== undefined ? settings.isEnabled : true;
        const toggleExtension = document.getElementById('toggleExtension');

        if (toggleExtension) {
            toggleExtension.checked = enabled;
        } else {
            console.error("Toggle switch not found!");
        }

    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

async function loadSettings() {
    try {
        const settings = await getStorage(['isEnabled', 'sliderValue', 'matchroom', 'eloranking', 'matchhistory']);
        const rangeSlider = document.getElementById('rangeSlider');
        const sliderValueDisplay = document.getElementById('sliderValue');

        const toggleExtension = document.getElementById('toggleExtension');
        if (toggleExtension) {
            toggleExtension.checked = settings.isEnabled !== undefined ? settings.isEnabled : true;
        }

        const toggleMatchRoom = document.getElementById('matchroom');
        if (toggleMatchRoom) {
            toggleMatchRoom.checked = settings.matchroom !== undefined ? settings.matchroom : true;
        }

        const toggleEloRanking = document.getElementById('eloranking');
        if (toggleEloRanking) {
            toggleEloRanking.checked = settings.eloranking !== undefined ? settings.eloranking : true;
        }

        const toggleAdvancedMatchHistory = document.getElementById('matchhistory');
        if (toggleAdvancedMatchHistory) {
            toggleAdvancedMatchHistory.checked = settings.matchhistory !== undefined ? settings.matchhistory : true;
        }

        if (rangeSlider && sliderValueDisplay) {
            const sliderValue = settings.sliderValue !== undefined ? settings.sliderValue : 30;
            rangeSlider.value = sliderValue;
            sliderValueDisplay.textContent = sliderValue;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

async function saveSettings() {
    const isEnabled = document.getElementById('toggleExtension').checked;
    const sliderValue = parseInt(document.getElementById('rangeSlider').value, 10);
    const matchroom = document.getElementById('matchroom').checked;
    const eloranking = document.getElementById('eloranking').checked;
    const matchhistory = document.getElementById('matchhistory').checked;

    try {
        await setStorage({isEnabled, sliderValue, matchroom, eloranking, matchhistory});
    } catch (error) {
        console.error("Error saving settings:", error);
    }
}

function updateTabButtonLabels() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        const tabName = button.getAttribute('data-tab');
        const tabLabels = {
            "general": "General",
            "features": "Features",
            "about": "About",
            "donate": "Donate"
        };

        button.innerHTML = `<span>${tabLabels[tabName] || tabName}</span>`;
    });
}

function setupInfoButtons() {
    const infoButtons = document.querySelectorAll('.info-button');

    infoButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const settingGroup = this.closest('.setting-group');
            const description = settingGroup.querySelector('.setting-description');
            description.classList.toggle('active');
        });
    });
}

window.addEventListener('message', (event) => {
    if (event.origin !== "https://www.faceit.com") return;
    if (event.data.action === 'setBackgroundColor') {
        document.body.style.backgroundColor = event.data.color;
    }
}, false);

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadSettings();
        await popupLoad();
        await loadManifestInfo();
        updateTabButtonLabels();
        setupInfoButtons();

        const tabButtons = document.querySelectorAll('.tab-button');
        const categories = document.querySelectorAll('.settings-category');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                categories.forEach(category => category.classList.remove('active-category'));

                button.classList.add('active');
                document.getElementById(button.getAttribute('data-tab')).classList.add('active-category');
            });
        });

        const toggleExtension = document.getElementById('toggleExtension');
        if (toggleExtension) {
            toggleExtension.addEventListener('change', async function () {
                const isEnabled = this.checked;
                await setStorage({isEnabled});
            });
        }

        const matchroom = document.getElementById('matchroom');
        if (matchroom) {
            matchroom.addEventListener('change', async function () {
                const matchroom = this.checked;
                await setStorage({matchroom});
            });
        }

        const eloranking = document.getElementById('eloranking');
        if (eloranking) {
            eloranking.addEventListener('change', async function () {
                const eloranking = this.checked;
                await setStorage({eloranking});
            });
        }

        const matchhistory = document.getElementById('matchhistory');
        if (matchhistory) {
            matchhistory.addEventListener('change', async function () {
                const matchhistory = this.checked;
                await setStorage({matchhistory});
            });
        }

        const rangeSlider = document.getElementById('rangeSlider');
        const sliderValueDisplay = document.getElementById('sliderValue');

        if (rangeSlider && sliderValueDisplay) {
            rangeSlider.addEventListener('input', async function () {
                sliderValueDisplay.textContent = this.value;
                await saveSettings();
            });
        }

        let notificationTimeout = null;

        document.getElementById('copyButton').addEventListener('click', () => {
            navigator.clipboard.writeText("forecast.extension@gmail.com").then(() => {
                const notification = document.getElementById('notification');
                notification.classList.add('show');

                if (notificationTimeout) clearTimeout(notificationTimeout);

                notificationTimeout = setTimeout(() => {
                    notification.classList.remove('show');
                    notificationTimeout = null;
                }, 2000);
            });
        });

    } catch (error) {
        console.error("Error during DOMContentLoaded:", error);
    }
});