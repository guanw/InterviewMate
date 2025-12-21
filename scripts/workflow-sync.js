#!/usr/bin/env node

/**
 * Unified Workflow Synchronization Script
 * Combines sync and git hook setup functionality
 *
 * Usage:
 *   node scripts/workflow-sync.js          # Show help
 *   node scripts/workflow-sync.js sync     # Sync workflow files
 *   node scripts/workflow-sync.js hooks    # Set up git hooks
 *   node scripts/workflow-sync.js all      # Do both sync and hooks
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SUBMODULE_WORKFLOW_PATH = path.join('.reviewmate', '.github', 'workflows', 'pull_request_review.yml');
const MAIN_WORKFLOW_PATH = path.join('.github', 'workflows', 'pull_request_review.yml');

function showHelp() {
  console.log(`
📋 Workflow Sync Tool - Usage:

  sync     Sync workflow files from submodule to main repo
  hooks    Set up git hooks for automatic synchronization
  all      Sync workflows and set up git hooks
  help     Show this help message

Examples:
  node scripts/workflow-sync.js sync
  node scripts/workflow-sync.js all
`);
}

function syncWorkflowFiles() {
  console.log('🔄 Syncing workflow files...');

  try {
    // Check if submodule workflow exists
    if (!fs.existsSync(SUBMODULE_WORKFLOW_PATH)) {
      console.error('❌ Submodule workflow file not found:', SUBMODULE_WORKFLOW_PATH);
      return false;
    }

    // Read submodule workflow
    const submoduleWorkflow = fs.readFileSync(SUBMODULE_WORKFLOW_PATH, 'utf8');

    // Update the path in the workflow to point to the submodule
    const updatedWorkflow = submoduleWorkflow.replace(
      'node scripts/enforce_clean_code.js',
      'node .reviewmate/scripts/enforce_clean_code.js'
    );

    // Write to main workflow
    fs.writeFileSync(MAIN_WORKFLOW_PATH, updatedWorkflow);

    console.log('✅ Workflow file synchronized successfully!');
    console.log('📋 Updated path: scripts/enforce_clean_code.js → .reviewmate/scripts/enforce_clean_code.js');
    return true;

  } catch (error) {
    console.error('❌ Error synchronizing workflow files:', error.message);
    return false;
  }
}

function setupGitHooks() {
  console.log('🔧 Setting up git hooks...');

  const hooksDir = path.join('.git', 'hooks');
  const postCheckoutHook = path.join(hooksDir, 'post-checkout');
  const postMergeHook = path.join(hooksDir, 'post-merge');

  try {
    // Create hooks directory if it doesn't exist
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Create hook content
    const hookContent = `#!/bin/sh
# Auto-sync workflow files when checking out branches or updating submodules

if [ -f "scripts/workflow-sync.js" ]; then
  echo "🔄 Auto-syncing workflow files..."
  node scripts/workflow-sync.js sync
fi
`;

    // Create post-checkout hook
    fs.writeFileSync(postCheckoutHook, hookContent);
    fs.chmodSync(postCheckoutHook, '755');

    // Create post-merge hook
    fs.writeFileSync(postMergeHook, hookContent);
    fs.chmodSync(postMergeHook, '755');

    console.log('✅ Git hooks created:');
    console.log('   - .git/hooks/post-checkout');
    console.log('   - .git/hooks/post-merge');
    console.log('💡 Workflow files will now auto-sync on git operations');
    return true;

  } catch (error) {
    console.error('❌ Error setting up git hooks:', error.message);
    return false;
  }
}

function cleanupOldScripts() {
  const oldScripts = [
    'scripts/sync-workflow-from-submodule.js',
    'scripts/setup-git-hook.js'
  ];

  for (const oldScript of oldScripts) {
    if (fs.existsSync(oldScript)) {
      try {
        fs.unlinkSync(oldScript);
        console.log(`🧹 Removed old script: ${oldScript}`);
      } catch (error) {
        console.warn(`⚠️ Could not remove ${oldScript}:`, error.message);
      }
    }
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Show help if no command or help requested
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  let success = true;

  switch (command) {
    case 'sync':
      success = syncWorkflowFiles();
      break;

    case 'hooks':
      success = setupGitHooks();
      break;

    case 'all':
      success = syncWorkflowFiles() && setupGitHooks();
      break;

    case 'clean':
      cleanupOldScripts();
      console.log('✅ Cleanup completed');
      return;

    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }

  if (success) {
    console.log('\n🎉 Operation completed successfully!');

    // Suggest next steps
    if (command === 'sync') {
      console.log('💡 Tip: Set up automatic sync with: node scripts/workflow-sync.js hooks');
    } else if (command === 'hooks') {
      console.log('💡 Tip: Test the sync manually with: node scripts/workflow-sync.js sync');
    }
  } else {
    console.log('\n❌ Operation failed. Check error messages above.');
    process.exit(1);
  }
}

// Export functions for testing
if (require.main === module) {
  main();
}

module.exports = {
  syncWorkflowFiles,
  setupGitHooks,
  cleanupOldScripts,
  showHelp
};