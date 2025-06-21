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

class Module {
    constructor(name, loadAction, unloadAction = () => {
    }) {
        this.name = name
        this.loadAction = loadAction;
        this.unloadAction = unloadAction;
        this.isLoaded = false;
        this.processedNodes = [];
        this.nodesToRemove = [];
        this.hidedNodes = [];
        this.tasks = [];
        this.observeHandler = new ObserveHandler();
    }

    async #load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        this.#generateSessionId();
        this.observeHandler.register();
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully loaded`);
    }

    async #reload() {
        println(`Module ${this.name} is reloading`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        this.#generateSessionId();
        this.observeHandler.register();
        await this.loadAction();
        this.isLoaded = true
        println(`Module ${this.name} is successfully reloaded`);
    }

    async #unload() {
        if (!this.isLoaded) return
        println(`Module ${this.name} is disabling`);
        await this.unloadAction();
        this.#releaseCaches();
        this.isLoaded = false
        println(`Module ${this.name} is successfully disabled`);
    }

    #generateSessionId() {
        this.sessionId = Math.random().toString(36).substring(2, 10);
        this.dataProcessedAttribute = `data-processed-${this.sessionId}`
    }

    #releaseCaches() {
        requestAnimationFrame(() => {
            this.observeHandler.release();

            this.processedNodes.forEach((node) => {
                node?.removeAttribute(this.dataProcessedAttribute)
            });
            this.processedNodes.length = 0;

            for (let i = 0; i < this.nodesToRemove.length; i++) {
                let node = this.nodesToRemove[i];
                node?.remove();
            }
            this.nodesToRemove.length = 0;

            this.hidedNodes.forEach((node) => {
                node?.style?.removeProperty('display')
            });
            this.hidedNodes.length = 0

            this.tasks.forEach((task) => {
                clearInterval(task)
            })
            this.tasks.length = 0
        });
    }

    processedNode(node, attribute = this.dataProcessedAttribute) {
        this.processedNodes.push(node)
        node.setAttribute(attribute, '')
    }

    isProcessedNode(node, attribute = this.dataProcessedAttribute) {
        return node.hasAttribute(attribute)
    }

    removalNode(node) {
        this.nodesToRemove.push(node)
    }

    appendToAndHide(sourceNode, hiddenNode) {
        appendToAndHide(sourceNode, hiddenNode)
        this.hidedNodes.push(hiddenNode)
    }

    preppendToAndHide(sourceNode, hiddenNode) {
        preppendToAndHide(sourceNode, hiddenNode)
        this.hidedNodes.push(hiddenNode)
    }

    async doAfterNodeDisappear(selector, callback) {
        return this.observeHandler.doAfterNodeDisappear(selector,callback)
    }
    async doAfterNodeAppear(selector, callback) {
        return this.observeHandler.doAfterNodeAppear(selector,callback)
    }
    async doAfterAllNodeAppear(selector, callback) {
        return this.observeHandler.doAfterAllNodeAppear(selector,callback)
    }
    async doAfterAllNodeAppearPack(selector, callback) {
        return this.observeHandler.doAfterAllNodeAppearPack(selector,callback)
    }

    async doAfterAsync(conditionFn, callback, interval = 50) {
        let isRunning = true;
        let task;

        const checkCondition = async () => {
            if (!isRunning) return;

            const conditionResult = conditionFn();
            if (conditionResult) {
                isRunning = false;
                if (task) task();
                await callback(conditionResult);
            }
        };

        await checkCondition();

        task = this.every(interval, checkCondition);

        return () => {
            isRunning = false;
            if (task) task();
        };
    }

    doAfter(conditionFn, callback, interval = 50) {
        let isRunning = true;
        let task;

        const checkCondition = () => {
            if (!isRunning) return;

            const conditionResult = conditionFn();
            if (conditionResult) {
                isRunning = false;
                if (task) task();
                callback(conditionResult);
            }
        };

        checkCondition();

        task = this.every(interval, checkCondition);

        return () => {
            isRunning = false;
            if (task) task();
        };
    }

    every(period, callback) {
        const task = setInterval(callback, period)
        this.tasks.push(task)
        return () => clearInterval(task)
    }

    async produceOf(action) {
        switch (action) {
            case "load":
                await this.#load();
                break;
            case "reload":
                await this.#reload();
                break;
            case "unload":
                await this.#unload();
                break;
            default:
                println("Unknown action:", action);
        }
    }

    temporaryFaceitBugFix() {
        let existDialog = document.querySelector('[marked-as-bug]');
        if (existDialog) {
            if (!document.querySelector('[role="dialog"][data-dialog-type="LEAF"]')) {
                existDialog.removeAttribute("marked-as-bug")
            } else {
                this.doAfterNodeDisappear('[role="dialog"][data-dialog-type="LEAF"]', (node) => {
                    existDialog.removeAttribute("marked-as-bug")
                })
            }
            return
        }
        this.doAfterNodeAppear('[role="dialog"][data-dialog-type="LEAF"]', () => {
            let toMark = document.getElementById("canvas-body");
            if (toMark.hasAttribute("marked-as-bug")) return
            toMark.setAttribute("marked-as-bug",'');
        });
    }
}