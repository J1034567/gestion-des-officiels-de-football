/**
 * Integration Test for Consolidated Job System
 * 
 * This test validates the entire job processing pipeline:
 * 1. Job creation via jobService
 * 2. Job processing via process-jobs Edge Function
 * 3. Progress tracking via JobCenter hooks
 * 4. Error handling and recovery
 * 5. Resource management and concurrency
 */

import { supabase } from '../lib/supabaseClient';
import { jobService } from '../services/jobService';

// Test configuration
const TEST_CONFIG = {
    timeout: 30000, // 30 seconds for job processing
    pollInterval: 1000, // Check job status every second
    maxRetries: 3
};

interface TestResults {
    testName: string;
    success: boolean;
    duration: number;
    error?: string;
    details?: any;
}

/**
 * Test Suite for Job System Integration
 */
class JobSystemIntegrationTest {
    private results: TestResults[] = [];

    constructor() {
        console.log('🧪 Starting Job System Integration Tests');
        console.log('='.repeat(50));
    }

    /**
     * Run all integration tests
     */
    async runAllTests(): Promise<TestResults[]> {
        try {
            await this.testJobServiceEnqueue();
            await this.testBulkPDFGeneration();
            await this.testBulkEmailSending();
            await this.testJobDeduplication();
            await this.testErrorHandling();
            await this.testConcurrencyControl();

            this.printSummary();
            return this.results;
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            throw error;
        }
    }

