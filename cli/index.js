const fs = require("fs");
const ServerHandle = require("../src/ServerHandle");
const { genCommand } = require("../src/commands/CommandList");
const readline = require("readline");

if (!fs.existsSync("./settings.json")) {
    const defaultSettings = require("../src/Settings");
    fs.writeFileSync("./settings.json", JSON.stringify(defaultSettings, null, 4), "utf-8");
    console.log("using default settings - settings.json wasn't detected");
}
let settings = null;
try { settings = JSON.parse(fs.readFileSync("./settings.json", "utf-8")); }
catch (e) {
    console.log("caught error while parsing/reading settings.json:", e.stack);
    process.exit(1);
}

var currentHandle = new ServerHandle(settings);
const logger = currentHandle.logger;

require("./log-handler")(currentHandle);

var commandStreamClosing = false;
const commandStream = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "",
    historySize: 64,
    removeHistoryDuplicates: true
});

function ask() {
    if (commandStreamClosing) return;
    commandStream.question("@ ", (input) => {
        if (!(input = input.trim())) return;
        logger.printFile(`@ ${input}`);
        if (!currentHandle.commands.execute(null, input))
            logger.warn(`unknown command ${input}`);
        process.nextTick(ask);
    });
}
logger.inform("command stream open");
setTimeout(ask, 1000);

process.once("SIGINT", () => {
    logger.inform("(caught SIGINT)");
    currentHandle.stop();
    process.exitCode = 0;
});

currentHandle.commands.register(
    genCommand({
        name: "exit",
        args: "",
        desc: "stop the handle and close the command stream",
        exec: (handle, context, args) => {
            handle.stop();
            commandStream.close();
            commandStreamClosing = true;
        }
    }),
    genCommand({
        name: "reload",
        args: "",
        desc: "reload the settings from local settings.json",
        exec: (handle, context, args) => {
            try {
                currentHandle.setSettings(JSON.parse(fs.readFileSync("./settings.json", "utf-8")));
                logger.print("done");
            }
            catch (e) { logger.warn("caught error, possibly while parsing/reading settings.json:", e.stack); }
        }
    }),
    genCommand({
        name: "save",
        args: "",
        desc: "save the current settings to settings.json",
        exec: (handle, context, args) => {
            fs.writeFileSync("./settings.json", JSON.stringify(handle.settings, null, 4), "utf-8");
            logger.print("done");
        }
    }),
);

currentHandle.start();