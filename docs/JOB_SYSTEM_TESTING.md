# Job System Testing Guide

This guide explains how to test the consolidated job processing system after the Edge Function consolidation.

## 🧪 Testing Methods

### 1. **Interactive UI Testing** (Recommended)

The easiest way to test the system is through the JobSystemTestPanel component:

#### Usage:
1. Import and add the `JobSystemTestPanel` to your app:
   ```tsx
   import JobSystemTestPanel from './components/JobSystemTestPanel';
   
   // Add to your admin/settings page:
   <JobSystemTestPanel />
   ```

2. The panel provides these test options:
   - **Job Creation**: Tests basic job service functionality
   - **Jobs Table Access**: Verifies database connectivity
   - **Process Jobs Function**: Tests Edge Function deployment
   - **Job Statistics**: Tests job service stats functionality
   - **Bulk PDF Generation**: End-to-end PDF generation test
   - **Bulk Email Sending**: End-to-end email sending test
   - **Run All Tests**: Comprehensive system validation

### 2. **Browser Console Testing**

For quick testing in the browser console:

```javascript
// Import the quick test module (if available)
import { quickJobSystemTest } from './tests/quick-job-test';

// Run all quick tests
await quickJobSystemTest.runAllTests();

// Or run individual tests
await quickJobSystemTest.testJobCreation();
await quickJobSystemTest.testJobsTable();
await quickJobSystemTest.testProcessJobsFunction();
await quickJobSystemTest.testJobStats();
```

### 3. **Manual Database Verification**

Check the jobs table directly:

```sql
-- View recent jobs
SELECT id, type, status, label, created_at, progress, error_message
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check job type distribution
SELECT type, status, COUNT(*) as count
FROM jobs 
GROUP BY type, status
ORDER BY type, status;

-- View job statistics
SELECT 
    status,
    COUNT(*) as total,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM jobs 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;
```

## 📋 Test Scenarios

### **Scenario 1: Basic Job Creation**
**Expected Result**: Job created with `pending` status
**Validates**: jobService.enqueueJob(), database connectivity

### **Scenario 2: Job Processing**
**Expected Result**: Job status changes from `pending` → `processing` → `completed`
**Validates**: process-jobs Edge Function, job handlers

### **Scenario 3: Error Handling**
**Expected Result**: Failed jobs show proper error messages and don't crash system
**Validates**: Error classification, retry logic

### **Scenario 4: Bulk PDF Generation**
**Expected Result**: Multiple mission orders combined into single PDF artifact
**Validates**: PDF generation pipeline, storage integration

### **Scenario 5: Bulk Email Sending** 
**Expected Result**: Emails sent to multiple recipients
**Validates**: Email service integration, SendGrid connectivity

### **Scenario 6: Job Deduplication**
**Expected Result**: Identical jobs return same job ID
**Validates**: Deduplication logic, hash-based job reuse

## 🚨 Troubleshooting

### **Common Issues**

1. **"Job creation failed"**
   - Check database connection
   - Verify user authentication
   - Check job table exists and has correct schema

2. **"Process jobs function failed"**
   - Verify Edge Function is deployed: `supabase functions deploy process-jobs`
   - Check function logs in Supabase Dashboard
   - Ensure environment variables are set

3. **"No jobs found"**
   - Check if jobs table is empty
   - Verify job creation is working first
   - Check table permissions

4. **"Email sending failed"**
   - Verify SendGrid API key is configured
   - Check recipient email addresses are valid
   - Review SendGrid logs

### **Debug Steps**

1. **Check Edge Function Status**:
   ```bash
   supabase functions list
   ```

2. **View Function Logs**:
   Go to Supabase Dashboard → Edge Functions → process-jobs → Logs

3. **Test Function Directly**:
   ```bash
   supabase functions invoke process-jobs --no-verify-jwt
   ```

4. **Check Database Schema**:
   ```sql
   \d jobs  -- PostgreSQL
   ```

## ✅ Expected Test Results

After running all tests, you should see:

- ✅ **Job Creation**: Job created with valid ID and `pending` status
- ✅ **Jobs Table Access**: Returns list of recent jobs
- ✅ **Process Jobs Function**: Function responds (may be empty if no jobs)
- ✅ **Job Statistics**: Returns counts by status
- ✅ **Bulk PDF Generation**: Job created and queued for processing
- ✅ **Bulk Email Sending**: Job created and queued for processing

## 🎯 Performance Benchmarks

**Good Performance Indicators**:
- Job creation: < 500ms
- Job processing: < 30s for bulk operations
- Database queries: < 100ms
- Function invocation: < 2s response time

## 📞 Support

If tests fail consistently:

1. Check the console for detailed error messages
2. Review the job system architecture in the main README
3. Verify all Edge Functions are properly deployed
4. Ensure database schema is up to date
5. Check environment variables and API keys

## 🔄 Integration with Existing Features

The consolidated job system is now used by:
- Mission order bulk PDF generation
- Bulk email sending (messaging system)
- Export job processing
- Match sheet email distribution

Test these features to ensure end-to-end functionality works correctly.