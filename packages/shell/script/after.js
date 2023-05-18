const fs = require("fs");

exports.default = async function (context) {
    let env = context.electronPlatformName

    let unpack_dir = ''
    if (env === 'win32') {
        unpack_dir = 'win-unpacked'
    } else if (env === 'linux') {
        unpack_dir = 'linux-unpacked'
    } else if (env === 'darwin') {
        unpack_dir = 'mac'
    }

    if (unpack_dir) {
        console.log("\n- [JAGB] Copy extensions to unpacked build...\n");

        if (env === 'darwin') {
            fs.mkdirSync('./build/' + unpack_dir + '/just_a_games_browser.app/Contents/extensions')
            fs.cpSync('../../extensions/uBlock', './build/' + unpack_dir + '/just_a_games_browser.app/Contents/extensions/uBlock', {recursive: true})
            fs.cpSync('../../extensions/stylus', './build/' + unpack_dir + '/just_a_games_browser.app/Contents/extensions/stylus', {recursive: true})
            fs.cpSync('../../extensions/Violentmonkey', './build/' + unpack_dir + '/just_a_games_browser.app/Contents/extensions/Violentmonkey', {recursive: true})
        } else {
            fs.mkdirSync('./build/' + unpack_dir + '/extensions')
            fs.cpSync('../../extensions/uBlock', './build/' + unpack_dir + '/extensions/uBlock', {recursive: true})
            fs.cpSync('../../extensions/stylus', './build/' + unpack_dir + '/extensions/stylus', {recursive: true})
            fs.cpSync('../../extensions/Violentmonkey', './build/' + unpack_dir + '/extensions/Violentmonkey', {recursive: true})
        }
    }
}
