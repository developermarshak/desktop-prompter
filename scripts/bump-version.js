#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node bump-version.js <version>');
  console.error('Example: node bump-version.js 0.2.0');
  process.exit(1);
}

const newVersion = args[0];

// Validate semver format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Invalid version format. Use semver: X.Y.Z');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');

// Update package.json
const packagePath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ Updated package.json to ${newVersion}`);

// Update Cargo.toml
const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
let cargoContent = fs.readFileSync(cargoPath, 'utf8');
cargoContent = cargoContent.replace(
  /^version = ".*"$/m,
  `version = "${newVersion}"`
);
fs.writeFileSync(cargoPath, cargoContent);
console.log(`✓ Updated Cargo.toml to ${newVersion}`);

// Update tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✓ Updated tauri.conf.json to ${newVersion}`);

console.log(`\n✓ All files updated to version ${newVersion}`);
console.log('\nNext steps:');
console.log('1. Review changes: git diff');
console.log(`2. Commit: git add -A && git commit -m "chore: bump version to ${newVersion}"`);
console.log(`3. Tag: git tag v${newVersion}`);
console.log('4. Push: git push && git push --tags');
