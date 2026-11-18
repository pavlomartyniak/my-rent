import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkChatFile, ChatFileError, looksExecutable, MAX_CHAT_FILE_BYTES, mimeFor } from '../src/chat/chat-files';

const file = (name: string, body: Buffer | string, size?: number) => {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return { originalname: name, size: size ?? buffer.length, buffer };
};

describe('файли в чаті', () => {
  it('звичайні документи приймаються, тип за розширенням', () => {
    const r = checkChatFile(file('Договір оренди.pdf', '%PDF-1.4 test'));
    assert.deepEqual(r, { name: 'Договір оренди.pdf', mime: 'application/pdf' });
    assert.equal(mimeFor('a.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(mimeFor('a.unknown'), 'application/octet-stream');
  });

  it('програми й скрипти не приймаються: за розширенням і за вмістом', () => {
    assert.throws(() => checkChatFile(file('virus.exe', 'hello')), ChatFileError);
    assert.throws(() => checkChatFile(file('run.sh', 'echo hi')), ChatFileError);
    assert.throws(() => checkChatFile(file('photo.pdf', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))), ChatFileError);
    assert.throws(() => checkChatFile(file('notes.txt', '#!/bin/sh\nrm -rf /')), ChatFileError);
    assert.equal(looksExecutable(Buffer.from('plain text')), false);
  });

  it('порожній і завеликий файл відхиляються', () => {
    assert.throws(() => checkChatFile(undefined), ChatFileError);
    assert.throws(() => checkChatFile(file('a.pdf', '')), ChatFileError);
    assert.throws(() => checkChatFile(file('a.pdf', 'x', MAX_CHAT_FILE_BYTES + 1)), ChatFileError);
  });

  it('назва очищається від шляхів', () => {
    assert.equal(checkChatFile(file('../../etc/passwd.txt', 'data')).name, '.._.._etc_passwd.txt');
  });
});
