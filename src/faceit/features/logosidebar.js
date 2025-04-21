const logoSidebarModule = new Module("logoSidebar", async () => {
    let enabled = await isExtensionEnabled();
    if (!enabled) return;

    const logoConfig = {
        borderWidth: '2px',
        borderBlur: '4px',
        borderOpacity: '0.8',
        animationSpeed: '4s',
        brightness: '1.2'
    };

    await logoSidebarModule.doAfterNodeAppear('[class*="styles__TopContent"]', (node) => {
        if (document.getElementById("fc-logo-button")) return
        const container = document.createElement("div");
        container.id = "fc-logo-button"
        container.className = "fc-logo-container";
        container.style.margin = "10px";
        container.style.cursor = "pointer";
        container.title = "FACEIT FORECAST Settings";

        const gradientWrapper = document.createElement("div");
        gradientWrapper.className = "fc-logo-gradient";

        gradientWrapper.style.setProperty('--border-width', logoConfig.borderWidth);
        gradientWrapper.style.setProperty('--border-blur', logoConfig.borderBlur);
        gradientWrapper.style.setProperty('--border-opacity', logoConfig.borderOpacity);
        gradientWrapper.style.setProperty('--animation-speed', logoConfig.animationSpeed);
        gradientWrapper.style.setProperty('--hover-brightness', logoConfig.brightness);

        const img = document.createElement("img");
        img.src = getImageResource("src/visual/icons/logo.png").toString();
        img.alt = "Forecast Logo";
        img.className = "fc-logo-image";

        hideEmptyStyleContainer(node);

        gradientWrapper.appendChild(img);
        container.appendChild(gradientWrapper);
        node.appendChild(container);

        addLogoStyles();

        container.addEventListener('click', openExtensionPopup);
    });
}, async () => {});

function hideEmptyStyleContainer(node) {
    let friendsSectionNode = node.querySelector("[class*=stylesV2__BubbleWrapper]");
    let childs = Array.from(node.children);
    let index = childs.indexOf(friendsSectionNode);
    let emptyNode = childs[index + 1];
    emptyNode.style.display = "none";
}

function openExtensionPopup() {
    const existingPopup = document.getElementById("forecast-popup-container");
    if (existingPopup) {
        existingPopup.remove();
        return;
    }

    const popupURL = browserType === FIREFOX
        ? browser.runtime.getURL("src/visual/popup.html")
        : chrome.runtime.getURL("src/visual/popup.html");

    const popupContainer = document.createElement("div");
    popupContainer.id = "forecast-popup-container";

    const popupContent = document.createElement("div");
    popupContent.id = "forecast-popup-content";

    const popupFrame = document.createElement("iframe");
    popupFrame.src = popupURL;
    popupFrame.id = "forecast-popup-frame";

    popupContent.appendChild(popupFrame);
    popupContainer.appendChild(popupContent);
    document.body.appendChild(popupContainer);

    popupFrame.onload = () => {
        popupFrame.contentWindow.postMessage({ action: 'setBackgroundColor', color: 'transparent' }, '*');
    };

    const logoButton = document.querySelector(".fc-logo-container");
    if (logoButton) {
        const rect = logoButton.getBoundingClientRect();
        popupContainer.style.position = "fixed";
        popupContainer.style.right = `${rect.width + 25}px`;
        popupContainer.style.top = `${rect.top}px`;
    }

    addPopupStyles();

    document.addEventListener("click", function closePopupOutside(e) {
        if (!popupContainer.contains(e.target) && !logoButton.contains(e.target)) {
            popupContainer.remove();
            document.removeEventListener("click", closePopupOutside);
        }
    });
}

function addPopupStyles() {
    if (document.getElementById('fc-popup-styles')) return;

    const style = document.createElement('style');
    style.id = 'fc-popup-styles';
    style.textContent = `
        #forecast-popup-container {
            position: fixed;
            z-index: 9999;
            filter: drop-shadow(0 4px 20px rgba(0,0,0,0.25));
        }
        
        #forecast-popup-content {
            position: relative;
            width: 480px;
            height: 400px;
            border-radius: 12px;
            overflow: hidden;
            background-color: transparent;
            animation: fc-popup-appear 0.2s ease forwards;
            transform-origin: left top;
        }
        
        @keyframes fc-popup-appear {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        #forecast-popup-frame {
            border: none;
            width: 100%;
            height: 100%;
        }
    `;

    document.head.appendChild(style);
}

function addLogoStyles() {
    if (document.getElementById('fc-logo-styles')) return;
    const style = document.createElement('style');
    style.id = 'fc-logo-styles';
    style.textContent = `
        @property --angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }
        
        .fc-logo-container {
            position: relative;
            width: 44px;
            height: 44px;
        }
        
        .fc-logo-gradient {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .fc-logo-image {
            width: 44px;
            height: 44px;
            border-radius: 8px;
            position: relative;
            z-index: 1;
            transition: filter 0.2s ease;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            -ms-interpolation-mode: bicubic;
            filter: brightness(1) contrast(1.05);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .fc-logo-container:hover .fc-logo-image {
            filter: brightness(var(--hover-brightness, 1.2)) contrast(1.05);
        }
        
        .fc-logo-gradient::before,
        .fc-logo-gradient::after {
            content: '';
            position: absolute;
            height: 40px;
            width: 40px;
            border-radius: 8px;
            z-index: 0;
            background-image: conic-gradient(from var(--angle), #ff4500, #ff8c00, #ffcc00, #ff4500);
            animation: var(--animation-speed, 4s) logo-spin linear infinite;
        }
        
        .fc-logo-gradient::before {
            filter: blur(var(--border-blur, 4px));
            opacity: var(--border-opacity, 0.8);
        }
        
        @keyframes logo-spin {
            from { --angle: 0deg; }
            to { --angle: 360deg; }
        }
        
        #forecast-popup-container {
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            border-radius: 8px;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}