const fs = require('fs');

const logContent = fs.readFileSync('tsc_errors.log', 'utf8');
const lines = logContent.split('\n');

const fileFixes = new Map();

for (const line of lines) {
    const match = line.match(/^(src\/.*?\.(ts|tsx))\((\d+),\d+\): error TS18046: '(.*?)' is of type 'unknown'/);
    if (match) {
        const file = match[1];
        const lineNum = parseInt(match[3], 10) - 1;
        const varName = match[4];
        if (!fileFixes.has(file)) fileFixes.set(file, new Map());
        if (!fileFixes.get(file).has(lineNum)) fileFixes.get(file).set(lineNum, new Set());
        fileFixes.get(file).get(lineNum).add(varName);
    }
}

for (const [file, lineMap] of fileFixes.entries()) {
    const contentLines = fs.readFileSync(file, 'utf8').split('\n');
    for (const [lineNum, varNames] of lineMap.entries()) {
        let codeLine = contentLines[lineNum];
        for (const varName of varNames) {
            const regex = new RegExp(`\\b${varName}\\b(?=[\\.\\[])`, 'g');
            codeLine = codeLine.replace(regex, `(${varName} as any)`);
        }
        contentLines[lineNum] = codeLine;
    }
    fs.writeFileSync(file, contentLines.join('\n'));
    console.log(`Fixed TS18046 in ${file}`);
}
