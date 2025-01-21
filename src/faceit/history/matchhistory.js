const MATCHES_PER_LOAD = 30;
const matchIds = [];
const matchDetailedDatas = new Map();
const loadingMatches = new Set();
const loadedIdAnchors = new Set();
const matchNodesByMatchStats = [];

class MatchNodeByMatchStats {
    constructor(node, index) {
        this.node = node;
        this.matchStats = null;
        this.rounds = 0;
        this.score = "";
        this.isWin = false;
        this.index = index
        this.nodeId = `extended-stats-node-${index}`
        this.setupMatchCounterArrow()
    }

    loadMatchStats(playerId) {
        this.matchId = matchIds[this.index]
        let detailedMatchInfo = matchDetailedDatas.get(this.matchId);
        if (!detailedMatchInfo) {
            error(`No detailed match info found for matchId: ${this.matchId}`);
            return;
        }

        const {player: stats, team} = findPlayerInTeamById(detailedMatchInfo.rounds[0].teams, playerId);
        if (!stats) {
            error(`No stats found for playerId: ${playerId} in matchId: ${this.matchId}`);
            return;
        }

        this.matchStats = stats["player_stats"];
        this.rounds = parseInt(detailedMatchInfo.rounds[0].round_stats["Rounds"], 10);
        this.score = detailedMatchInfo.rounds[0].round_stats["Score"].replace(/\s+/g, '');
        this.isWin = team["team_stats"]["Team Win"] === "1";
        this.setupStatsToNode(playerId, detailedMatchInfo);
    }

    setupStatsToNode(playerId, detailedMatchInfo) {
        if (!this.matchStats) return;
        const {
            "Kills": k,
            "Assists": a,
            "Deaths": d,
            "ADR": adr,
            "K/D Ratio": kd,
            "K/R Ratio": kr,
            "Entry Count": entryCount,
            "First Kills": firstKills
        } = this.matchStats;
        const entryImpact = Math.min(parseInt(entryCount, 10), parseInt(firstKills, 10));
        const rounds = this.rounds;
        const kast = ((parseInt(k, 10) + parseInt(a, 10) + entryImpact) / rounds) * 100;
        const impact = (parseInt(k, 10) + 0.5 * parseInt(a, 10) - entryImpact * 1.5) / rounds;

        const rating = (0.0073 * kast + 0.3591 * parseFloat(kr) - 0.5329 * (parseInt(d, 10) / rounds) + 0.2372 * impact + 0.0032 * parseInt(adr, 10) + 0.1587).toFixed(2);
        insertStatsIntoNode(this, rating, k, d, kd, kr, adr, playerId, detailedMatchInfo);
    }

    setupMatchCounterArrow() {
        let matchNumber = (this.index + 1)
        if (matchNumber % 20 !== 0) return
        let arrowId = `arrow-${matchNumber / 20}`
        const arrow = getHtmlResource("src/visual/tables/match-counter-arrow.html").cloneNode(true);
        arrow.id = arrowId
        let idCounter = 0
        for (let child of this.node.children) {
            let borderId = `border-${matchNumber / 20}-${idCounter++}`
            if (document.getElementById(borderId)) continue

            child.style.position = "relative";
            child.style.paddingBottom = "1px";

            const borderElement = document.createElement("div");
            borderElement.id = borderId
            borderElement.style.position = "absolute";
            borderElement.style.bottom = "-1px";
            borderElement.style.left = "0";
            borderElement.style.width = "100%";
            borderElement.style.height = "1px";
            borderElement.style.backgroundColor = "rgb(255, 85, 0)";
            child.appendChild(borderElement);
        }
        if (!document.getElementById(arrowId)) {
            appendTo(arrow, this.node, 'arrow')
            arrow.querySelector("[class=match-counter-arrow-square]").innerText = matchNumber
        }
    }
}

const matchHistoryModule = new Module("matchhistory", async () => {
    if (!(await isExtensionEnabled()) || !(await isSettingEnabled("matchhistory"))) return;

    await loadMatchHistoryCache();
    await new Promise(resolve => {
        const maxAttempts = 50;
        let attempts = 0;

        const checkOtherExtension = () => {
            const hasEloChanges = document.querySelector('table[matches-elo]') ||
                Array.from(document.querySelectorAll('span')).some(span =>
                    span.textContent.includes('(+') || span.textContent.includes('(-')
                );

            if (hasEloChanges || attempts >= maxAttempts) {
                resolve();
            } else {
                attempts++;
                setTimeout(checkOtherExtension, 50);
            }
        };

        checkOtherExtension();
    });

    let tableRowAttribute = `forecast-matchhistory-row-${matchHistoryModule.sessionId}`;

    const playerId = (await fetchPlayerStatsByNickName(extractPlayerNick())).player_id;

    let lastIndex = -1
    let tableElement;
    let tableHeadElement;
    let selector = `tr[class*='styles__MatchHistoryTableRow']:not([${tableRowAttribute}]):not(:has([id*='extended-stats-node']))`;

    await matchHistoryModule.doAfterAllNodeAppearPack(selector, async (nodes) => {
        if (!tableElement) tableElement = nodes[0].parentNode.children;
        if (!tableHeadElement) tableHeadElement = tableElement[0];

        let tableNodesArray = Array.from(tableElement).filter(child => child.tagName === 'TR');

        let nodeArrays = chunkArray(Array.from(nodes).filter((node) => {
            let flag = tableHeadElement !== node && !node.hasAttribute(tableRowAttribute);
            if (flag) node.setAttribute(tableRowAttribute, '');
            return flag
        }), MATCHES_PER_LOAD);

        if (nodeArrays.length === 0) return

        for (const nodeArray of nodeArrays) {
            let batch = [];
            let batchIndex = lastIndex === -1 ? 0 : lastIndex
            for (let node of nodeArray) {
                const index = lastIndex === -1 ? (tableNodesArray.indexOf(node) - 1) : lastIndex;
                if (index === -1) continue;
                lastIndex = index + 1;
                batch.push(new MatchNodeByMatchStats(node, index));
            }

            await loadPlayerMatchHistory(playerId, batchIndex - 1, () => {
                loadDetailedMatches(batchIndex)?.then(() => {
                    Promise.all(batch.map(node => node.loadMatchStats(playerId)))
                })
            });
        }
    });
}, async () => {
    matchNodesByMatchStats.length = 0;
    matchIds.length = 0;
    matchDetailedDatas.clear()
    loadingMatches.clear()
    loadedIdAnchors.clear()
});

