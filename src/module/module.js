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
        this.observerTasks = new Map();
        this.observer = null
    }

    async #load() {
        if (this.isLoaded) return
        println(`Module ${this.name} is loading`);
        this.#generateSessionId();
        this.registerObserver();
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
        this.registerObserver();
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
    }

    #releaseCaches() {
        this.observerTasks.clear();
        if (this.observer) {
            this.observer.disconnect()
        }

        this.processedNodes.forEach((node) => {
            node?.removeAttribute('data-processed')
        });
        this.processedNodes.length = 0;

        this.nodesToRemove.forEach((node) => {
            node?.remove()
        })
        this.nodesToRemove.length = 0

        this.hidedNodes.forEach((node) => {
            node?.style?.removeProperty('display')
        });
        this.hidedNodes.length = 0

        this.tasks.forEach((task) => {
            clearInterval(task)
        })
        this.tasks.length = 0
    }

    processedNode(node) {
        this.processedNodes.push(node)
        node.setAttribute('data-processed', '')
    }

    removalNode(node) {
        this.nodesToRemove.push(node)
    }

    appendToAndHide(sourceNode,hiddenNode) {
        appendToAndHide(sourceNode,hiddenNode)
        this.hidedNodes.push(hiddenNode)
    }

    preppendToAndHide(sourceNode,hiddenNode) {
        preppendToAndHide(sourceNode,hiddenNode)
        this.hidedNodes.push(hiddenNode)
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

    observe(id,task) {
        this.observerTasks.set(id,task)
    }

    releaseObserver(id) {
        this.observerTasks.delete(id)
    }

    registerObserver() {
        this.observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        this.observerTasks.forEach(async (task, _) => {
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

    async doAfterNodeAppear(selector, callback) {
        let element = document.querySelector(selector);
        if (element) await callback(element)
        this.observe(selector,async () => {
            let element = document.querySelector(selector);
            if (element) await callback(element);
        });
    }

    async doAfterAllNodeAppear(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) for (const element of elements) {
            await callback(element);
        }
        this.observe(selector,async () => {
            let elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element) await callback(element);
            }
        });
    }

    async doAfterAllNodeAppearPack(selector, callback) {
        let elements = document.querySelectorAll(selector);
        if (elements.length !== 0) await callback(elements)
        this.observe(selector,async () => {
            let elements = document.querySelectorAll(selector);
            if (elements.length !== 0) await callback(elements);
        });
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
}