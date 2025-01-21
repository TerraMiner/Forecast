let previousUrl = "";

const regexModules = [
    {regex: /^https:\/\/www\.faceit\.com\/.*$/, module: newLevelsModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: rankingModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/[\w\-]+\/room\/[0-9a-zA-Z\-]+(\/.*)?$/, module: matchRoomModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats(\/.*)?$/, module: matchHistoryModule}
]

resourcesModule.produceOf("load").then(() => {
    setInterval(async function () {
        let currentUrl = window.location.href;
        if (currentUrl !== previousUrl) {
            let prevUrl = previousUrl
            previousUrl = currentUrl;
            await handleModules(currentUrl, prevUrl)
        }
    }, 50);
})

function determineAction(regex, currentUrl, previousUrl) {
    const currentMatch = currentUrl.match(regex);
    const previousMatch = previousUrl.match(regex);

    if (currentMatch && previousMatch) return "reload";
    if (currentMatch) return "load";
    if (previousMatch) return "unload";
    return null;
}

async function handleModules(currentUrl, previousUrl) {
    let batch = []
    for (let regexModule of regexModules) {
        const action = determineAction(regexModule.regex, currentUrl, previousUrl);
        if (action) batch.push(regexModule.module.produceOf(action))
    }
    await Promise.all(batch)
}