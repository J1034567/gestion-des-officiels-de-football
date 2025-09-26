/**
 * Quick Manual Test for Job System
 * This file can be imported and run in the browser console or as a test
 */

import { supabase } from '../lib/supabaseClient';
import { jobService } from '../services/jobService';

export const quickJobSystemTest = {

    /**
     * Test 1: Check if job service can create jobs
     */
    async testJobCreation() {
        console.log('🧪 Testing job creation...');

        try {
            const job = await jobService.enqueueJob({
                type: 'mission_orders.email_bulk_v3',
                label: 'Quick Test Job',
                scope: 'test',
                meta: {
                    recipients: [{ email: 'test@example.com', name: 'Test User' }],
                    subject: 'Test Email',
                    message: 'This is a test message',
                    total: 1
                },
                total: 1,
                priority: 'low'
            });

            console.log('✅ Job created successfully:', {
                id: job.id,
                type: job.type,
                status: job.status,
                label: job.label
            });

            return job;

        } catch (error) {
            console.error('❌ Job creation failed:', error);
            throw error;
        }
    },

    /**
     * Test 2: Check jobs table directly
     */
    async testJobsTable() {
        console.log('🧪 Testing jobs table access...');

        try {
            const { data: jobs, error } = await supabase
                .from('jobs')
                .select('id, type, status, created_at, label')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            console.log('✅ Jobs table query successful:', {
                totalJobs: jobs.length,
                recentJobs: jobs
            });

            return jobs;

        } catch (error) {
            console.error('❌ Jobs table query failed:', error);
            throw error;
        }
    },

    /**
     * Test 3: Check Edge Function availability
     */
    async testProcessJobsFunction() {
        console.log('🧪 Testing process-jobs function...');

        try {
            const { data, error } = await supabase.functions.invoke('process-jobs', {
                body: { test: true }
            });

            if (error) {
                console.warn('⚠️ Process jobs function error:', error);
                return { error: error.message, available: false };
            }

            console.log('✅ Process jobs function available:', data);
            return { data, available: true };

        } catch (error) {
            console.error('❌ Process jobs function failed:', error);
            return { error: error.message, available: false };
        }
    },

    /**
     * Test 4: Test job service stats
     */
    async testJobStats() {
        console.log('🧪 Testing job statistics...');

        try {
            const stats = await jobService.getJobStats();

            console.log('✅ Job stats retrieved:', stats);
            return stats;

        } catch (error) {
            console.error('❌ Job stats failed:', error);
            throw error;
        }
    },

    /**
     * Run all quick tests
     */
    async runAllTests() {
        console.log('🚀 Running Quick Job System Tests...');
        console.log('='.repeat(40));

        const results = {
            jobCreation: null,
            jobsTable: null,
            processJobsFunction: null,
            jobStats: null,
            errors: []
        };

        try {
            results.jobCreation = await this.testJobCreation();
        } catch (error) {
            results.errors.push({ test: 'jobCreation', error: error.message });
        }

        try {
            results.jobsTable = await this.testJobsTable();
        } catch (error) {
            results.errors.push({ test: 'jobsTable', error: error.message });
        }

        try {
            results.processJobsFunction = await this.testProcessJobsFunction();
        } catch (error) {
            results.errors.push({ test: 'processJobsFunction', error: error.message });
        }

        try {
            results.jobStats = await this.testJobStats();
        } catch (error) {
            results.errors.push({ test: 'jobStats', error: error.message });
        }

        console.log('\n' + '='.repeat(40));
        console.log('📊 Quick Test Results Summary:');
        console.log('='.repeat(40));

        const successCount = Object.values(results).filter(r => r && typeof r === 'object' && !Array.isArray(r)).length - 1; // Exclude errors array
        const totalTests = 4;

        console.log(`✅ Successful tests: ${totalTests - results.errors.length}/${totalTests}`);
        console.log(`❌ Failed tests: ${results.errors.length}/${totalTests}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Error Details:');
            results.errors.forEach(err => {
                console.log(`  - ${err.test}: ${err.error}`);
            });
        }

        if (results.errors.length === 0) {
            console.log('\n🎉 All quick tests passed! Job system appears to be working.');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above.');
        }

        return results;
    }
};

// For browser console usage
if (typeof window !== 'undefined') {
    (window as any).quickJobSystemTest = quickJobSystemTest;
    console.log('💡 Quick tests available: run quickJobSystemTest.runAllTests() in console');
}