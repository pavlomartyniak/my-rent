import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeTarget, envFilePaths, resolveAppEnv } from '../src/config/env-files';

describe('resolveAppEnv', () => {
  it('явний APP_ENV має пріоритет', () => {
    assert.equal(resolveAppEnv({ APP_ENV: 'production' }), 'production');
    assert.equal(resolveAppEnv({ APP_ENV: 'development', RENDER: 'true' }), 'development');
  });
  it('без APP_ENV: на Render production, локально development', () => {
    assert.equal(resolveAppEnv({ RENDER: 'true' }), 'production');
    assert.equal(resolveAppEnv({}), 'development');
  });
  it('невідоме значення — помилка', () => {
    assert.throws(() => resolveAppEnv({ APP_ENV: 'prod' }), /APP_ENV/);
    assert.throws(() => resolveAppEnv({ APP_ENV: 'staging' }), /staging/);
  });
});

describe('envFilePaths', () => {
  it('для кожного середовища свій файл і його локальне перевизначення, без спільного .env', () => {
    assert.deepEqual(envFilePaths('development'), ['.env.development.local', '.env.development']);
    assert.deepEqual(envFilePaths('production'), ['.env.production.local', '.env.production']);
    assert.ok(!envFilePaths('production').includes('.env'));
  });
});

describe('describeTarget', () => {
  it('показує лише назву бази, без рядка підключення', () => {
    const text = describeTarget({ MONGODB_DB: 'kolo-prod', MONGODB_URI: 'mongodb+srv://user:secret@host/' });
    assert.equal(text, 'база «kolo-prod»');
    assert.ok(!text.includes('secret'));
  });
});
