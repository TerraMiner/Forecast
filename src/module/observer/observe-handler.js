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

class ObserveHandler {
    constructor() {
        this.observerAppearTasks = new Map();
        this.observerDisappearTasks = new Map();
        this.observer = null
    }

    register() {
        this.observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        this.observerAppearTasks.forEach(async (task, _) => {
                            await task(node)
                        })
                    }
                    for (const node of mutation.removedNodes) {
                        this.observerDisappearTasks.forEach(async (task, _) => {
                            await task(node)
                        })
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    observeAppear(id, task) {
        this.observerAppearTasks.set(id, task)
    }

    observeDisappear(id, task) {
        this.observerDisappearTasks.set(id, task)
    }

    releaseAppearTask(id) {
        this.observerAppearTasks.delete(id)
    }

    releaseDisappearTask(id) {
        this.observerDisappearTasks.delete(id)
    }

    async doAfterNodeDisappear(selector, callback){
        this.observeDisappear(selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                callback(node)
                this.releaseAppearTask(selector)
            }
        })
    }

    async doAfterNodeAppear(selector, callback) {
        let element = document.querySelector(selector);
        if (element) await callback(element);

        this.observeAppear(selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                await callback(node);
            } else if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    await callback(child);
                }
            }
        });
    }

    async doAfterAllNodeAppear(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) {
            for (const element of elements) {
                await callback(element);
            }
        }

        this.observeAppear(selector, async (node) => {
            if (node.matches && node.matches(selector)) {
                await callback(node);
            }

            if (node.nodeType === 1) {
                const matchingChildren = node.querySelectorAll(selector);
                for (const child of matchingChildren) {
                    await callback(child);
                }
            }
        });
    }

    async doAfterAllNodeAppearPack(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) await callback(elements);

        this.observeAppear(selector, async () => {
            let elements = document.querySelectorAll(selector);
            if (elements.length !== 0) await callback(elements);
        });
    }

    release() {
        this.observerAppearTasks.clear();
        this.observerDisappearTasks.clear();
        this.observer?.disconnect()
    }

}