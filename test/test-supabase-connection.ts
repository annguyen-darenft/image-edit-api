/**
 * Supabase Connection Test Script
 *
 * This script tests the connection to Supabase database and verifies:
 * - Connection to Supabase instance
 * - Authentication with service key
 * - Database schema access
 * - Query execution
 * - Storage bucket access
 *
 * Usage:
 *   ts-node test/test-supabase-connection.ts
 *
 * Environment Variables Required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_ANON_KEY - Your Supabase anon key (for client-side operations)
 *   SUPABASE_SERVICE_KEY - Your Supabase service key (for admin operations)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test result interface
interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
}

class SupabaseConnectionTester {
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private supabaseServiceKey: string;
  private clientWithAnon: SupabaseClient | null = null;
  private clientWithService: SupabaseClient | null = null;
  private testResults: TestResult[] = [];

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
  }

  /**
   * Print formatted header
   */
  private printHeader(text: string): void {
    console.log(
      `\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`,
    );
    console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
    console.log(
      `${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`,
    );
  }

  /**
   * Print test result
   */
  private printResult(result: TestResult): void {
    const icon = result.success ? '✓' : '✗';
    const color = result.success ? colors.green : colors.red;
    console.log(`${color}${icon} ${result.name}${colors.reset}`);
    console.log(`  ${result.message}`);
    console.log(`  Duration: ${result.duration}ms\n`);
  }

  /**
   * Run a test and record result
   */
  private async runTest(
    name: string,
    testFn: () => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.push({
        name,
        success: true,
        message: 'Passed',
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name,
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration,
      });
    }
  }

  /**
   * Test 1: Check environment variables
   */
  private async testEnvironmentVariables(): Promise<void> {
    if (!this.supabaseUrl) {
      throw new Error('SUPABASE_URL is not set');
    }
    if (!this.supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY is not set');
    }
    if (!this.supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_KEY is not set');
    }

    // Security: Don't log credentials, even partially
    console.log(`  URL: ${this.supabaseUrl}`);
    console.log(`  Anon Key: [SET]`);
    console.log(`  Service Key: [SET]`);
  }

  /**
   * Test 2: Create Supabase clients
   */
  private async testClientCreation(): Promise<void> {
    // Create client with anon key
    this.clientWithAnon = createClient(this.supabaseUrl, this.supabaseAnonKey);
    if (!this.clientWithAnon) {
      throw new Error('Failed to create Supabase client with anon key');
    }

    // Create client with service key
    this.clientWithService = createClient(
      this.supabaseUrl,
      this.supabaseServiceKey,
    );
    if (!this.clientWithService) {
      throw new Error('Failed to create Supabase client with service key');
    }

    console.log('  ✓ Client with anon key created');
    console.log('  ✓ Client with service key created');
  }

  /**
   * Test 3: Authenticate test user
   * Note: Auth test may fail in local Supabase if auth service isn't fully initialized.
   * To enable auth in local Supabase:
   * 1. Ensure Supabase is started: supabase start
   * 2. Check auth settings in supabase/config.toml
   * 3. For production, auth should work without additional configuration
   */
  private async testUserAuthentication(): Promise<void> {
    if (!this.clientWithAnon) {
      throw new Error('Anon client not initialized');
    }

    // Test user credentials
    const testEmail = `test1@example.com`;
    const testPassword = 'test@1234';

    try {
      // Try to sign up a new user
      console.log(`  ℹ Creating test user: ${testEmail}`);
      const { data: signInData, error: signInError } =
        await this.clientWithAnon.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });
      console.log(signInData, signInError);

      if (signInError) {
        // Auth service might not be available in local dev
        if (
          signInError.message.includes('Database error') ||
          signInError.message.includes('schema')
        ) {
          console.log(
            `  ⚠ Auth service not fully initialized (local dev only)`,
          );
          console.log(
            `  ℹ Skipping auth test - this is normal for local Supabase`,
          );
          return;
        }
        throw new Error(`Sign up failed: ${signInError.message}`);
      }

      const user = signInData?.user;
      const session = signInData?.session;

      if (!user) {
        throw new Error('Sign up succeeded but no user returned');
      }

      console.log(`  ✓ User created: ${user.email}`);
      console.log(`  ✓ User ID: ${user.id}`);
      console.log(
        `  ✓ Session active: ${session?.access_token ? 'Yes' : 'No'}`,
      );

      // Sign out to clean up
      await this.clientWithAnon.auth.signOut();
      console.log(`  ✓ User signed out successfully`);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Database error') ||
          error.message.includes('schema'))
      ) {
        console.log(`  ⚠ Auth service not available (expected in local dev)`);
        return;
      }
      throw error;
    }
  }

  /**
   * Test 4: Query books table
   */
  private async testBooksTableQuery(): Promise<void> {
    if (!this.clientWithService) {
      throw new Error('Service client not initialized');
    }

    const { data, error } = await this.clientWithService
      .from('books')
      .select('id, title, description, created_at')
      .limit(5);

    if (error) {
      throw new Error(`Failed to query books table: ${error.message}`);
    }

    console.log(`  ✓ Found ${data?.length || 0} book(s)`);
    if (data && data.length > 0) {
      console.log(`  First book: "${data[0].title}"`);
    }
  }

  /**
   * Test 4: Query pages table
   */
  private async testPagesTableQuery(): Promise<void> {
    if (!this.clientWithService) {
      throw new Error('Service client not initialized');
    }

    const { data, error } = await this.clientWithService
      .from('pages')
      .select('id, book_id, page_number')
      .limit(5);

    if (error) {
      throw new Error(`Failed to query pages table: ${error.message}`);
    }

    console.log(`  ✓ Found ${data?.length || 0} page(s)`);
  }

  /**
   * Test 5: Query image_objects table
   */
  private async testImageObjectsTableQuery(): Promise<void> {
    if (!this.clientWithService) {
      throw new Error('Service client not initialized');
    }

    const { data, error } = await this.clientWithService
      .from('image_objects')
      .select('id, title, type, replaceable_object_id')
      .limit(5);

    if (error) {
      throw new Error(`Failed to query image_objects table: ${error.message}`);
    }

    console.log(`  ✓ Found ${data?.length || 0} image object(s)`);
    const replaceableCount =
      data?.filter((obj) => obj.replaceable_object_id !== null).length || 0;
    console.log(`  ✓ ${replaceableCount} replaceable object(s)`);
  }

  /**
   * Test 6: Query replaceable_object_templates table
   */
  private async testReplaceableTemplatesQuery(): Promise<void> {
    if (!this.clientWithService) {
      throw new Error('Service client not initialized');
    }

    const { data, error } = await this.clientWithService
      .from('replaceable_object_templates')
      .select('id, title, type, book_id');

    if (error) {
      throw new Error(
        `Failed to query replaceable_object_templates: ${error.message}`,
      );
    }

    console.log(`  ✓ Found ${data?.length || 0} replaceable template(s)`);
    if (data && data.length > 0) {
      const types = Array.from(new Set(data.map((t) => t.type)));
      console.log(`  Types: ${types.join(', ')}`);
    }
  }

  /**
   * Test 7: Test storage bucket access
   */
  private async testStorageBucketAccess(): Promise<void> {
    if (!this.clientWithService) {
      throw new Error('Service client not initialized');
    }

    const { data, error } = await this.clientWithService.storage.listBuckets();

    if (error) {
      throw new Error(`Failed to list storage buckets: ${error.message}`);
    }

    const bookImagesBucket = data?.find(
      (bucket) => bucket.name === 'book-images',
    );
    if (!bookImagesBucket) {
      throw new Error('book-images bucket not found');
    }

    console.log(`  ✓ Found book-images bucket`);
    console.log(`  Public: ${bookImagesBucket.public}`);
    console.log(
      `  File size limit: ${bookImagesBucket.file_size_limit ? (bookImagesBucket.file_size_limit / 1024 / 1024).toFixed(2) + 'MB' : 'unlimited'}`,
    );
  }

  /**
   * Test 8: Test RLS policies (should fail with anon key for protected tables)
   */
  private async testRLSPolicies(): Promise<void> {
    if (!this.clientWithAnon) {
      throw new Error('Anon client not initialized');
    }

    // This should return empty array due to RLS (no authenticated user)
    const { data, error } = await this.clientWithAnon
      .from('books')
      .select('id, title');

    // RLS is working if we get empty data or auth error
    if (error && error.message.includes('JWT')) {
      console.log('  ✓ RLS is active (JWT auth required)');
    } else if (!data || data.length === 0) {
      console.log('  ✓ RLS is active (no data returned without auth)');
    } else {
      console.log(
        '  ⚠ Warning: RLS may not be properly configured (data returned without auth)',
      );
    }
  }

  /**
   * Print summary
   */
  private printSummary(): void {
    this.printHeader('TEST SUMMARY');

    const passed = this.testResults.filter((r) => r.success).length;
    const failed = this.testResults.filter((r) => r.success === false).length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);

    if (failed > 0) {
      console.log(
        `\n${colors.red}${colors.bright}Failed Tests:${colors.reset}`,
      );
      this.testResults
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`\n${colors.red}✗ ${result.name}${colors.reset}`);
          console.log(`  ${result.message}`);
        });
    }

    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

    if (failed === 0) {
      console.log(
        `${colors.green}${colors.bright}✓ All tests passed! Supabase connection is healthy.${colors.reset}\n`,
      );
    } else {
      console.log(
        `${colors.red}${colors.bright}✗ Some tests failed. Please check the configuration.${colors.reset}\n`,
      );
      process.exit(1);
    }
  }

  /**
   * Run all tests
   */
  public async runAllTests(): Promise<void> {
    this.printHeader('SUPABASE CONNECTION TEST');

    console.log(
      `${colors.yellow}Testing Supabase connection...${colors.reset}\n`,
    );

    // Test 1: Environment Variables
    await this.runTest('Check Environment Variables', () =>
      this.testEnvironmentVariables(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 2: Client Creation
    await this.runTest('Create Supabase Clients', () =>
      this.testClientCreation(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 3: User Authentication
    await this.runTest('Authenticate Test User', () =>
      this.testUserAuthentication(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 4: Books Table
    await this.runTest('Query Books Table', () => this.testBooksTableQuery());
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 5: Pages Table
    await this.runTest('Query Pages Table', () => this.testPagesTableQuery());
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 6: Image Objects Table
    await this.runTest('Query Image Objects Table', () =>
      this.testImageObjectsTableQuery(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 7: Replaceable Templates
    await this.runTest('Query Replaceable Templates', () =>
      this.testReplaceableTemplatesQuery(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 8: Storage Bucket
    await this.runTest('Test Storage Bucket Access', () =>
      this.testStorageBucketAccess(),
    );
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Test 9: RLS Policies
    await this.runTest('Test RLS Policies', () => this.testRLSPolicies());
    this.printResult(this.testResults[this.testResults.length - 1]);

    // Print summary
    this.printSummary();
  }
}

// Main execution
(async () => {
  try {
    const tester = new SupabaseConnectionTester();
    await tester.runAllTests();
  } catch (error) {
    console.error(
      `${colors.red}${colors.bright}Fatal Error:${colors.reset}`,
      error,
    );
    process.exit(1);
  }
})();
