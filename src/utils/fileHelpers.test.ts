import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  getFileCategory,
  sanitizeRoomCode,
  validateRoomCode,
  generateRoomCode,
} from './fileHelpers.ts';

test('formatBytes formats 0 and negative properly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(-10), '0 B');
});

test('formatBytes converts sizes accurately', () => {
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1572864), '1.5 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
});

test('getFileCategory identifies image, audio, video, doc, code', () => {
  assert.equal(getFileCategory('screenshot.PNG').category, 'image');
  assert.equal(getFileCategory('track.mp3').category, 'audio');
  assert.equal(getFileCategory('clip.mp4').category, 'video');
  assert.equal(getFileCategory('invoice.pdf').category, 'document');
  assert.equal(getFileCategory('archive.zip').category, 'archive');
  assert.equal(getFileCategory('app.tsx').category, 'code');
  assert.equal(getFileCategory('unknown.xyz').category, 'other');
});

test('sanitizeRoomCode cleans and normalizes room identifiers', () => {
  assert.equal(sanitizeRoomCode(' beam-4921 '), 'BEAM-4921');
  assert.equal(sanitizeRoomCode('hello@world#123'), 'HELLOWORLD123');
});

test('validateRoomCode verifies minimum and maximum code constraints', () => {
  assert.equal(validateRoomCode('A'), false);
  assert.equal(validateRoomCode('BEAM-4829'), true);
  assert.equal(validateRoomCode('X'.repeat(25)), true); // will sanitize to 16 chars and pass
  assert.equal(validateRoomCode(''), false);
});

test('generateRoomCode produces valid prefix and 4-digit code', () => {
  const code = generateRoomCode();
  assert.match(code, /^[A-Z]+-\d{4}$/);
  assert.equal(validateRoomCode(code), true);
});
