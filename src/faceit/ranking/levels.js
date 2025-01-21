class PartySlot {
    nick = null

    constructor(slotNode, id) {
        this.slotNode = slotNode
        this.newIcon = null
        this.isEmpty = true
        this.isShort = null
        this.id = id
    }

    isShortStyle() {
        let isShort = this.slotNode?.firstElementChild?.querySelector(`[class*='ButtonBase__Wrapper']`)?.querySelector(`[class*='PlayerCardListItem__Row-']`)
        return !!isShort
    }

    getNickNode(isShort) {
        let node
        if (!isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[role="button"]')?.children[1]?.children[0]
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[class*="Nickname__Name"]')
        }
        if (node?.innerText) this.isEmpty = false
        return node
    }

    getLevelNode(isShort) {
        let node
        if (!isShort) {
            node = this.slotNode?.firstElementChild?.querySelector('[role="button"]')?.children[2]
        } else {
            node = this.slotNode?.firstElementChild?.querySelector('[class*="SkillIcon__StyledSvg"]')
        }
        return node
    }

    isNeedRemove() {
        let currentIsShort = this.isShortStyle()
        if (this.isShort === null) this.isShort = currentIsShort

        let isUpdated = false
        if (this.isShort !== currentIsShort) {
            isUpdated = true
            this.isShort = currentIsShort
        }
        let nickNode = this.getNickNode(currentIsShort)
        return nickNode && nickNode.isConnected && !isUpdated
    }

    removeOldIcon() {
        let levelNode = this.getLevelNode(this.isShort);
        if (!levelNode) return
        let icon = levelNode.querySelector('[class*="SkillIcon__StyledSvg"]')
        if (!icon) return;
        if (icon.style.display !== "none") {
            icon.style.display = "none"
        }
    }

    async updateIcon() {
        let newNick = this.getNickNode(this.isShort)?.innerText
        if (!newNick) return
        if (newNick !== this.nick || !this.newIcon) {
            let levelNode = this.getLevelNode(this.isShort);
            let oldIcon
            let elo
            if (!this.isShort) {
                let textNode = levelNode.querySelector('[class*="styles__EloText"]')
                let eloText = textNode.innerText
                if (!eloText) return;
                elo = parseInt(eloText.replace(/[\s,._]/g, ''), 10)
                oldIcon = levelNode.querySelector('[class*="SkillIcon__StyledSvg"]')
            } else {
                let playerStatistic = await fetchPlayerStatsByNickName(newNick);
                let {gameStats} = getStatistic(playerStatistic)
                if (!gameStats) return
                elo = parseInt(gameStats["faceit_elo"], 10);
                oldIcon = levelNode
            }
            if (!oldIcon) return;
            let currentLevel = getLevel(elo, "cs2");
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).firstChild
            newIcon.id = `party-slot-icon-${this.id}`
            if (this.newIcon) {
                this.newIcon.remove()
                this.newIcon = null
                this.isEmpty = true
            }
            if (document.getElementById(`party-slot-icon-${this.id}`)) return
            newLevelsModule.appendToAndHide(newIcon, oldIcon)
            newLevelsModule.removalNode(newIcon)
            this.newIcon = newIcon
            this.nick = newNick
        }
    }
}

