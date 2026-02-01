#!/usr/bin/env node
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'fs';

/**
 * Read and parse JSON file with error handling
 */
function readJsonFile(filePath, description) {
  if (!existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse ${description}: ${error.message}`);
  }
}

/**
 * Write JSON file with error handling
 */
function writeJsonFile(filePath, data, description) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  } catch (error) {
    throw new Error(`Failed to write ${description}: ${error.message}`);
  }
}

async function main() {
  try {
    // Read version from package.json (single source of truth)
    const pkg = readJsonFile('./package.json', 'package.json');
    const version = pkg.version;

    if (!version) {
      throw new Error('Version not found in package.json');
    }

    // Common build options
    const commonOptions = {
      bundle: true,
      platform: 'node',
      format: 'esm',
      define: {
        __VERSION__: JSON.stringify(version),
      },
    };

    // Build main statusline entry point
    await build({
      ...commonOptions,
      entryPoints: ['scripts/statusline.ts'],
      outfile: 'dist/index.js',
    });

    console.log(`✓ Built dist/index.js with version ${version}`);

    // Build check-usage entry point
    await build({
      ...commonOptions,
      entryPoints: ['scripts/check-usage.ts'],
      outfile: 'dist/check-usage.js',
    });

    console.log(`✓ Built dist/check-usage.js with version ${version}`);

    // Sync plugin.json
    const pluginJson = readJsonFile('./.claude-plugin/plugin.json', 'plugin.json');
    pluginJson.version = version;
    writeJsonFile('./.claude-plugin/plugin.json', pluginJson, 'plugin.json');

    // Sync marketplace.json
    const marketplaceJson = readJsonFile('./.claude-plugin/marketplace.json', 'marketplace.json');
    marketplaceJson.version = version;
    if (marketplaceJson.metadata) {
      marketplaceJson.metadata.version = version;
    }
    writeJsonFile('./.claude-plugin/marketplace.json', marketplaceJson, 'marketplace.json');

    console.log(`✓ Synced version ${version} to plugin.json and marketplace.json`);
  } catch (error) {
    console.error(`✗ Build failed: ${error.message}`);
    process.exit(1);
  }
}

main();
