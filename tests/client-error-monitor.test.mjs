import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientErrorInput } from '../worker/src/erp.js';

test('client error telemetry redacts personal data and credentials', () => {
  const result = normalizeClientErrorInput({
    error_type: 'javascript_error',
    error_message: 'Failure for user@example.com, phone +505 8888-7777, Bearer super-secret and token=abc123',
    source_file: '/assets/js/app.js?token=private',
    page_path: '/hr?email=user@example.com',
    line_number: 42,
    column_number: 7
  });

  assert.equal(result.error, undefined);
  assert.match(result.value.error_message, /\[email\]/);
  assert.match(result.value.error_message, /\[number\]/);
  assert.match(result.value.error_message, /Bearer \[redacted\]/);
  assert.match(result.value.error_message, /token=\[redacted\]/);
  assert.doesNotMatch(result.value.error_message, /user@example\.com|8888-7777|super-secret|abc123/);
  assert.equal(result.value.source_file, '/assets/js/app.js');
  assert.equal(result.value.page_path, '/hr');
  assert.equal(result.value.line_number, 42);
  assert.equal(result.value.column_number, 7);
});

test('client error telemetry rejects unsupported types and empty messages', () => {
  assert.equal(
    normalizeClientErrorInput({ error_type: 'network_dump', error_message: 'failure' }).error.code,
    'INVALID_CLIENT_ERROR_TYPE'
  );
  assert.equal(
    normalizeClientErrorInput({ error_type: 'javascript_error', error_message: '   ' }).error.code,
    'EMPTY_CLIENT_ERROR'
  );
});

test('client error telemetry bounds message length and rejects invalid source coordinates', () => {
  const result = normalizeClientErrorInput({
    error_type: 'unhandled_rejection',
    error_message: 'x'.repeat(900),
    source_file: '/assets/app.js?source=private',
    page_path: 'not-a-path',
    line_number: 1000001,
    column_number: -2
  });

  assert.equal(result.value.error_message.length, 600);
  assert.equal(result.value.page_path, '/');
  assert.equal(result.value.source_file, '/assets/app.js');
  assert.equal(result.value.line_number, null);
  assert.equal(result.value.column_number, null);
});
