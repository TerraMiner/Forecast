class MatchroomPopup {
    constructor() {
        this.popupElement = getHtmlResource("src/visual/tables/hover-popup-matchroom.html").cloneNode(true);
        this.popupElement.classList.add('popup-tooltip');
        
        Object.assign(this.popupElement.style, {
            display: "none",
            position: "fixed",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            opacity: "0",
            transform: "translateY(-5px)",
            pointerEvents: "none",
            zIndex: 3
        });

        this.targetNodes = new Map();
        this.activeTarget = null;
        this.isPopupVisible = false;

        document.addEventListener("click", this.handleDocumentClick.bind(this));
    }

    attachToElement(element, matchStatistic, playerId) {
        if (this.targetNodes.has(element)) return;
        this.playerId = playerId;

        const popupClone = this.popupElement.cloneNode(true);
        popupClone.classList.add('popup-tooltip');
        
        const popupContainer = element.querySelector('.show-popup-button-wrap');
        
        const popupWrapper = document.createElement('div');
        Object.assign(popupWrapper.style, {
            position: 'relative',
            zIndex: 3
        });

        popupWrapper.appendChild(popupClone);
        popupContainer.appendChild(popupWrapper);

        this.targetNodes.set(element, {
            stats: matchStatistic,
            popup: popupClone,
            wrapper: popupWrapper
        });

        const button = element.querySelector('.show-popup-button');
        
        // Обработка событий мыши
        const handleMouseEnter = (event) => {
            // Если есть активный попап и это другой элемент, скрываем его
            if (this.activeTarget && this.activeTarget !== element) {
                this.hidePopup();
            }
            clearTimeout(this.hideTimeout);
            this.handleButtonMouseEnter(event, element);
        };

        const handleMouseLeave = (event) => {
            const { popup, wrapper } = this.targetNodes.get(element);
            const relatedTarget = event.relatedTarget;
            
            // Проверяем, не наводимся ли мы на другую кнопку
            const targetingOtherButton = relatedTarget && relatedTarget.closest('.show-popup-button');
            
            if ((!popup.contains(relatedTarget) && !wrapper.contains(relatedTarget)) || targetingOtherButton) {
                this.hideTimeout = setTimeout(() => {
                    this.hidePopup();
                    this.activeTarget = null;
                }, 100);
            }
        };

        button.addEventListener("mouseenter", handleMouseEnter);
        button.addEventListener("mouseleave", handleMouseLeave);
        popupWrapper.addEventListener("mouseenter", () => clearTimeout(this.hideTimeout));
        popupWrapper.addEventListener("mouseleave", handleMouseLeave);
    }

    handleButtonMouseEnter(event, target) {
        this.activeTarget = target;
        const { popup } = this.targetNodes.get(target);
        this.updateContent(target, popup);
        
        requestAnimationFrame(() => {
            this.showPopup(popup);
            this.positionPopup(event.target.getBoundingClientRect(), popup);
        });
    }

    handleButtonMouseLeave(event) {
        setTimeout(() => {
            if (!this.popupElement.matches(':hover')) {
                this.hidePopup();
                this.activeTarget = null;
            }
        }, 50);
    }
    
    handlePopupMouseLeave(event) {
        const button = this.activeTarget?.querySelector('.show-popup-button');
        if (!button?.matches(':hover')) {
            this.hidePopup();
            this.activeTarget = null;
        }
    }

    handleDocumentClick(event) {
        if (this.isPopupVisible && !this.popupElement.contains(event.target)) {
            this.hidePopup();
            this.activeTarget = null;
        }
    }

    positionPopup(buttonRect, popup) {
        const popupRect = popup.getBoundingClientRect();
        const wrapperRect = popup.parentElement.getBoundingClientRect();
        
        // Центрируем попап относительно кнопки
        const left = -(popupRect.width / 2) + (buttonRect.width / 2);
        
        // Проверяем границы экрана
        const viewportWidth = window.innerWidth;
        const popupLeft = wrapperRect.left + left;
        
        if (popupLeft < 0) {
            popup.style.left = `${-wrapperRect.left}px`;
        } else if (popupLeft + popupRect.width > viewportWidth) {
            popup.style.left = `${viewportWidth - wrapperRect.left - popupRect.width}px`;
        } else {
            popup.style.left = `${left}px`;
        }
        
        popup.style.top = '0';
    }

    showPopup(popup) {
        popup.style.display = "block";
        
        requestAnimationFrame(() => {
            Object.assign(popup.style, {
                opacity: "1",
                transform: "translateY(0)",
                pointerEvents: "auto"
            });
            this.isPopupVisible = true;
        });
    }

    hidePopup() {
        if (!this.activeTarget) return;
        const { popup } = this.targetNodes.get(this.activeTarget);
        
        Object.assign(popup.style, {
            opacity: "0",
            transform: "translateY(-5px)",
            pointerEvents: "none"
        });
        
        setTimeout(() => {
            if (popup.style.opacity === "0") {
                popup.style.display = "none";
                this.isPopupVisible = false;
            }
        }, 200);
    }

    updateContent(target, popup) {
        const { stats } = this.targetNodes.get(target);
        const sortByKills = (players) => players.sort((a, b) => b.player_stats["Kills"] - a.player_stats["Kills"]);

        const teams = [
            sortByKills(stats.rounds[0].teams[0].players),
            sortByKills(stats.rounds[0].teams[1].players),
        ];

        const tables = [
            popup.querySelector(`#team-table-popup-1`),
            popup.querySelector(`#team-table-popup-2`)
        ];

        // Очищаем таблицы
        tables.forEach(table => table.innerHTML = "");

        // Заполняем таблицы
        teams.forEach((team, index) => {
            team.forEach((playerStats) => {
                const row = document.createElement("tr");
                row.classList.add("popup-table-row");
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

                data.forEach((value, cellIndex) => {
                    const cell = document.createElement("td");
                    if (cellIndex === 0 && this.playerId === playerStats.player_id) {
                        cell.style.color = "rgb(255, 85, 0)";
                    }
                    cell.classList.add("popup-table-cell");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                tables[index].appendChild(row);
            });
        });

        requestAnimationFrame(() => {
            const button = target.querySelector('.show-popup-button');
            if (!button) {
                console.error('Button not found');
                return;
            }
            
            const buttonRect = button.getBoundingClientRect();
            const [table1, table2] = popup.querySelectorAll('.popup-scoreboard-table');
            if (!table1 || !table2) {
                console.error('Tables not found');
                return;
            }
            
            const table1Height = table1.getBoundingClientRect().height;
            const table2Height = table2.getBoundingClientRect().height;
            const totalHeight = table1Height + 5 + table2Height;
            
            // Устанавливаем стили для попапа
            Object.assign(popup.style, {
                display: 'flex',
                position: 'absolute',
                opacity: '0',
                pointerEvents: 'none',
                zIndex: '9999'
            });
            
            requestAnimationFrame(() => {
                const wrapperRect = popup.parentElement.getBoundingClientRect();
                const buttonCenterY = buttonRect.top - wrapperRect.top + (buttonRect.height / 2);
                const top = buttonCenterY - (table1Height + 2.5);
                
                // Применяем позиционирование
                Object.assign(popup.style, {
                    left: '100%',
                    top: `${top}px`,
                    opacity: '1',
                    pointerEvents: 'auto',
                    marginLeft: '5px'
                });
                
                // Проверяем границы экрана
                const viewportWidth = window.innerWidth;
                const popupRect = popup.getBoundingClientRect();
                
                if (wrapperRect.right + 5 + popupRect.width > viewportWidth) {
                    // Если не помещается справа, показываем слева
                    popup.style.left = 'auto';
                    popup.style.right = '100%';
                    popup.style.marginLeft = '0';
                    popup.style.marginRight = '5px';
                }
            });
        });
    }
}