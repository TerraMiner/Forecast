const forecastCacheKeyPrefix = "forecast-matchhistory"
const cookieCacheId = "last-matchhistorycache-cleanup";
const cleanUpPeriod = 86400000;
const maxUnusedHours = 48;

const DB_NAME = 'faceit_matches';
const STORE_NAME = 'matches';
const DB_VERSION = 1;

const cacheMap = new Map();
let db = null;

function tryCleanCache() {
    let nextCleanUpTime = parseInt(getCookie(cookieCacheId), 10);
    let currentTime = Date.now();
    if (!nextCleanUpTime || nextCleanUpTime > currentTime) {
        setCookie(cookieCacheId, currentTime + cleanUpPeriod, 1440);
        cleanCache();
    }
}

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {keyPath: 'matchId'});
                store.createIndex('cacheDate', 'cacheDate');
                store.createIndex('lastUsed', 'lastUsed');
            }
        };
    });
}

async function loadMatchHistoryCache() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const matches = request.result;
            matches.forEach(match => {
                cacheMap.set(`${forecastCacheKeyPrefix}::${match.matchId}`, match);
            });
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

async function getFromCacheOrFetch(key, fetch) {
    if (!db) await initDB();

    const cacheKey = `${forecastCacheKeyPrefix}::${key}`;

    if (cacheMap.has(cacheKey)) {
        const cachedData = cacheMap.get(cacheKey);
        cachedData.lastUsed = Date.now();

        updateLastUsed(key, cachedData.lastUsed);
        return Promise.resolve(cachedData.data);
    }

    try {
        const cached = await getFromDB(key);
        if (cached) {
            cached.lastUsed = Date.now();
            cacheMap.set(cacheKey, cached);
            updateLastUsed(key, cached.lastUsed);
            return cached.data;
        }
    } catch (err) {
        error('Error reading from IndexedDB:', err);
    }

    const value = await fetch(key);

    const cachedValue = {
        matchId: key,
        data: {
            rounds: [{
                teams: value.rounds[0].teams.map(team => ({
                    players: team.players.map(player => {
                        return ({
                            nickname: player.nickname,
                            player_id: player.player_id,
                            player_stats: {
                                "Kills": player.player_stats.Kills,
                                "Assists": player.player_stats.Assists,
                                "Deaths": player.player_stats.Deaths,
                                "ADR": player.player_stats.ADR,
                                "K/D Ratio": player.player_stats["K/D Ratio"],
                                "K/R Ratio": player.player_stats["K/R Ratio"],
                                "Entry Count": player.player_stats["Entry Count"],
                                "First Kills": player.player_stats["First Kills"],
                                "Headshots": player.player_stats["Headshots"],
                                "Headshots %": player.player_stats["Headshots %"],
                                "MVPs": player.player_stats["MVPs"]
                            }
                        })
                    }),
                    team_stats: {
                        "Team Win": team.team_stats["Team Win"]
                    }
                })),
                round_stats: {
                    "Rounds": value.rounds[0].round_stats.Rounds,
                    "Score": value.rounds[0].round_stats.Score
                }
            }]
        },
        cacheDate: Date.now(),
        lastUsed: Date.now()
    };

    saveToDb(cachedValue).catch(err =>
        error('Error saving to IndexedDB:', err)
    );

    cacheMap.set(cacheKey, cachedValue);
    return cachedValue.data;
}

async function saveToDb(value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getFromDB(key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function updateLastUsed(key, timestamp) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.lastUsed = timestamp;
                store.put(data);
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function cleanCache() {
    if (!db) await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastUsed');

    return new Promise((resolve, reject) => {
        const request = index.openCursor();
        const currentTime = Date.now();
        const unusedTimeout = maxUnusedHours * 60 * 60 * 1000;
        let deleteCount = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const value = cursor.value;

                if ((currentTime - value.lastUsed) > unusedTimeout) {
                    store.delete(cursor.primaryKey);
                    cacheMap.delete(`${forecastCacheKeyPrefix}::${value.matchId}`);
                    deleteCount++;
                }
                cursor.continue();
            } else {
                if (deleteCount > 0)
                println(`Deleted ${deleteCount} old entries from IndexedDB`);
                resolve();
            }
        };

        request.onerror = () => reject(request.error);
    });
}

initDB().catch(error);
tryCleanCache();