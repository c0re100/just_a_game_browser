// ==UserScript==
// @name        Always Active Window
// @namespace   Always Active Window
// @author      c0re100
// @description Override hide/visibility property, override rAF if game type is Cocos2d
// @homepage    https://github.com/c0re100/just_a_game_browser
// @include     *://*
// @grant       none
// @version     1.1
// @run-at      document-body
// ==/UserScript==

Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: false
});
Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: false
});

function rAFPatch() {
    window.requestAnimationFrame = new Proxy(window.requestAnimationFrame, {
        apply(target, self, args) {
            return setTimeout(function () {
                args[0](performance.now());
            }, 4);
        }
    });
    window.cancelAnimationFrame = new Proxy(window.cancelAnimationFrame, {
        apply(target, self, args) {
            clearTimeout(args[0]);
            return Reflect.apply(target, self, args);
        }
    });
}

if (document.getElementById("GameCanvas")) {
    console.log('Cocos2d detected, patching rAF...')
    rAFPatch();
}
