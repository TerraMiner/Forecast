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

const maps = {
    Dust2: "de_dust2",
    Mirage: "de_mirage",
    Nuke: "de_nuke",
    Ancient: "de_ancient",
    Train: "de_train",
    Inferno: "de_inferno",
    Anubis: "de_anubis"
};

const posCatcherModule = new Module("poscatcher", async () => {
    const enabled = await isExtensionEnabled() && await isSettingEnabled("poscatcher");
    if (!enabled) return;
    const matchId = extractMatchId();
    const cookieKey = `${matchId}_poscatched`
    if (getCookie(cookieKey)) return

    let mapselector = "[name=info] > div[class*=Overview__Stack] > div > div > div > div:nth-child(4) > div > div[class*=middleSlot] > div > div > span > span"
    let chatSelector = "div[class*=MatchRoom__ChatSidebarContainer] > div > div:nth-child(2) > div[class*=ChatSection__ChatContainer] > div > div > div > div > div[class*=MessageInputContainer] > div > div > div[class*=StyledTextArea__TextAreaWrapper] > textarea"

    posCatcherModule.doAfterNodeAppear(mapselector, async(node) => {
        const key = node.innerText.trim();
        if (!key) return;
        const mapPick = maps[key];
        if (!await isSettingEnabled(`${mapPick}Enabled`)) return
        let message = await getSettingValue(`${mapPick}Message`, "")
        if (typeof message !== "string" || message.trim() === "") return
        posCatcherModule.doAfterAllNodeAppear(chatSelector, (chatInput) => {
            chatInput.focus();

            const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
            descriptor.set.call(chatInput, message);

            chatInput.dispatchEvent(new Event('input', {bubbles: true}));
            chatInput.dispatchEvent(new Event('change', {bubbles: true}));

            chatInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));

            chatInput.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));

            setCookie(cookieKey,1,1440)
        })
    })
}, async () => {})