/**
 * Phase 5 Test Suite — Git Intelligence Engine
 */

import { analyzeGitHistory } from '../git/gitAnalyzer';

async function runPhase5Tests() {
  console.log('--- Aegis Repository Intelligence — Phase 5 Test Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Test assertion failed: ${msg}`);
    }
  }

  // Test 1: Git History Analysis on Aegis Repository
  console.log('\n[1] Git History Analysis on Active Workspace');
  const { commits, fileStats } = await analyzeGitHistory({
    repoId: 'repo_aegis',
    repoPath: process.cwd(),
    maxCommits: 20,
  });

  assert(commits.length > 0, 'Extracts commit records from repository Git history');
  assert(Boolean(commits[0].sha && commits[0].author && commits[0].message), 'Parses commit SHA, author, and commit message');

  // Test 2: File Co-change Coupling
  console.log('\n[2] File Co-change Coupling Statistics');
  const statKeys = Object.keys(fileStats);
  assert(statKeys.length > 0, 'Tracks modified file commit statistics');

  const sampleFileStat = fileStats[statKeys[0]];
  assert(sampleFileStat.commitCount >= 1, 'Counts file commit frequencies');
  assert(typeof sampleFileStat.lastModifiedTimestamp === 'string', 'Tracks last modified commit timestamp');

  console.log(`\nPhase 5 Test Results: ${passed}/${total} assertions passed.`);
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 Test Suite Failed:', err);
  process.exit(1);
});
