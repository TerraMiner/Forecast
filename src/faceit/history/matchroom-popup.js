class MatchroomPopup {
    constructor(table) {
        this.wrapper = table.querySelector("[class=popup-wrapper]");
        this.popup = this.wrapper.children[0];
        this.isAttached = false;
        this.stats = null;
    }

    attachToElement(element, matchStatistic, playerId) {
        if (this.isAttached) return;

        this.playerId = playerId;
        this.stats = matchStatistic;

        const popupContainer = element.querySelector('.show-popup-button-wrap');
        this.setupStats();
        popupContainer.appendChild(this.wrapper);

        this.isAttached = true;
    }

    setupStats() {
        const sortByKills = (players) => players.sort((a, b) => b.player_stats["Kills"] - a.player_stats["Kills"]);

        const teams = [
            sortByKills(this.stats.rounds[0].teams[0].players),
            sortByKills(this.stats.rounds[0].teams[1].players),
        ];

        const tables = [
            this.popup.querySelector(`#team-table-popup-1`),
            this.popup.querySelector(`#team-table-popup-2`),
        ];

        const rowTemplate = document.createElement("tr");
        rowTemplate.classList.add("popup-table-row");
        const cellTemplate = document.createElement("td");
        cellTemplate.classList.add("popup-table-cell");

        const createRow = (playerStats) => {
            const row = rowTemplate.cloneNode(true);
            const stats = playerStats["player_stats"];
            const data = [
                playerStats.nickname,
                stats["Kills"],
                stats["Assists"],
                stats["Deaths"],
                stats["K/R Ratio"],
                stats["K/D Ratio"],
                stats["Headshots"],
                stats["Headshots %"],
                stats["MVPs"],
                stats["ADR"],
            ];

            data.forEach((value, index) => {
                const cell = cellTemplate.cloneNode(true);
                if (index === 0 && this.playerId === playerStats.player_id) {
                    cell.style.color = "#FF5500FF";
                    cell.style.fontWeight = "bold";
                }
                cell.textContent = value;
                row.appendChild(cell);
            });

            return row;
        };

        for (let index = 0; index < teams.length; index++) {
            let team = teams[index];
            const table = tables[index];
            const rows = team.map(createRow);
            table.append(...rows);
        }
    }
}
