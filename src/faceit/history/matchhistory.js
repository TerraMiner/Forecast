const matchIds = [];
const matchDetailedDatas = new Map();
const matchNodesByMatchStats = [];

let historyPopup = undefined

class MatchNodeByMatchStats {
    constructor(node, matchId, index) {
        this.node = node;
        this.matchId = matchId;
        this.matchStats = null;
        this.rounds = 0;
        this.score = "";
        this.isWin = false;
        this.index = index
        this.setupMatchCounterArrow()
    }

    async loadMatchStats(playerId) {
        const detailedMatchInfo = await getDetailedMatchData(this.matchId);
        if (!detailedMatchInfo) return;
        this.detailedMatchInfo = detailedMatchInfo;
        const {player: stats, team} = findPlayerInTeamById(detailedMatchInfo.rounds[0].teams, playerId);
        this.matchStats = stats?.["player_stats"];

        this.rounds = parseInt(detailedMatchInfo.rounds[0].round_stats["Rounds"], 10);
        this.score = detailedMatchInfo.rounds[0].round_stats["Score"].replace(/\s+/g, '');
        this.isWin = team["team_stats"]["Team Win"] === "1";

        this.setupStatsToNode(playerId);
    }

    setupStatsToNode(playerId) {
        if (!this.matchStats) return;
        let nodeId = `${matchHistoryModule.sessionId}-extended-stats-node-${this.index}`
        if (document.getElementById(nodeId)) return;
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
        insertStatsIntoNode(this.node, this.score, rating, k, d, kd, kr, adr, this.isWin, nodeId);

        historyPopup.attachToElement(this.node, this.detailedMatchInfo, playerId)
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
            arrow.querySelector("[class=square]").innerText = matchNumber
        }
    }
}

const matchHistoryModule = new Module("matchhistory", async () => {
    if (!(await isExtensionEnabled()) || !(await isSettingEnabled("matchhistory"))) return;


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

    let sessionId = matchHistoryModule.sessionId;
    let tableRowId = `${sessionId}-table-row-id`;
    historyPopup = new MatchroomPopup();

    const playerId = (await getPlayerStatsByNickName(extractPlayerNick())).player_id;
    matchHistoryModule.playerId = playerId;
    await loadAllPlayerMatches(playerId);
    let ended = false;

    let lastIndex = -1

    await matchHistoryModule.doAfterAllNodeAppearPack(`tr[class*='styles__MatchHistoryTableRow']:not([id*='${tableRowId}'])`, async (nodes) => {
        if (ended) return;
        let batch = []
        for (let node of nodes) {
            const index = lastIndex === -1 ? (Array.from(node.parentNode.children).filter(child => child.tagName === 'TR').indexOf(node) - 1) : lastIndex;
            if (node.id === `${tableRowId}-${index}`) continue;
            node.id = `${tableRowId}-${index}`;
            if (index === 299) ended = true;
            if (index === -1) continue;
            if (index > 299) return;
            lastIndex = index + 1;
            batch.push(new MatchNodeByMatchStats(node, matchIds[index], index));
        }
        await Promise.all(batch.map(node => node.loadMatchStats(playerId)));
    });
}, async () => {
    matchNodesByMatchStats.length = 0;
    matchIds.length = 0;
});

function insertStatsIntoNode(root, score, rating, k, d, kd, kr, adr, isWin, id) {
    const tableTemplate = getHtmlResource("src/visual/tables/matchscore.html").cloneNode(true);
    tableTemplate.id = id
    const fourthNode = root?.children[3];
    if (!fourthNode) return
    matchHistoryModule.removalNode(tableTemplate);
    insertRow(tableTemplate, score, rating, k, d, kd, kr, adr, isWin);
    matchHistoryModule.appendToAndHide(tableTemplate, fourthNode.querySelector("span"), 'table-template')
}

function insertRow(node, score, rating, k, d, kd, kr, adr, isWin) {
    const table = node.querySelector('tbody');
    const newRow = table.insertRow();
    const green = "rgb(61,255,108)", red = "rgb(255, 0, 43)", white = "rgb(255, 255, 255)";

    const createColoredDiv = (text, condition, isSlash = false) => {
        const div = document.createElement("span");
        div.style.color = isSlash ? white : (condition ? green : red);
        if (condition) div.style.fontWeight = "bold";
        div.innerHTML = text;
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
    newRow.insertCell(0).appendChild(createCompositeCell([{text: scorePart1, condition: isWin}, {
        text: "/",
        isSlash: true
    }, {text: scorePart2, condition: isWin}]));
    newRow.insertCell(1).appendChild(createColoredDiv(rating, rating >= 1.0));
    newRow.insertCell(2).appendChild(createCompositeCell([{text: k, condition: kd >= 1.0}, {
        text: "/",
        isSlash: true
    }, {text: d, condition: kd >= 1.0}]));
    newRow.insertCell(3).appendChild(createCompositeCell([{text: kd, condition: kd >= 1.0}, {
        text: "/",
        isSlash: true
    }, {text: kr, condition: kr >= 0.65}]));
    newRow.insertCell(4).appendChild(createColoredDiv(adr, adr >= 75));
}

async function getDetailedMatchData(matchId) {
    if (matchDetailedDatas.has(matchId)) return matchDetailedDatas.get(matchId);
    let matchData = await getFromCacheOrFetch(matchId, fetchMatchStatsDetailed);
    matchDetailedDatas.set(matchId, matchData);
    return matchData;
}

async function loadAllPlayerMatches(playerId) {
    const results = await Promise.all([0, 100, 200].map(from => loadPlayerMatches(playerId, from)));
    const allMatchIds = results.flat();
    
    const matchDataPromises = allMatchIds.map(matchId => 
        getDetailedMatchData(matchId).catch(err => {
            console.error(`Failed to load match ${matchId}:`, err);
            return null;
        })
    );
    
    await Promise.all(matchDataPromises);
    
    allMatchIds.forEach(id => matchIds.push(id));
}

async function loadPlayerMatches(playerId, from) {
    const playerGameDatas = await getPlayerGameStats(playerId, extractGameType(), 100, from);
    return playerGameDatas.items.map(item => item.stats["Match Id"]);
}

function findPlayerInTeamById(teams, playerId) {
    for (const team of teams) {
        const player = team.players.find(player => player.player_id === playerId);
        if (player) return {team, player};
    }
    return {};
}