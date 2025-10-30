#!/usr/bin/env node

/**
 * Tangle - Extract code from literate programming files
 *
 * Reads .lit.md files and extracts code chunks to actual source files.
 *
 * Syntax:
 *   <<filename>>=
 *   code here
 *   <<other-chunk>>
 *   @
 *
 * The @ symbol ends a chunk.
 * Chunks can reference other chunks with <<name>>.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

/**
 * Extract all chunks from literate file
 *
 * Returns: Map<chunkName, chunkContent>
 */
function extractChunks(content) {
  const chunks = new Map();

  // Regex to match: <<name>>= ... @ (with @ on its own line)
  const chunkRegex = /<<(.+?)>>=\n([\s\S]*?)^@$/gm;

  let match;
  while ((match = chunkRegex.exec(content)) !== null) {
    const [, name, body] = match;
    const trimmedName = name.trim();
    const trimmedBody = body.trim();

    if (chunks.has(trimmedName)) {
      // Append to existing chunk (allows splitting chunks across file)
      chunks.set(trimmedName, chunks.get(trimmedName) + '\n\n' + trimmedBody);
    } else {
      chunks.set(trimmedName, trimmedBody);
    }
  }

  return chunks;
}

/**
 * Expand chunk references recursively
 *
 * Replaces <<chunk-name>> with the content of that chunk.
 * Handles indentation correctly.
 */
function expandChunks(content, chunks, visited = new Set()) {
  // Regex to match: <<chunk-name>> (possibly with indentation)
  const refRegex = /^(\s*)<<(.+?)>>$/gm;

  return content.replace(refRegex, (match, indent, refName) => {
    const trimmedRef = refName.trim();

    // Detect circular references
    if (visited.has(trimmedRef)) {
      throw new Error(`Circular reference detected: ${trimmedRef}`);
    }

    if (!chunks.has(trimmedRef)) {
      console.warn(`${colors.yellow}⚠ Warning: Chunk not found: ${trimmedRef}${colors.reset}`);
      return match; // Leave as-is
    }

    // Get referenced chunk
    const referencedContent = chunks.get(trimmedRef);

    // Mark as visited (for circular detection)
    const newVisited = new Set(visited);
    newVisited.add(trimmedRef);

    // Recursively expand the referenced chunk
    const expanded = expandChunks(referencedContent, chunks, newVisited);

    // Apply indentation to every line
    const lines = expanded.split('\n');
    const indentedLines = lines.map(line =>
      line.length > 0 ? indent + line : line
    );

    return indentedLines.join('\n');
  });
}

/**
 * Write chunk to file if it's a file path (starts with src/, tests/, or migrations/)
 */
function writeChunkToFile(chunkName, content, chunks) {
  // Only process chunks that look like file paths
  if (!chunkName.startsWith('src/') && !chunkName.startsWith('tests/') && !chunkName.startsWith('migrations/')) {
    return false;
  }

  const filePath = path.join(ROOT_DIR, chunkName);
  const dir = path.dirname(filePath);

  // Expand all chunk references
  const expanded = expandChunks(content, chunks);

  // Create directory if doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, expanded + '\n', 'utf-8');

  console.log(`${colors.green}✓${colors.reset} Generated ${colors.blue}${chunkName}${colors.reset}`);
  return true;
}

/**
 * Main tangling function
 */
function tangle(litFilePath) {
  console.log(`\n${colors.blue}Tangling${colors.reset} ${litFilePath}...\n`);

  // Read literate file
  const content = fs.readFileSync(litFilePath, 'utf-8');

  // Extract all chunks
  const chunks = extractChunks(content);

  console.log(`Found ${colors.yellow}${chunks.size}${colors.reset} chunks\n`);

  // Write file chunks
  let filesGenerated = 0;
  for (const [name, body] of chunks.entries()) {
    if (writeChunkToFile(name, body, chunks)) {
      filesGenerated++;
    }
  }

  console.log(`\n${colors.green}✓ Done!${colors.reset} Generated ${filesGenerated} files\n`);
}

/**
 * Main entry point
 */
function main() {
  const litFiles = [
    path.join(ROOT_DIR, 'docs/literate-programming/phase-1-core.lit.md'),
    path.join(ROOT_DIR, 'docs/literate-programming/phase-2-organization.lit.md')
  ];

  try {
    for (const litFile of litFiles) {
      if (fs.existsSync(litFile)) {
        tangle(litFile);
      }
    }
  } catch (error) {
    console.error(`${colors.red}✗ Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

main();
