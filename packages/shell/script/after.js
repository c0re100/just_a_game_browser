const fs = require("fs");

exports.default = async function(context) {
    console.log("\n- [JAGB] Create extensions dir to unpacked build...\n");

    fs.mkdirSync('./build/win-unpacked/extensions')
    fs.cpSync('../../extensions/uBlock', './build/win-unpacked/extensions/uBlock', { recursive: true })
}
