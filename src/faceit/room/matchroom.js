let teamCache = new Map()

const matchRoomModule = new Module("matchroom", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("matchroom");
    if (!enabled) return;
    matchRoomModule.temporaryFaceitBugFix();
    const matchId = extractMatchId();

    try {
        if (!matchId) return;
        await getMatchWinRates(matchId);
    } catch (err) {
        error("Error when retrieving match statistics: " + err.message);
    }
}, async () => {
    teamCache.clear()
})


function setupPlayerCardMatchData(playerId, targetNode) {
    let htmlResource = getHtmlResource('src/visual/tables/player.html').cloneNode(true);
    targetNode.insertAdjacentElement('beforeend', htmlResource);
    let table = document.getElementById("player-table")
    table.id = `${matchRoomModule.sessionId}-player-table-${playerId}`
    table.closest(`[class*="UserCardPopup__UserCardContainer"]`).style.minHeight = "530px"
}

function calculateTeamMatches(teamMap) {
    const teamMatches = {};

    teamMap.forEach(({maps}) => {
        maps.forEach((data, mapName) => {
            if (!teamMatches[mapName]) teamMatches[mapName] = {wins: 0, totalGames: 0};
            teamMatches[mapName].wins += data.wins;
            teamMatches[mapName].totalGames += data.totalGames;
        });
    });

    return teamMatches;
}

function displayTeamMatches(teamNameRaw, teamMatches) {
    const roster = teamNameRaw.split("$").pop()
    const teamName = teamNameRaw.split("$")[0]
    addTableTeamTitle(roster, teamName);
    Object.entries(teamMatches)
        .sort(([, dataA], [, dataB]) => dataB.wins / dataB.totalGames - dataA.wins / dataA.totalGames)
        .forEach(([mapName, data]) => {
            const winrate = (data.wins / data.totalGames * 100).toFixed(0);
            addRow(roster, mapName, data.totalGames, winrate)
        });
}

function displayPlayerStats(playerId, playerStats) {
    if (!playerStats) {
        error(`Player stats ${playerId} not found!`);
        return;
    }

    const {maps} = playerStats;

    Array.from(maps.entries())
        .sort(([, {wins: winsA, totalGames: totalA}], [, {wins: winsB, totalGames: totalB}]) =>
            (winsB / totalB) - (winsA / totalA))
        .forEach(([mapName, {totalGames, wins}]) => {
            const winrate = ((wins / totalGames) * 100).toFixed(0);
            addRow(`${matchRoomModule.sessionId}-player-table-${playerId}`, mapName, totalGames, winrate);
        });
}


async function getMatchWinRates(matchId) {
    if (!matchId) {
        error("Match ID is not provided!");
        return
    }

    const matchStats = await fetchMatchStats(matchId);

    if (!matchStats) {
        error("Error when retrieving match statistics: Incorrect match structure.");
        return
    }

    await displayWinRates(matchStats);
}

async function findUserCard(playerId, callback) {
    const player = await fetchPlayerStatsById(playerId);
    const currentCountry = extractLanguage();
    const match = player.faceit_url.match(/\/players\/[^/]+/);
    const playerLink = "/" + currentCountry + match[0];

    matchRoomModule.doAfterNodeAppear(`[class*="UserCard__Container"]:has(a[href="${playerLink}"])`, (node) => {
        if (!matchRoomModule.isProcessedNode(node)) {
            matchRoomModule.processedNode(node);
            callback(node);
        }
    })
}


async function calculateStats(team, playerId, matchAmount) {
    let gameType = extractGameType()
    let data = await fetchPlayerInGameStats(playerId, gameType, matchAmount);

    if (!data.items || data.items.length === 0) {
        return;
    }

    if (!teamCache.has(team)) teamCache.set(team, new Map());

    const teamMap = teamCache.get(team);

    data.items.forEach(item => {
        const stats = item.stats;
        if (stats["Game Mode"] !== "5v5") return;

        const mapName = stats["Map"];
        const result = parseInt(stats["Result"]);

        if (!teamMap.has(playerId)) {
            teamMap.set(playerId, {nickname: stats["Nickname"], maps: new Map()});
        }

        const playerData = teamMap.get(playerId).maps;

        if (!playerData.has(mapName)) {
            playerData.set(mapName, {wins: 0, totalGames: 0});
        }

        const mapData = playerData.get(mapName);
        mapData.wins += result;
        mapData.totalGames += 1;
    });

    await findUserCard(playerId, userCardElement => {
        setupPlayerCardMatchData(playerId, userCardElement);

        const playerStats = teamMap.get(playerId);
        if (playerStats) displayPlayerStats(playerId, playerStats);
    });
}


async function displayWinRates(matchDetails) {
    const team1 = matchDetails["teams"]["faction1"];
    const team2 = matchDetails["teams"]["faction2"];

    const matchAmount = await getMatchAmount();

    const team1Promises = team1["roster"].map(player =>
        calculateStats(`${team1.name}$roster1`, player["player_id"], matchAmount)
    );
    const team2Promises = team2["roster"].map(player =>
        calculateStats(`${team2.name}$roster2`, player["player_id"], matchAmount)
    );

    await Promise.all([...team1Promises, ...team2Promises]);
    let teamTableNodeId = `${matchRoomModule.sessionId}-team-table`
    await matchRoomModule.doAfterNodeAppear('[name="info"][class*="Overview__Column"]', async (node) => {
        let existingTeamTableNode = node.querySelector(`[id*="team-table"]`);
        if (existingTeamTableNode) {
            if (existingTeamTableNode.id === teamTableNodeId) return
            else existingTeamTableNode.remove()
        }
        const targetNode = node.matches('[name="info"]') ? node : node.querySelector('[name="info"][class*="Overview__Column"]');
        if (!targetNode) return false;
        if (matchRoomModule.isProcessedNode(targetNode)) return false;
        matchRoomModule.processedNode(targetNode);

        let innerNode = targetNode.querySelector('[class*="Overview__Stack"]')
        let htmlResource = getHtmlResource('src/visual/tables/team.html').cloneNode(true)
        node.style.overflowBlock = 'unset';
        htmlResource.id = teamTableNodeId
        innerNode.insertAdjacentElement('afterend', htmlResource);

        teamCache.forEach((teamMap, teamName) => {
            const teamMatches = calculateTeamMatches(teamMap);
            displayTeamMatches(teamName, teamMatches);
        });
    })
}

function addTableTeamTitle(roster, title) {
    const titleElement = document.getElementById(roster + "-name")
    titleElement.textContent = title
}

function addRow(nameTable, map, games, winPercent) {
    const table = document.getElementById(nameTable).getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();

    const mapCell = newRow.insertCell(0);
    const gamesCell = newRow.insertCell(1);
    const winrateCell = newRow.insertCell(2);

    mapCell.innerHTML = map.replace("de_","").replace(/(\d)/g, " $1").toLocaleUpperCase();
    gamesCell.innerHTML = games;
    winrateCell.innerHTML = winPercent + "%";

    setGradientColor(winrateCell, winPercent);
}

