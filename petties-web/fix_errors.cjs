const fs = require('fs');

const logContent = fs.readFileSync('tsc_errors.log', 'utf8');
const lines = logContent.split('\n');

const filesToFix = new Map();

for (const line of lines) {
    const match = line.match(/^(src\/.*?\.(ts|tsx))\(\d+,\d+\): error TS\d+: Cannot find name '(err|error)'/);
    if (match) {
        const file = match[1];
        const varName = match[3];
        if (!filesToFix.has(file)) {
            filesToFix.set(file, new Set());
        }
        filesToFix.get(file).add(varName);
    }
}

for (const [file, varNames] of filesToFix.entries()) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        const defaultVarName = varNames.has('err') ? 'err' : 'error';

        // Replace "catch {" or "catch{" with "catch (varName) {"
        content = content.replace(/catch\s*\{/g, `catch (${defaultVarName}) {`);

        fs.writeFileSync(file, content);
        console.log(`Fixed ${file} with catch (${defaultVarName}) {`);
    } catch (e) {
        console.error(`Could not fix ${file}: ${e}`);
    }
}
