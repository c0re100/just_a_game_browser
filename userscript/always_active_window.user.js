// ==UserScript==
// @name        Always Active Window
// @namespace   Always Active Window
// @author      c0re100
// @description Override hide/visibility property
// @homepage    https://github.com/c0re100/just_a_game_browser
// @include     *://*
// @grant       none
// @version     1.0.0
// @run-at      document-start
// ==/UserScript==

Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: false
});
Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: false
});
