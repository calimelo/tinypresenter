const crypto = require('crypto');
const fs = require('fs');
const execSync = require('child_process').execSync;
const path = require('path');
let packageJson = require('./package.json');

const filever = packageJson.version;
const appname = packageJson.name;
const description = packageJson.description;
let arrfilever = filever.split('.');

while (arrfilever.length < 4) arrfilever.push('0');

const filever1 = arrfilever.join(',');

var versionData = `
1 VERSIONINFO
FILEVERSION ${filever1}
PRODUCTVERSION ${filever1}
FILEOS 0x40004
FILETYPE 0x1
{
BLOCK "StringFileInfo"
{
	BLOCK "040904B0"
	{
		VALUE "CompanyName", "tkgdata"
		VALUE "ProductName", "${appname}"
		VALUE "FileDescription", "${description}"
		VALUE "FileVersion", "${filever}"
		VALUE "ProductVersion", "${filever}"
		VALUE "OriginalFilename", "${appname}.exe"
		VALUE "InternalName", "${appname}"
		VALUE "LegalCopyright", "© tkgdata"
	}
}

BLOCK "VarFileInfo"
{
	VALUE "Translation", 0x0409 0x04B0  
}
}

`;

const versionFilePath = 'VersionInfo1.rc';
fs.writeFileSync(versionFilePath, versionData);

function mergeRCFile() {
  let resHacker = process.env.RESOURCE_HACKER;

  if (resHacker == undefined) resHacker = 'ResourceHacker.exe';

  execSync(
    '"' +
      resHacker +
      '" -open VersionInfo1.rc -save VersionInfo1.res -action compile -log NUL',
  );
  execSync(
    '"' +
      resHacker +
      '" -open ".\\temp \\v3.4\\fetched-v16.16.0-win-x64" -save ".\\temp \\v3.4\\fetched-v16.16.0-win-x64" -action addoverwrite -resource VersionInfo1.res',
  );
  execSync(
    '"' +
      resHacker +
      '" -open ".\\temp \\v3.4\\fetched-v16.16.0-win-x64" -save ".\\temp \\v3.4\\fetched-v16.16.0-win-x64" -action addoverwrite -resource ".\\icon\\tp.ico" -mask ICONGROUP,1',
  );
}

mergeRCFile();

const fileBuffer = fs.readFileSync(
  path.join(__dirname, './temp /v3.4/fetched-v16.16.0-win-x64'),
);

const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const hash = hashSum.digest('hex');
var fileData = `'use strict';
  Object.defineProperty(exports, '__esModule', { value: true });
  exports.EXPECTED_HASHES = void 0;
  exports.EXPECTED_HASHES = {
    'node-v16.16.0-win-x64':
      '${hash}',
  };
  //# sourceMappingURL=expected.js.map
  `;
const filePath = path.join(
  __dirname,
  'node_modules/pkg-fetch/lib-es5/expected.js',
);

fs.writeFileSync(filePath, fileData);
