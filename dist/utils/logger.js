"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
function log(color, level, msg) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${level}: ${msg}${colors.reset}`);
}
exports.logger = {
    info: (m) => log(colors.blue, 'INFO', m),
    success: (m) => log(colors.green, 'SUCCESS', m),
    error: (m) => log(colors.red, 'ERROR', m),
    warn: (m) => log(colors.yellow, 'WARN', m),
    debug: (m) => log(colors.magenta, 'DEBUG', m),
};
