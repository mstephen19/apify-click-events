export const script = ({ mode, whitelist, blacklist, blockWindowClickListeners, blockWindowOpenMethod, allowDebugger, enableOnPagesIncluding, stopClickPropogation }) => {
    (() => {
        const url = window.location.href;

        if (!enableOnPagesIncluding.includes('*')) {
            if (!enableOnPagesIncluding.some((str: string) => url.includes(str))) return;
        }

        // Add whitelist and blacklist lists to the window

        //@ts-ignore
        window.whitelist = whitelist;
        //@ts-ignore
        window.blacklist = blacklist;
        //@ts-ignore
        window.clickManagerMode = mode;
        //@ts-ignore
        window.stopClickPropogation = stopClickPropogation;

        // All listeners to target
        const toBlock = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];

        if (blockWindowClickListeners === 2) {
            // Block any targeted listeners from even being added
            const { addEventListener: _addEventListener } = Element.prototype;

            const _addListener = function (type, func, option) {
                if (toBlock.some((a) => a === type)) return;

                //@ts-ignore
                _addEventListener.call(this, type, func, option);
            };

            window.addEventListener = _addListener;
        } else if (blockWindowClickListeners === 1) {
            // Prevent each from propogating unless the target matches a selector
            for (const type of toBlock) {
                window.addEventListener(
                    type,
                    function (e) {
                        //@ts-ignore
                        if (window.clickManagerMode === 'WHITELIST') {
                            //@ts-ignore
                            if (window.whitelist.some((s: string) => e.target.matches(s))) return;
                            return e.stopImmediatePropagation();
                        }
                        //@ts-ignore
                        if (window.clickManagerMode === 'BLACKLIST') {
                            //@ts-ignore
                            if (window.blacklist.some((s: string) => e.target.matches(s))) {
                                e.stopImmediatePropagation();
                            }
                        }
                    },
                    true
                );
            }
        }

        // Prevent the window.open method
        if (blockWindowOpenMethod) {
            //@ts-ignore
            window.open = function () {
                console.log('Page attempted to open new window with window.open');
            };
        }

        // Setting debugger to null bypasses most debugger blocks
        if (allowDebugger) {
            //@ts-ignore
            window.debugger = null;
        }

        const appendFinalElement = () => {
            const identifier = document.createElement('div');
            identifier.setAttribute('id', 'clickManagerReady');
            identifier.setAttribute(
                'style',
                'width: 100vw; height: 20px; background: lightgreen; display: flex; justify-content: center; align-items: center;'
            );
            identifier.textContent = 'ClickManager scripts injected';
            document.body.appendChild(identifier);
        };

        // For whitelist mode
        if (mode === 'WHITELIST') {
            window.addEventListener('DOMContentLoaded', () => {
                setInterval(() => {
                    const elems = [...document.querySelectorAll('*')];

                    elems.forEach((elem) => {
                        //@ts-ignore
                        if (window.whitelist.some((s: string) => elem.matches(s))) {
                            //@ts-ignore
                            elem.style.pointerEvents = 'auto';

                            // Prevent the possibility of the event propogating to other elements and firing other events
                            //@ts-ignore
                            if (!elem.listenerAdded && window.stopClickPropogation) {
                                elem.addEventListener('click', function (e) {
                                    e.stopPropagation();
                                });

                                elem.addEventListener('mousedown', function (e) {
                                    e.stopPropagation();
                                });

                                //@ts-ignore
                                elem.listenerAdded = true;
                            }

                            return;
                        }
                        // Disable pointer events
                        //@ts-ignore
                        elem.style.pointerEvents = 'none';
                    });
                }, 700);

                appendFinalElement();
            });
        }

        // For blacklist mode
        if (mode === 'BLACKLIST') {
            window.addEventListener('DOMContentLoaded', () => {
                setInterval(() => {
                    const elems = [...document.querySelectorAll('*')];

                    elems.forEach((elem) => {
                        //@ts-ignore
                        if (window.blacklist.some((s: string) => elem.matches(s))) {
                            //@ts-ignore
                            elem.style.pointerEvents = 'none';
                            return;
                        }
                        //@ts-ignore
                        elem.style.pointerEvents = 'auto';
                    });
                }, 700);

                appendFinalElement();
            });
        }
    })();
};