function insertStatsIntoNode(matchNode, rating, k, d, kd, kr, adr, playerId, detailedMatchInfo) {
    const fourthNode = matchNode.node?.children[3];
    if (!fourthNode) return;

    let tableTemplate = document.getElementById(matchNode.nodeId);
    let tableNotExist = !tableTemplate;

    if (tableNotExist) {
        tableTemplate = getHtmlResource("src/visual/tables/matchscore.html").cloneNode(true)
        tableTemplate.id = matchNode.nodeId
    }

    insertRow(tableTemplate, matchNode.score, rating, k, d, kd, kr, adr, matchNode.isWin);

    if (!matchNode.popup) {
        matchNode.popup = new MatchroomPopup(tableTemplate)
        matchNode.popup.attachToElement(detailedMatchInfo, playerId)
    }

    if (tableNotExist) {
        matchHistoryModule.appendToAndHide(tableTemplate, fourthNode.querySelector("span"), 'table-template')
        matchHistoryModule.removalNode(tableTemplate)
    }
}

function insertRow(node, score, rating, k, d, kd, kr, adr, isWin) {
    const table = node.querySelector('tbody');
    const tableRow = table.rows.length > 0 ? table.rows[0] : table.insertRow();
    const green = "rgb(61,255,108)", red = "rgb(255, 0, 43)", white = "rgb(255, 255, 255)";

    const createColoredDiv = (text, condition, isSlash = false) => {
        const div = document.createElement("span");
        div.style.color = isSlash || !text ? white : (condition ? green : red);
        if (condition) div.style.fontWeight = "bold";
        div.textContent = text || "-";
        return div;
    };

    const createCompositeCell = (texts) => {
        const container = document.createElement("div");
        texts.forEach(({
                           text,
                           condition,
                           isSlash
                       }) => container.appendChild(createColoredDiv(text, condition, isSlash)));
        return container;
    };

    let [scorePart1, scorePart2] = score.split("/");

    replaceOrInsertCell(tableRow, 0, () => createCompositeCell([
        {text: scorePart1, condition: isWin},
        {text: "/", isSlash: true},
        {text: scorePart2, condition: isWin}
    ]));

    replaceOrInsertCell(tableRow, 1, () => createColoredDiv(isNaN(rating) ? null : rating, rating >= 1.0));

    replaceOrInsertCell(tableRow, 2, () => createCompositeCell([
        {text: k, condition: kd >= 1.0},
        {text: "/", isSlash: true},
        {text: d, condition: kd >= 1.0}
    ]));

    replaceOrInsertCell(tableRow, 3, () => createCompositeCell([
        {text: kd, condition: kd >= 1.0},
        {text: "/", isSlash: true},
        {text: kr, condition: kr >= 0.65}
    ]));

    replaceOrInsertCell(tableRow, 4, () => createColoredDiv(adr, adr >= 75));
}

async function loadAllPlayerMatches(playerId, fromId, date) {
    loadedIdAnchors.add(fromId);
    const results = await loadPlayerMatches(playerId, MATCHES_PER_LOAD, date);
    results.forEach(id => matchIds.push(id));
}

async function loadPlayerMatches(playerId, amount, date) {
    const playerGameDatas = await fetchPlayerInGameStats(playerId, extractGameType(), amount, date);
    return playerGameDatas.items.map(item => item.stats["Match Id"]);
}

function findPlayerInTeamById(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return {team, player};
    }
    return {};
}

async function loadPlayerMatchHistory(playerId, fromId, callback) {
    if (matchIds.length === 0 && loadedIdAnchors.size === 0) {
        await loadAllPlayerMatches(playerId, fromId, 0).then(callback)
        if (loadedIdAnchors.has(fromId)) return
    }

    matchHistoryModule.doAfter(() => matchIds[fromId], (matchId) => {
        fetchMatchStats(matchId).then(match => {
            let from = match["finished_at"];
            loadAllPlayerMatches(playerId, from, parseInt(from, 10) * 1000).then(callback)
        })
    }, 50)
}

function loadDetailedMatches(fromId) {
    const toId = Math.min(fromId + MATCHES_PER_LOAD, matchIds.length);
    if (fromId >= toId) return null
    let batch = [];

    for (let i = fromId; i < toId; i++) {
        const matchId = matchIds[i];
        if (loadingMatches.has(matchId) || matchDetailedDatas.get(matchId)) continue;
        batch.push(getFromCacheOrFetch(matchId, fetchMatchStatsDetailed)
            .then(result => matchDetailedDatas.set(matchId, result))
            .finally(() => loadingMatches.delete(matchId)));
        loadingMatches.add(matchId);
    }

    return Promise.all(batch);
}