/*
 * Faceit Forecast - Browser Extension
 * Copyright (C) 2025 TerraMiner
 *
 * This file is part of Faceit Forecast.
 *
 * Faceit Forecast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Faceit Forecast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

let previousUrl = "";

const regexModules = [
    {regex: /^https:\/\/www\.faceit\.com\/.*$/, module: newLevelsModule},
    {regex: /^https:\/\/www\.faceit\.com\/.*$/, module: logoSidebarModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats\/(cs2|csgo)$/, module: rankingModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/[\w\-]+\/room\/[0-9a-zA-Z\-]+(\/.*)?$/, module: matchRoomModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/[\w\-]+\/room\/[0-9a-zA-Z\-]+(\/.*)?$/, module: posCatcherModule},
    {regex: /^https:\/\/www\.faceit\.com\/[^\/]+\/players\/([^\/]+)\/stats\/(cs2|csgo)$/, module: matchHistoryModule}
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
    let batch = [];
    for (let regexModule of regexModules) {
        const action = determineAction(regexModule.regex, currentUrl, previousUrl);
        if (action) batch.push(regexModule.module.produceOf(action))
    }
    await Promise.all(batch)
}