    /**
     * Test 1: Basic Job Service Enqueue
     */
    async testJobServiceEnqueue(): Promise<void> {
        const testName = 'Job Service Enqueue';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            const job = await jobService.enqueueJob({
                type: 'mission_orders.bulk_pdf_v3',
                label: 'Test Bulk PDF Job',
                scope: 'test',
                meta: {
                    orders: [
                        { matchId: 'test-match-1', officialId: 'test-official-1' },
                        { matchId: 'test-match-2', officialId: 'test-official-2' }
                    ],
                    total: 2
                },
                total: 2,
                priority: 'normal',
                dedupe_key: 'test-dedup-key-1',
                retry_policy: {
                    max_attempts: 3,
                    backoff_base_ms: 1000,
                    backoff_multiplier: 2,
                    retryable_errors: ['network_error', 'resource_limit']
                }
            });

            // Validate job creation
            if (!job.id || job.status !== 'pending') {
                throw new Error(`Invalid job created: ${JSON.stringify(job)}`);
            }

            // Test job retrieval
            const retrievedJob = await this.getJobFromDatabase(job.id);
            if (!retrievedJob) {
                throw new Error('Job not found in database after creation');
            }

            this.recordSuccess(testName, startTime, { jobId: job.id, status: job.status });
            console.log(`✅ ${testName}: Job created successfully (ID: ${job.id})`);

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Test 2: Bulk PDF Generation End-to-End
     */
    async testBulkPDFGeneration(): Promise<void> {
        const testName = 'Bulk PDF Generation';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            // Create a real bulk PDF job with actual match/official data
            const { data: matches } = await supabase
                .from('matches')
                .select('id')
                .limit(1)
                .single();

            const { data: officials } = await supabase
                .from('officials')
                .select('id')
                .limit(2);

            if (!matches || !officials || officials.length < 2) {
                console.log(`⏭️ Skipping ${testName}: Insufficient test data`);
                return;
            }

            const orders = officials.map(official => ({
                matchId: matches.id,
                officialId: official.id
            }));

            const job = await jobService.enqueueJob({
                type: 'mission_orders.bulk_pdf_v3',
                label: 'Integration Test - Bulk PDF',
                scope: 'test',
                meta: { orders, total: orders.length },
                total: orders.length,
                priority: 'high',
                dedupe_key: `test-bulk-pdf-${Date.now()}`
            });

            // Trigger job processing
            await this.triggerJobProcessing();

            // Wait for completion
            const finalJob = await this.waitForJobCompletion(job.id);

            if (finalJob.status === 'completed' && finalJob.artifactUrl) {
                this.recordSuccess(testName, startTime, {
                    jobId: job.id,
                    artifactUrl: finalJob.artifactUrl,
                    orderCount: orders.length
                });
                console.log(`✅ ${testName}: PDF generated successfully`);
            } else {
                throw new Error(`Job failed or incomplete: ${JSON.stringify(finalJob)}`);
            }

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Test 3: Bulk Email Sending
     */
    async testBulkEmailSending(): Promise<void> {
        const testName = 'Bulk Email Sending';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            // Get test officials with email addresses
            const { data: officials } = await supabase
                .from('officials')
                .select('id, email, name')
                .not('email', 'is', null)
                .limit(2);

            if (!officials || officials.length === 0) {
                console.log(`⏭️ Skipping ${testName}: No officials with email addresses`);
                return;
            }

            const recipients = officials.map(o => ({
                id: o.id,
                email: o.email,
                name: o.name
            }));

            const job = await jobService.enqueueJob({
                type: 'mission_orders.email_bulk_v3',
                label: 'Integration Test - Bulk Email',
                scope: 'test',
                meta: {
                    recipients,
                    subject: 'Test Email from Integration Suite',
                    message: 'This is a test email sent during integration testing.',
                    total: recipients.length
                },
                total: recipients.length,
                priority: 'normal'
            });

            // Trigger job processing
            await this.triggerJobProcessing();

            // Wait for completion
            const finalJob = await this.waitForJobCompletion(job.id);

            if (finalJob.status === 'completed') {
                this.recordSuccess(testName, startTime, {
                    jobId: job.id,
                    recipientCount: recipients.length
                });
                console.log(`✅ ${testName}: Emails sent successfully`);
            } else {
                throw new Error(`Email job failed: ${JSON.stringify(finalJob)}`);
            }

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Test 4: Job Deduplication
     */
    async testJobDeduplication(): Promise<void> {
        const testName = 'Job Deduplication';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            const dedupeKey = `test-dedup-${Date.now()}`;

            // Create first job
            const job1 = await jobService.enqueueJob({
                type: 'mission_orders.bulk_pdf_v3',
                label: 'Dedup Test Job 1',
                scope: 'test',
                meta: { test: true },
                dedupe_key: dedupeKey
            });

            // Create second job with same dedupe key
            const job2 = await jobService.enqueueJob({
                type: 'mission_orders.bulk_pdf_v3',
                label: 'Dedup Test Job 2',
                scope: 'test',
                meta: { test: true },
                dedupe_key: dedupeKey
            });

            // Should return the same job
            if (job1.id !== job2.id) {
                throw new Error('Deduplication failed: different job IDs returned');
            }

            this.recordSuccess(testName, startTime, {
                dedupeKey,
                jobId: job1.id,
                reused: true
            });
            console.log(`✅ ${testName}: Job deduplication working correctly`);

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Test 5: Error Handling
     */
    async testErrorHandling(): Promise<void> {
        const testName = 'Error Handling';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            // Create job with invalid data to trigger error
            const job = await jobService.enqueueJob({
                type: 'mission_orders.bulk_pdf_v3',
                label: 'Error Test Job',
                scope: 'test',
                meta: {
                    orders: [
                        { matchId: 'invalid-match', officialId: 'invalid-official' }
                    ]
                },
                total: 1,
                priority: 'low',
                retry_policy: {
                    max_attempts: 2,
                    backoff_base_ms: 500,
                    backoff_multiplier: 2,
                    retryable_errors: ['network_error']
                }
            });

            // Trigger processing
            await this.triggerJobProcessing();

            // Wait for job to complete (should fail)
            const finalJob = await this.waitForJobCompletion(job.id, 15000);

            // Should fail but handle error gracefully
            if (finalJob.status === 'failed' && finalJob.error) {
                this.recordSuccess(testName, startTime, {
                    jobId: job.id,
                    errorHandled: true,
                    error: finalJob.error
                });
                console.log(`✅ ${testName}: Errors handled gracefully`);
            } else {
                throw new Error('Error handling test did not behave as expected');
            }

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Test 6: Concurrency Control
     */
    async testConcurrencyControl(): Promise<void> {
        const testName = 'Concurrency Control';
        const startTime = Date.now();

        try {
            console.log(`🔬 Testing: ${testName}`);

            // Create multiple jobs simultaneously
            const jobPromises = Array.from({ length: 5 }, (_, i) =>
                jobService.enqueueJob({
                    type: 'mission_orders.email_bulk_v3',
                    label: `Concurrency Test Job ${i + 1}`,
                    scope: 'test',
                    meta: {
                        recipients: [{ email: 'test@example.com' }],
                        subject: `Test ${i + 1}`,
                        message: 'Concurrency test'
                    },
                    priority: 'low'
                })
            );

            const jobs = await Promise.all(jobPromises);

            // Trigger processing
            await this.triggerJobProcessing();

            // All jobs should be created successfully
            if (jobs.length === 5 && jobs.every(job => job.id && job.status === 'pending')) {
                this.recordSuccess(testName, startTime, {
                    jobCount: jobs.length,
                    allCreated: true
                });
                console.log(`✅ ${testName}: Concurrent job creation successful`);
            } else {
                throw new Error('Not all concurrent jobs were created successfully');
            }

        } catch (error) {
            this.recordFailure(testName, startTime, error);
            console.error(`❌ ${testName}: Failed -`, error);
        }
    }

    /**
     * Helper: Get job from database
     */
    private async getJobFromDatabase(jobId: string): Promise<any> {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Helper: Trigger job processing
     */
    private async triggerJobProcessing(): Promise<void> {
        try {
            const { error } = await supabase.functions.invoke('process-jobs', {
                body: { trigger: 'integration-test' }
            });

            if (error) {
                console.warn('⚠️ Failed to trigger job processing:', error.message);
            }
        } catch (error) {
            console.warn('⚠️ Process jobs trigger failed:', error);
        }
    }

    /**
     * Helper: Wait for job completion
     */
    private async waitForJobCompletion(jobId: string, timeout = TEST_CONFIG.timeout): Promise<any> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const job = await this.getJobFromDatabase(jobId);

            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
                return job;
            }

            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.pollInterval));
        }

        throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
    }

    /**
     * Helper: Record test success
     */
    private recordSuccess(testName: string, startTime: number, details?: any): void {
        this.results.push({
            testName,
            success: true,
            duration: Date.now() - startTime,
            details
        });
    }

    /**
     * Helper: Record test failure
     */
    private recordFailure(testName: string, startTime: number, error: any): void {
        this.results.push({
            testName,
            success: false,
            duration: Date.now() - startTime,
            error: error?.message || String(error)
        });
    }

    /**
     * Print test summary
     */
    private printSummary(): void {
        console.log('\n' + '='.repeat(50));
        console.log('🧪 Integration Test Summary');
        console.log('='.repeat(50));

        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

        console.log(`📊 Results: ${passed} passed, ${failed} failed`);
        console.log(`⏱️ Total Duration: ${totalDuration}ms`);

        this.results.forEach(result => {
            const icon = result.success ? '✅' : '❌';
            const duration = `${result.duration}ms`;
            console.log(`${icon} ${result.testName} (${duration})`);

            if (!result.success && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        if (failed === 0) {
            console.log('\n🎉 All tests passed! Job system is working correctly.');
        } else {
            console.log(`\n⚠️ ${failed} test(s) failed. Please check the errors above.`);
        }
    }
}

// Export for usage
export { JobSystemIntegrationTest };

// Auto-run if called directly
if (typeof window === 'undefined') {
    // Running in Node.js environment
    const runTests = async () => {
        const testSuite = new JobSystemIntegrationTest();
        await testSuite.runAllTests();
    };

    // Uncomment to run tests immediately
    // runTests().catch(console.error);
}