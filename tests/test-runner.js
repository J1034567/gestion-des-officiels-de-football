#!/usr/bin/env node
/**
 * Simple Test Runner for Job System Integration
 * Usage: node test-runner.js
 */

import { JobSystemIntegrationTest } from './job-system-integration.test.js';

async function runIntegrationTests() {
    console.log('🚀 Starting Job System Integration Tests...\n');

    try {
        const testSuite = new JobSystemIntegrationTest();
        const results = await testSuite.runAllTests();

        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        if (failed === 0) {
            console.log('\n🎉 SUCCESS: All integration tests passed!');
            process.exit(0);
        } else {
            console.log(`\n❌ FAILED: ${failed} out of ${results.length} tests failed.`);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 CRITICAL ERROR: Test suite failed to run:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (process.argv[1].endsWith('test-runner.js')) {
    runIntegrationTests();
}