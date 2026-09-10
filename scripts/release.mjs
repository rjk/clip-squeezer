#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const srcTauriDir = resolve(rootDir, 'src-tauri');

function run(command, options = {}) {
  const cwd = options.cwd || rootDir;
  console.log(`\x1b[36m> ${command}\x1b[0m`);
  return execSync(command, {
    cwd,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: true,
  });
}

function parseSemver(v) {
  const cleaned = v.trim().replace(/^v/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Invalid semver string: "${v}". Expected format: x.y.z`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    raw: cleaned,
  };
}

function bump(current, type) {
  const parsed = parseSemver(current);
  if (type === 'major') return `${parsed.major + 1}.0.0`;
  if (type === 'minor') return `${parsed.major}.${parsed.minor + 1}.0`;
  if (type === 'patch') return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  return parseSemver(type).raw;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const autoYes = args.includes('-y') || args.includes('--yes');
  const positionalArgs = args.filter((a) => !a.startsWith('-'));

  console.log('\n\x1b[1m🚀 Clip Squeezer Release Script\x1b[0m');
  if (dryRun) console.log('\x1b[33m(Running in --dry-run mode: no git commits or tags will be pushed)\x1b[0m');

  // 1. Verify clean git working directory
  const status = run('git status --porcelain', { capture: true }).trim();
  if (status) {
    console.error('\n\x1b[31mError: Git working tree is not clean. Please commit or stash changes before releasing.\x1b[0m');
    console.error(status);
    process.exit(1);
  }

  // 2. Verify current branch is main
  const currentBranch = run('git rev-parse --abbrev-ref HEAD', { capture: true }).trim();
  if (currentBranch !== 'main') {
    console.warn(`\x1b[33mWarning: You are currently on branch "${currentBranch}", not "main".\x1b[0m`);
    if (!autoYes) {
      const rl = readline.createInterface({ input, output });
      const proceedBranch = await rl.question('Do you want to continue releasing from this branch? (y/N): ');
      rl.close();
      if (proceedBranch.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }
    }
  }

  // 3. Read current versions
  const pkgPath = resolve(rootDir, 'package.json');
  const tauriConfPath = resolve(srcTauriDir, 'tauri.conf.json');
  const cargoTomlPath = resolve(srcTauriDir, 'Cargo.toml');

  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkgJson.version;
  console.log(`Current version: \x1b[32m${currentVersion}\x1b[0m`);

  // 4. Determine target version
  let targetVersion = null;
  const targetArg = positionalArgs[0];

  if (targetArg) {
    if (['patch', 'minor', 'major'].includes(targetArg.toLowerCase())) {
      targetVersion = bump(currentVersion, targetArg.toLowerCase());
    } else {
      targetVersion = parseSemver(targetArg).raw;
    }
  } else {
    const rl = readline.createInterface({ input, output });
    const patchVer = bump(currentVersion, 'patch');
    const minorVer = bump(currentVersion, 'minor');
    const majorVer = bump(currentVersion, 'major');

    console.log('\nSelect release version:');
    console.log(`  1) patch (\x1b[32m${patchVer}\x1b[0m)`);
    console.log(`  2) minor (\x1b[32m${minorVer}\x1b[0m)`);
    console.log(`  3) major (\x1b[32m${majorVer}\x1b[0m)`);
    console.log(`  4) custom version`);

    const choice = await rl.question('\nChoice [1-4] (default: 1): ');
    const trimmed = choice.trim();

    if (trimmed === '2') {
      targetVersion = minorVer;
    } else if (trimmed === '3') {
      targetVersion = majorVer;
    } else if (trimmed === '4') {
      const custom = await rl.question('Enter custom version: ');
      targetVersion = parseSemver(custom).raw;
    } else {
      targetVersion = patchVer;
    }
    rl.close();
  }

  const tagName = `v${targetVersion}`;
  console.log(`\nTarget version: \x1b[1m\x1b[32m${targetVersion}\x1b[0m (Tag: \x1b[1m\x1b[36m${tagName}\x1b[0m)`);

  // 5. Check if tag already exists locally or remotely
  try {
    const existingTags = run(`git tag -l ${tagName}`, { capture: true }).trim();
    if (existingTags) {
      console.error(`\x1b[31mError: Git tag "${tagName}" already exists locally.\x1b[0m`);
      process.exit(1);
    }
  } catch {
    // Ignore error
  }

  // 6. Confirm prompt
  if (!autoYes && !dryRun) {
    const rl = readline.createInterface({ input, output });
    const confirm = await rl.question(`\nBump to ${targetVersion}, commit, tag, and push to origin? (y/N): `);
    rl.close();
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // 7. Update package.json
  console.log('\nUpdating version files...');
  const pkgContent = readFileSync(pkgPath, 'utf8');
  const newPkgContent = pkgContent.replace(/"version":\s*"[^"]+"/, `"version": "${targetVersion}"`);
  writeFileSync(pkgPath, newPkgContent, 'utf8');
  console.log(`✓ Updated ${pkgPath}`);

  // 8. Update tauri.conf.json
  const tauriContent = readFileSync(tauriConfPath, 'utf8');
  const newTauriContent = tauriContent.replace(/"version":\s*"[^"]+"/, `"version": "${targetVersion}"`);
  writeFileSync(tauriConfPath, newTauriContent, 'utf8');
  console.log(`✓ Updated ${tauriConfPath}`);

  // 9. Update Cargo.toml (only under [package])
  const cargoContent = readFileSync(cargoTomlPath, 'utf8');
  const newCargoContent = cargoContent.replace(/^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m, `$1"${targetVersion}"`);
  writeFileSync(cargoTomlPath, newCargoContent, 'utf8');
  console.log(`✓ Updated ${cargoTomlPath}`);

  // 10. Update lockfiles
  console.log('\nUpdating package-lock.json and Cargo.lock...');
  run('npm install --package-lock-only');
  run('cargo check', { cwd: srcTauriDir });

  // 11. Run build verification
  console.log('\nRunning build verification (tsc & vite build)...');
  run('npm run build');

  if (dryRun) {
    console.log('\n\x1b[33m--dry-run completed successfully! Reverting changes...\x1b[0m');
    run('git checkout package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json');
    return;
  }

  // 12. Commit changes
  console.log('\nCommitting version bump...');
  run(`git commit -am "chore: bump version to ${targetVersion}"`);

  // 13. Push commit
  console.log('\nPushing commit to origin...');
  run(`git push origin ${currentBranch}`);

  // 14. Tag and push tag
  console.log(`\nCreating tag ${tagName}...`);
  run(`git tag -a ${tagName} -m "Release ${tagName}"`);

  console.log(`\nPushing tag ${tagName} to origin...`);
  run(`git push origin ${tagName}`);

  console.log('\n\x1b[1m\x1b[32m🎉 Release successfully published!\x1b[0m');
  console.log(`Version: \x1b[1m${targetVersion}\x1b[0m`);
  console.log(`Tag:     \x1b[1m${tagName}\x1b[0m`);
  console.log('\nActions Workflow:  https://github.com/rjk/clip-squeezer/actions');
  console.log('Releases Page:     https://github.com/rjk/clip-squeezer/releases');
}

main().catch((err) => {
  console.error('\n\x1b[31mRelease failed:\x1b[0m', err.message || err);
  process.exit(1);
});
