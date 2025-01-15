const cacheSize = 300;
const forecastCacheKeyPrefix = "forecast-matchhistory"
const cookieCacheId = "last-matchhistorycache-cleanup";
const cleanUpPeriod = 86400000;

const cacheMap = new Map();
let isCacheLoaded = false;

chrome.storage.local.clear();

async function loadEntireCache() {
    const storageAPI = browserType === FIREFOX ? browser.storage.local : chrome.storage.local;
    
    const allData = await new Promise((resolve, reject) => {
        storageAPI.get(null, (result) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(result);
            }
        });
    });

    // Заполняем мапу только ключами с нужным префиксом
    for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(forecastCacheKeyPrefix)) {
            cacheMap.set(key, value);
        }
    }
    
    isCacheLoaded = true;
}

async function getFromCacheOrFetch(key, fetch) {
    const cacheKey = `${forecastCacheKeyPrefix}::${key}`;

    if (!isCacheLoaded) {
        await loadEntireCache();
    }

    if (cacheMap.has(cacheKey)) {
        return Promise.resolve(cacheMap.get(cacheKey));
    }

    const storageAPI = browserType === FIREFOX ? browser.storage.local : chrome.storage.local;

    // Возвращаем сам fetch, а сохранение делаем отдельно
    const fetchPromise = fetch(key);
    
    fetchPromise.then(value => {
        value.cacheDate = Date.now();

        // Асинхронно сохраняем в storage
        storageAPI.set({ [cacheKey]: value }, () => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                console.error('Error saving to storage:', errorMessage);
            }
        });

        // Асинхронно сохраняем в Map
        cacheMap.set(cacheKey, value);
    });

    return await fetchPromise;
}


async function cleanCache() {
    const storageAPI = browserType === FIREFOX ? browser.storage.local : chrome.storage.local;
    const result = await new Promise((resolve, reject) => {
        storageAPI.get(null, (items) => {
            const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(items);
            }
        });
    });

    const cacheEntries = Object.entries(result).filter(([key, value]) => key.includes(forecastCacheKeyPrefix) && value.cacheDate !== undefined);

    if (cacheEntries.length > cacheSize) {
        const sortedEntries = cacheEntries.sort(([_1, valueA], [_2, valueB]) => {
            const timeA = parseInt(valueA.cacheDate, 10);
            const timeB = parseInt(valueB.cacheDate, 10);
            return timeA - timeB;
        });

        const cacheToRemove = sortedEntries.slice(0, cacheEntries.length - cacheSize).map(([key]) => key);

        await new Promise((resolve, reject) => {
            storageAPI.remove(cacheToRemove, () => {
                const errorMessage = browserType === FIREFOX ? browser.runtime.lastError : chrome.runtime.lastError;
                if (errorMessage) {
                    reject(new Error(errorMessage));
                } else {
                    resolve(result);
                }
            });
        });

        console.log(cacheToRemove)

        console.log(`Deleted ${cacheToRemove.length} old keys.`);
    }
}

function tryCleanCache() {
    let nextCleanUpTime = parseInt(getCookie(cookieCacheId), 10);
    let currentTime = Date.now();
    if (!nextCleanUpTime || nextCleanUpTime > currentTime) {
        setCookie(cookieCacheId, currentTime + cleanUpPeriod);
        cleanCache().then(() => console.log("Cache Clean Finished!"));
    }
}

tryCleanCache();