const newLevelsModule = new Module("levels", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("eloranking");
    if (!enabled) return;

    hideWithCSS(`[data-repeek-level-progress]:not([id*="content-grid-element"]) a[href*="/stats"]:not([id="user-url"],[type="primary"])`);
    hideWithCSS(`[class*="SkillIcon__StyledSvg"]`);

    const styleElement = document.createElement("style");
    styleElement.textContent = `span[id*="lvlicon"]:has(+ [class*="SkillIcon__StyledSvg"]) {margin-inline-end: 0 !important;}`;
    document.head.appendChild(styleElement);

    await newLevelsModule.doAfterNodeAppear('[class*="Content__StyledContentElement"]', async (element) => {
        let uniqueCheck = () => element?.parentElement?.querySelector('[id*="statistic-progress-bar"]')
        if (!uniqueCheck()) {
            await newLevelsModule.doAfterAsync(() => element.querySelector('[class*="styles__HeadingWrapper"]'), async (result) => {
                if (uniqueCheck()) return
                let nick = result.innerText
                let target = result.parentElement.parentElement.querySelector('[class*="styles__BottomAreaWrapper"]')
                let newTable = getHtmlResource("src/visual/tables/elo-progress-bar.html").cloneNode(true)
                newTable.id = "statistic-progress-bar"
                preppendTo(newTable, target, 'progress-bar')
                newLevelsModule.removalNode(newTable)
                await insertStatsToEloBar(nick)
            })
        }
    })

    const defineUrlType = (url) => {
        switch (true) {
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats\/([^\/]+)$/.test(url):
                return "stats";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/collections.*/.test(url):
                return "collections";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)(\/.*)?$/.test(url):
                return "profile";
            case /^https:\/\/www\.faceit\.com\/\w+\/[\w\-]+\/room\/[\w\-]+(\/.*)?$/.test(url):
                return "matchroom";
            case /^https:\/\/www\.faceit\.com\/\w+\/matchmaking.*/.test(url):
                return "matchmaking";
            default:
                return null;
        }
    };

    let lobbyType = defineUrlType(window.location.href)
    let sessionId = newLevelsModule.sessionId
    let newEloLevelIconId = `${sessionId}-new-elo-level-icon`
    let levelIconId = `-${sessionId}-lvlicon-`
    let masterProgressBarId = `${sessionId}-master-progress-bar-container`
    let matchmakingHolderId = `${sessionId}-matchmaking-holder`
    let collectionLevelIconId = `${sessionId}-collection-level-icon`

    if (lobbyType === "matchroom") {
        let gameType = extractGameType();
        let selector = '[class*=Subtitle__Holder]';
        await newLevelsModule.doAfterAllNodeAppear(selector, async (eloNode) => {
            if (!isNumber(eloNode.innerText)) return;
            let eloNodeParent = eloNode.parentElement.parentElement;
            if (eloNodeParent.parentElement.querySelector(`[id*="${levelIconId}"]`)) return;
            let elo = parseInt(eloNode.innerText, 10);
            let currentLevel = getLevel(elo, gameType);
            let newIcon = levelIcons.get(currentLevel).cloneNode(true).firstChild;
            newIcon.id = `${levelIconId}${currentLevel}`;
            appendTo(newIcon, eloNodeParent);
        });
    } else if (lobbyType === "profile") {
        let selector = '[class*="styles__TitleContainer-"]';
        await newLevelsModule.doAfterNodeAppear(selector, async (node) => {
            let uniqueCheck = () => document.getElementById(newEloLevelIconId) || node.querySelector(`[id*='${newEloLevelIconId}']`)
            if (uniqueCheck()) return;
            await newLevelsModule.doAfterAsync(() => node.children.length >= 2 && node.querySelector('svg'), async () => {
                if (uniqueCheck()) return
                let badgeHolder = node.querySelector('[class*="BadgeHolder__Holder"]')
                let svgNode = node.querySelector('svg')
                let isTopIcon = !!badgeHolder
                let nick = extractPlayerNick()
                let playerStatistic = await fetchPlayerStatsByNickName(nick);
                let {gameStats, gameType} = getStatistic(playerStatistic)
                if (!gameStats) return
                if (document.getElementById(newEloLevelIconId)) return
                if (!gameStats) return
                let elo = parseInt(gameStats["faceit_elo"], 10);
                let currentLevel = getLevel(elo, gameType);
                let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
                icon.id = newEloLevelIconId
                if (isTopIcon) {
                    let parentElement = badgeHolder.parentElement;
                    parentElement.appendChild(icon)
                    parentElement.style.flexDirection = "row"
                } else {
                    if (document.getElementById(newEloLevelIconId)) return
                    newLevelsModule.appendToAndHide(icon, svgNode)
                    newLevelsModule.removalNode(icon);
                }
            })
        })
    } else if (lobbyType === "stats") {
        let nick = extractPlayerNick()
        let playerStatistic = await fetchPlayerStatsByNickName(nick);
        let {gameStats, deprecatedGameType} = getStatistic(playerStatistic)
        let gameType = extractGameType() || deprecatedGameType;
        if (!gameStats) return
        let levelRanges = gameLevelRanges[gameType];
        let elo = parseInt(gameStats["faceit_elo"], 10);
        let progress = getBarProgress(elo, gameType)
        let currentLevel = getLevel(elo, gameType);
        let iconSelector = '[class*="SkillIcon__StyledSvg"],[class*="BadgeHolder__Holder"]';
        await newLevelsModule.doAfterNodeAppear(iconSelector, (node) => {
            if (document.getElementById(newEloLevelIconId) || node.parentElement.parentElement.querySelector(`[id*='${newEloLevelIconId}']`)) return;

            let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
            icon.id = newEloLevelIconId
            newLevelsModule.removalNode(icon);
            if (lobbyType === "stats") {
                icon.style.width = '48px';
                icon.style.height = '48px';
            }
            let isTopIcon = node.getElementsByTagName("i").length > 0
            if (isTopIcon) {
                if (lobbyType === "stats") {
                    icon.style.width = '38px';
                    icon.style.height = '38px';
                }
                node.parentElement.prepend(icon)
                node.parentElement.style.flexDirection = "column";
            } else {
                newLevelsModule.appendToAndHide(icon, node)
            }
        })
        let progressBarSelector = '[class*="ProgressBar__ProgressHolder"]'
        await newLevelsModule.doAfterNodeAppear(progressBarSelector, async (node) => {
            if (document.getElementById(masterProgressBarId) || node.parentElement.parentElement.parentElement.parentElement.querySelector(`[id*='${masterProgressBarId}']`)) return;

            let section = node.parentElement.parentElement.parentElement

            let newTable = getHtmlResource("src/visual/tables/elo-progress-bar-master.html").cloneNode(true)
            newLevelsModule.appendToAndHide(newTable, section)
            newLevelsModule.removalNode(newTable)
            newTable.id = masterProgressBarId

            let {min: currmin} = levelRanges[currentLevel - 1]
            let {min: nextmin} = currentLevel === levelRanges.length ? {min: '∞'} : levelRanges[currentLevel]

            document.getElementById("master-progress-bar").style.width = `${progress}%`;
            let prevLevelIcon = levelIcons.get(currentLevel - 1)?.cloneNode(true)?.firstChild
            let nextLevelIcon = levelIcons.get(currentLevel + 1)?.cloneNode(true)?.firstChild
            if (prevLevelIcon) newLevelsModule.appendToAndHide(prevLevelIcon, document.getElementById("master-min-icon"))
            if (nextLevelIcon) newLevelsModule.appendToAndHide(nextLevelIcon, document.getElementById("master-max-icon"))

            document.getElementById("master-min-value").textContent = currmin
            document.getElementById("master-max-value").textContent = nextmin
        })
    } else if (lobbyType === "matchmaking") {
        let partySlots = new Map();
        let selector = '[class*=Matchmaking__PlayHolder]';
        await newLevelsModule.doAfterNodeAppear(selector, async (node) => {
            let uniqueCheck = () => node.id === matchmakingHolderId
            if (uniqueCheck()) return
            await newLevelsModule.doAfterAsync(() => {
                let firstChild = node.firstElementChild
                return firstChild && firstChild?.children?.length === 2 && firstChild?.children[1]?.children?.length === 5
            }, async () => {
                if (uniqueCheck()) return
                let table = Array.from(node.firstElementChild.children)[1]
                newLevelsModule.every(100, async () => {
                    if (partySlots.size < 5) {
                        let i = 0
                        Array.from(table.children).forEach((slot) => {
                            if (slot.id !== `party-slot-${i}`) {
                                slot.id = `party-slot-${i}`
                                partySlots.set(`party-slot-${i}`, new PartySlot(slot, i))
                            }
                            i++
                        })
                    }

                    for (let j = 0; j < partySlots.size; j++) {
                        let id = `party-slot-${j}`
                        let slot = partySlots.get(id)
                        slot.removeOldIcon()
                        if (!slot.isNeedRemove() && !slot.isEmpty) {
                            partySlots.delete(id)
                            slot.slotNode.id = ""
                            if (slot.newIcon) slot.newIcon.remove()
                            continue
                        }
                        await slot.updateIcon()
                    }
                })
                node.id = matchmakingHolderId
            })
        })
    } else if (lobbyType === "collections") {
        let selector = '[class*="styles__EloText"]';
        await newLevelsModule.doAfterNodeAppear(selector, async (node) => {
            let uniqueCheck = () => node.id === collectionLevelIconId
            if (uniqueCheck()) return
            let eloText = node.innerText
            let elo = parseInt(eloText.replace(/[\s,._]/g, ''), 10)
            await newLevelsModule.doAfterAsync(() => node.parentElement.querySelector('svg'), (oldIcon) => {
                if (uniqueCheck()) return
                let currentLevel = getLevel(elo, "cs2");
                let newIcon = levelIcons.get(currentLevel).cloneNode(true)
                let innerNewIcon = newIcon.firstElementChild;
                newLevelsModule.appendToAndHide(innerNewIcon, oldIcon)
                newLevelsModule.removalNode(innerNewIcon)
                node.id = collectionLevelIconId
            })
        })
    }

    doAfterSearchPlayerNodeAppear(async (node) => {
        await newLevelsModule.doAfterAsync(() => !node || node.childNodes && node.childNodes.length > 2, async () => {
            if (!node) return
            let currentNode = node.childNodes[1];
            for (let i = 0; i < 7; i++) {
                currentNode = currentNode.firstElementChild;
                if (currentNode.tagName === "SPAN" && i === 0) break
            }
            let nick = currentNode?.innerText;
            await newLevelsModule.doAfterAsync(() => Array.from(node?.childNodes[2]?.firstElementChild?.childNodes).find(node => node.tagName === "svg"), async (oldIcon) => {
                let playerStatistic = await fetchPlayerStatsByNickName(nick);
                let {gameStats, gameType} = getStatistic(playerStatistic)
                if (!gameStats) return
                let elo = parseInt(gameStats["faceit_elo"], 10);
                let currentLevel = getLevel(elo, gameType);
                let icon = levelIcons.get(currentLevel).cloneNode(true).firstChild
                newLevelsModule.appendToAndHide(icon, oldIcon)
                newLevelsModule.removalNode(icon)
            })
        })
    })
})

