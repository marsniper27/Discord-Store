const fs = require('fs');
const path = require('node:path');

const commands = [];
const commandsFoldersPath = path.join(__dirname, 'commands');

const commandFiles = fs.readdirSync(commandsFoldersPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsFoldersPath, file));
    commands.push(command);
}

const classes = [];
const classesFoldersPath = path.join(__dirname, 'classes');

const classesFiles = fs.readdirSync(classesFoldersPath).filter(file => file.endsWith('.js'));
for (const file of classesFiles) {
    const classe = require(path.join(classesFoldersPath, file));
    classes.push(classe);
}

module.exports = { commands, classes };
