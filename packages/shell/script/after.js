const fs = require("fs");

exports.default = async function (context) {
    let env = context.electronPlatformName

    let unpack_dir = ''
    if (env === 'win32') {
        unpack_dir = 'win-unpacked'
    } else if (env === 'linux') {
        unpack_dir = 'linux-unpacked'
    } else if (env === 'mac') {
        unpack_dir = 'mac-unpacked'
    }

    if (unpack_dir) {
        console.log("\n- [JAGB] Copy extensions to unpacked build...\n");
        fs.mkdirSync('./build/' + unpack_dir + '/extensions')
        fs.cpSync('../../extensions/uBlock', './build/' + unpack_dir + '/extensions/uBlock', {recursive: true})
        fs.cpSync('../../extensions/stylus', './build/' + unpack_dir + '/extensions/stylus', {recursive: true})
        fs.cpSync('../../extensions/Violentmonkey', './build/' + unpack_dir + '/extensions/Violentmonkey', {recursive: true})
        if (env === 'win32') {
            fs.renameSync('./build/' + unpack_dir + '/just_a_games_browser.exe', './build/' + unpack_dir + '/chrome.exe')
        } else {
            fs.renameSync('./build/' + unpack_dir + '/just_a_games_browser', './build/' + unpack_dir + '/chrome')
        }
    }
}
