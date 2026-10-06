'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// Isolate the delete controller from unrelated order configuration and live APIs.
const orderPath = require.resolve('../services/order.service');
require.cache[orderPath] = { id: orderPath, filename: orderPath, loaded: true, exports: {} };
const dropbox = require('../services/dropbox.service');
const { deleteVideo } = require('../controllers/upload.controller');
const payload = {
  video_id: '9007199254740993123', nhms_shop_id: '9007199254740993456',
  record_type: 'raw_video', file_path: '/Apps/NHMS/customer/order/shop/raw.mp4',
  dropbox_file_id: 'id:video'
};
async function invoke(t, body = payload, secret = 'test-secret', metadata = { '.tag': 'file', id: 'id:video' }, result = {}) {
  const originalSecret = process.env.VIDEO_DELETE_WEBHOOK_SECRET;
  const originalMetadata = dropbox.getFileMetadata;
  const originalDelete = dropbox.deleteFile;
  process.env.VIDEO_DELETE_WEBHOOK_SECRET = 'test-secret';
  const calls = [];
  dropbox.getFileMetadata = async path => { calls.push(['metadata', path]); if (metadata instanceof Error) throw metadata; return metadata; };
  dropbox.deleteFile = async path => { calls.push(['delete', path]); return result; };
  t.after(() => {
    dropbox.getFileMetadata = originalMetadata; dropbox.deleteFile = originalDelete;
    if (originalSecret === undefined) delete process.env.VIDEO_DELETE_WEBHOOK_SECRET;
    else process.env.VIDEO_DELETE_WEBHOOK_SECRET = originalSecret;
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await deleteVideo({ body, get: name => { assert.equal(name, 'X-NHMS-Webhook-Secret'); return secret; } }, res);
  return { ...res, calls };
}
test('valid raw delete preserves Snowflake string IDs and deletes verified file ID', async t => {
  const res = await invoke(t);
  assert.equal(res.code, 200); assert.equal(res.body.cleanup_completed, true);
  assert.equal(res.body.already_missing, false);
  assert.equal(res.body.video_id, payload.video_id); assert.equal(typeof res.body.video_id, 'string');
  assert.equal(res.body.nhms_shop_id, payload.nhms_shop_id);
  assert.deepEqual(res.calls, [['metadata', payload.file_path], ['delete', 'id:video']]);
});
test('valid edited delete', async t => {
  const res = await invoke(t, { ...payload, record_type: 'edited_video', file_path: '/Apps/NHMS/customer/order/shop/Edited Videos/final.mp4' });
  assert.equal(res.code, 200); assert.equal(res.body.cleanup_completed, true);
});
for (const [name, secret] of [['missing secret', undefined], ['wrong secret', 'wrong']]) {
  test(name, async t => { const res = await invoke(t, payload, secret === undefined ? null : secret); assert.equal(res.code, 401); assert.deepEqual(res.calls, []); });
}
test('missing file_path', async t => { const res = await invoke(t, { ...payload, file_path: undefined }); assert.equal(res.code, 400); assert.deepEqual(res.calls, []); });
test('already missing at metadata lookup', async t => {
  const error = Object.assign(new Error('missing'), { status: 409, dropboxError: { error_summary: 'path/not_found/' } });
  const res = await invoke(t, payload, 'test-secret', error);
  assert.equal(res.code, 200); assert.equal(res.body.already_missing, true); assert.equal(res.calls.length, 1);
});
test('already missing during delete', async t => {
  const res = await invoke(t, payload, 'test-secret', { '.tag': 'file', id: 'id:video' }, { already_deleted: true });
  assert.equal(res.body.cleanup_completed, true); assert.equal(res.body.already_missing, true);
});
for (const path of ['/', '/Apps', '/Apps/NHMS', '/Apps/NHMS/customer', '/Apps/NHMS/customer/order', '/Apps/NHMS/customer/order/shop', '/Apps/NHMS/customer/order/shop/Edited Videos', '/Apps/NHMS/customer/order/shop/../raw.mp4', '/Apps/NHMS/customer/order/shop/%2e%2e', '/Apps/NHMS/customer/order/shop/raw.mp4/']) {
  test(`reject unsafe path ${path}`, async t => { const res = await invoke(t, { ...payload, file_path: path }); assert.equal(res.code, 400); assert.deepEqual(res.calls, []); });
}
test('folder disguised as a file path is rejected using metadata', async t => {
  const res = await invoke(t, payload, 'test-secret', { '.tag': 'folder', id: 'id:folder' });
  assert.equal(res.code, 400); assert.equal(res.calls.length, 1);
});
for (const patch of [{ video_id: 123 }, { nhms_shop_id: 123 }, { video_id: '' }, { record_type: 'other' }]) {
  test(`invalid payload ${JSON.stringify(patch)}`, async t => { const res = await invoke(t, { ...payload, ...patch }); assert.equal(res.code, 400); assert.deepEqual(res.calls, []); });
}
test('mismatched Dropbox ID cannot delete another file', async t => {
  const res = await invoke(t, payload, 'test-secret', { '.tag': 'file', id: 'id:other' });
  assert.equal(res.code, 400); assert.equal(res.calls.length, 1);
});
test('other metadata failures do not report successful cleanup', async t => {
  const res = await invoke(t, payload, 'test-secret', new Error('network failure'));
  assert.equal(res.code, 500); assert.equal(res.calls.length, 1);
});
