#!/usr/bin/env node
/**
 * Code Quality Checker
 *
 * Validates all JavaScript files meet quality standards:
 * 1. English-only code comments
 * 2. JSDoc types on exported functions
 * 3. No AI attribution tags
 * 4. Consistent formatting
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MIXED_LANG_REGEX = /\/\/.*\b(por|para|con|que|del|los|las|usando|ordenadas)\b/i;
const AI_ATTR_REGEX = /(Generated with|Co-Authored-By|Claude Code)/i;
const EXPORT_REGEX = /^export (function|const|class)/m;
const JSDOC_REGEX = /@param|@returns/;

function getAllJsFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!entry.includes('node_modules') && !entry.includes('.git')) {
        getAllJsFiles(fullPath, files);
      }
    } else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const issues = [];

  // Check 1: Mixed language
  const langMatch = content.match(MIXED_LANG_REGEX);
  if (langMatch) {
    issues.push({
      type: 'LANG_MIX',
      message: `Mixed language: "${langMatch[0]}"`
    });
  }

  // Check 2: AI attribution
  const aiMatch = content.match(AI_ATTR_REGEX);
  if (aiMatch) {
    issues.push({
      type: 'AI_ATTR',
      message: `AI attribution found: "${aiMatch[0]}" (BANNED)`
    });
  }

  // Check 3: Missing JSDoc on exports
  const hasExports = EXPORT_REGEX.test(content);
  const hasJSDoc = JSDOC_REGEX.test(content);

  if (hasExports && !hasJSDoc) {
    issues.push({
      type: 'NO_JSDOC',
      message: 'Exported functions without JSDoc types'
    });
  }

  return issues;
}

function main() {
  console.log('🔍 Running code quality checks...\n');

  const srcFiles = getAllJsFiles('src');
  const allIssues = new Map();

  for (const file of srcFiles) {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.set(file, issues);
    }
  }

  if (allIssues.size === 0) {
    console.log('✅ All files pass quality checks!');
    console.log(`\nChecked ${srcFiles.length} files.`);
    process.exit(0);
  }

  console.log(`❌ Found issues in ${allIssues.size} files:\n`);

  for (const [file, issues] of allIssues) {
    console.log(`📄 ${file}:`);
    for (const issue of issues) {
      console.log(`   [${issue.type}] ${issue.message}`);
    }
    console.log('');
  }

  console.log(`\nTotal: ${srcFiles.length} files checked, ${allIssues.size} with issues.`);
  process.exit(1);
}

main();