function getStatistic(playerStatistic) {
    let gameType = "cs2"
    let gameStats = playerStatistic["games"][gameType]
    if (!gameStats) {
        gameType = "csgo"
        gameStats = playerStatistic["games"][gameType]
    }
    return {gameStats, gameType}
}

function findPlayerInTeamByNickname(teams, nickname) {
    for (let team of [teams["faction1"], teams["faction2"]]) {
        let player = team["roster"].find(player => player.nickname === nickname);
        if (player) {
            return player;
        }
    }
    return null;
}

async function insertStatsToEloBar(nick) {
    let gameType = "cs2"
    let playerStatistic = await fetchPlayerStatsByNickName(nick);
    let gameStats = playerStatistic["games"][gameType];
    let userUrlElement = document.getElementById("user-url");
    if (!userUrlElement) return
    userUrlElement.setAttribute("href", `/${extractLanguage()}/players/${nick}/stats/${gameType}`)

    let elo = parseInt(gameStats["faceit_elo"], 10);
    let currentLevel = getLevel(elo, gameType)
    let progressBarPercentage = getBarProgress(elo, gameType);
    let node = document.getElementById("skill-current-level")
    node.innerHTML = levelIcons.get(currentLevel).innerHTML

    let levelRanges = gameLevelRanges[gameType];
    let {min, max} = levelRanges[currentLevel - 1]

    document.getElementById("progress-current-elo").getElementsByTagName("elo")[0].innerText = `${elo}`
    document.getElementById("min-elo-level").innerText = `${min}`
    document.getElementById("max-elo-level").innerText = `${max === Infinity ? '' : max}`

    let isLastLevel = currentLevel === levelRanges.length
    document.getElementById("elo-to-de-or-up-grade").innerText = `${min - elo - 1}/+${isLastLevel ? "∞" : max - elo + 1}`

    const progressBar = document.getElementById(`elo-progress-bar`);
    if (isLastLevel) {
        progressBar.style.width = "100%";
    } else {
        progressBar.style.width = `${progressBarPercentage}%`;
    }
}

function doAfterSearchPlayerNodeAppear(callback) {
    const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players\/([a-zA-Z0-9-_]+)$`);
    newLevelsModule.doAfterNodeAppear(`[class*="styles__HolderButton"][href*="/${extractLanguage()}/players/"]:not([${newLevelsModule.dataProcessedAttribute}])`, (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            let doubleParent = node?.parentElement?.parentElement
            if (!doubleParent) return;

            const href = node.getAttribute('href');
            if (href && targetHrefPattern.test(href)) {
                newLevelsModule.processedNode(node);
                callback(node);
            }
        }
    })
}

