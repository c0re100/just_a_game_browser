const fs = require("fs");

exports.default = async function(context) {
    console.log("\n- [JAGB] Create extensions dir to unpacked build...\n");

    fs.mkdirSync('./build/win-unpacked/extensions')
    fs.cpSync('../../extensions/uBlock', './build/win-unpacked/extensions/uBlock', { recursive: true })
    fs.cpSync('../../extensions/stylus', './build/win-unpacked/extensions/stylus', { recursive: true })
    fs.renameSync('./build/win-unpacked/just_a_games_browser.exe', './build/win-unpacked/chrome.exe')
}
