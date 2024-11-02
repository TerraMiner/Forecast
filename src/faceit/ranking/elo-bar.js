const newLevelsModule = new Module("levels", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("eloranking");
    if (!enabled) return;

    doAfterSelfNickNodeAppear(async (nick) => {
        doAfterStatisticBarNodeAppear(nick, async (node) => {
            let newTable = getHtmlResource("src/visual/tables/elo-progress-bar.html").cloneNode(true)
            node.replaceWith(newTable);
            await insertStatsToEloBar(nick)
        })
    })


    doAfterWidgetEloNodeAppear(async (node) => {
        node.parentNode.id = "edited-widget"
        node.remove()
    })

    const defineUrlType = (url) => {
        switch (true) {
            case /^https:\/\/www\.faceit\.com\/\w+\/matchmaking$/.test(url):
                return "lobby";
            case /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/[^\/]+$/.test(url):
                return "profile";
            case /^https:\/\/www\.faceit\.com\/\w+\/cs2\/room\/[\w\-]+(\/.*)?$/.test(url):
                return "matchroom";
        }
    };

    let lobbyType = defineUrlType(window.location.href)

    doAfterNickNameNodeAppear(lobbyType, async (nickNode) => {
        let nick = nickNode.innerText
        let playerStatistic = await getPlayerStatsByNickName(nick);
        let gameStats = playerStatistic["games"]["cs2"];
        let elo = parseInt(gameStats["faceit_elo"], 10);
        let [currentLevel, _] = getBarProgress(elo);
        let newIcon = levelIcons.get(currentLevel).cloneNode(true)
        if (lobbyType === "profile") {
            doAfterMainLevelAppear(async (node) => {
                let oldIcon = node.getElementsByTagName("svg")[0]
                let icon = newIcon.cloneNode(true)
                icon.id = "new-elo-level-icon"
                oldIcon.replaceWith(icon)
            })
        } else if (lobbyType === "lobby") handlePartyLobby(nickNode, nick, newIcon)
        else handleMatchRoomLobby(nickNode, nick, newIcon)
    })


}, async () => {

})

function handleMatchRoomLobby(nickNode, nick, newIcon) {
    let playerCardNodes = nickNode.parentNode.parentNode.parentNode.parentNode.parentNode.children
    doAfter(() => playerCardNodes.length === 3, () => {
        let section = playerCardNodes[playerCardNodes.length - 1].firstChild.childNodes
        doAfter(() => section.length === 3, () => {
            let oldIcon = section[playerCardNodes.length - 1];
            oldIcon.replaceWith(newIcon)
        })
    })
}

function handlePartyLobby(nickNode, nick, newIcon) {
    const mainNode = nickNode.parentNode;
    let parent = mainNode.parentNode;
    let isShortVariant = false
    if (Array.from(parent.classList).some(className => className.includes('PlayerCardListItem__Row-'))) {
        parent = parent.parentNode
        isShortVariant = true
    }

    isShortVariant ? handleShortVariant(parent, nick, newIcon) : handleFullVariant(parent, mainNode, newIcon)
}

function handleFullVariant(node, mainNode, newIcon) {
    const siblings = Array.from(node.children);
    const index = siblings.indexOf(mainNode);
    const eloIconContainer = siblings[index + 1];
    let levelNode = eloIconContainer.children
    doAfter(
        () => levelNode.length === 2,
        () => {
            levelNode[0].replaceWith(newIcon.firstChild)
        }
    )
}

function handleShortVariant(node, nick, newIcon) {
    doAfter(
        () => node.children.length === 4,
        async () => {
            const siblings = Array.from(node.children)
            const eloIcon = siblings[3];
            eloIcon.replaceWith(newIcon.firstChild)
        })
}

async function insertStatsToEloBar(nick) {
    let gameType = "cs2"
    let playerStatistic = await getPlayerStatsByNickName(nick);
    let gameStats = playerStatistic["games"][gameType];

    document.getElementById("user-url").setAttribute("href", `/${extractLanguage()}/players/${nick}/stats/${gameType}`)

    let elo = parseInt(gameStats["faceit_elo"], 10);
    let [currentLevel, progressBarPercentage] = getBarProgress(elo);
    let node = document.getElementById("skill-current-level")
    node.innerHTML = levelIcons.get(currentLevel).innerHTML

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

function doAfterStatisticBarNodeAppear(nick, callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("statistic-progress-bar");
        const targetHrefPattern = new RegExp(`^/${extractLanguage()}/players/${nick}/stats/`);

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                const href = node.getAttribute('href');
                const hasSvg = node.querySelector('svg');

                if (href && targetHrefPattern.test(href) && hasSvg) {
                    callback(node);
                    found = true;
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (found) break;
                    checkNodeAndChildren(node);
                }
            }
            if (found) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("stats-bar-node-observer", observer); // Регистрация наблюдателя
}

function doAfterSelfNickNodeAppear(callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = false

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="styles__NicknameText-"]')) {
                    callback(node.innerText)
                    found = true;
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (found) break;
                    checkNodeAndChildren(node);
                }
            }
            if (found) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("nick-selfnode-observer", observer);
}

function doAfterMainLevelAppear(callback) {
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("new-elo-level-icon");

        function checkNodeAndChildren(node) {
            if (found) return;
            if (node.nodeType === Node.ELEMENT_NODE && node.matches('[class*="styles__TitleContainer-"]')) {
                const svgObserver = new MutationObserver(innerMutations => {
                    for (const innerMutation of innerMutations) {
                        if (innerMutation.type === 'childList') {
                            if (node.querySelector('svg')) {
                                callback(node);
                                found = true;
                                svgObserver.disconnect();
                                break;
                            }
                        }
                    }
                });
                svgObserver.observe(node, {
                    childList: true,
                    subtree: true
                });

                return;
            }
            node.childNodes.forEach(checkNodeAndChildren);
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (found) break;
                    checkNodeAndChildren(node);
                }
            }
            if (found) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("main-level-observer", observer);
}

function doAfterWidgetEloNodeAppear(callback) {
    let nodeCounter = 0
    const observer = new MutationObserver(mutationsList => {
        let found = !!document.getElementById("edited-widget");

        function checkNodeAndChildren(node) {
            if (found) return;

            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="WidgetTitleWrapper__NewEloWidgetContainer-"]')) {
                    nodeCounter++
                    if (nodeCounter < 2) return;
                    nodeCounter = 0
                    callback(node)
                    found = true;
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (found) break;
                    checkNodeAndChildren(node);
                }
            }
            if (found) break;
        }
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("widget-elo-observer", observer);
}

function doAfterNickNameNodeAppear(lobbyType, callback) {
    const observer = new MutationObserver(mutationsList => {
        let counterMax = lobbyType === "matchroom" ? 10 : lobbyType === "lobby" ? 5 : 1
        let counter = 0
        if (lobbyType === "profile") {
            let node = document.getElementById("player-profile-nick-node")
            if (node) {
                callback(node)
                return
            }
        }

        function checkNodeAndChildren(node) {
            if (counter === counterMax) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('[class*="styles__Nickname-"]') || node.matches('[class*="Nickname__Name-"]')) {
                    counter++
                    if (lobbyType === "profile") node.id = "player-profile-nick-node"
                    callback(node)
                    return;
                }
                node.childNodes.forEach(checkNodeAndChildren);
            }
        }

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    checkNodeAndChildren(node);
                    if (counter === counterMax) break
                }
            }
            if (counter === counterMax) break
        }
        if (counter === counterMax) observer.disconnect()
    });

    observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });

    registeredObservers.set("nick-node-observer", observer);
}

moduleListener(newLevelsModule);