import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { signUpload } from '../src/media/signature';

// Еталонні приклади з документації Cloudinary (https://cloudinary.com/documentation/authentication_signatures)
describe('signUpload', () => {
  it('лише timestamp', () => {
    assert.equal(signUpload({ timestamp: 1315060510 }, 'abcd'), 'a21ad0f63beb4de2e5575204b79ab90bffb02c10');
  });
  it('кілька параметрів сортуються за назвою, порядок введення не важливий', () => {
    const expected = 'bfd09f95f331f558cbd1320e67aa8d488770583e';
    const params = { timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' };
    assert.equal(signUpload(params, 'abcd'), expected);
    assert.equal(signUpload({ eager: params.eager, public_id: params.public_id, timestamp: params.timestamp }, 'abcd'), expected);
  });
  it('file, cloud_name, resource_type, api_key не входять у підпис', () => {
    assert.equal(
      signUpload({ timestamp: 1315060510, file: 'x', cloud_name: 'c', resource_type: 'image', api_key: 'k' }, 'abcd'),
      'a21ad0f63beb4de2e5575204b79ab90bffb02c10',
    );
  });
  it('інший секрет — інший підпис', () => assert.notEqual(signUpload({ timestamp: 1 }, 'a'), signUpload({ timestamp: 1 }, 'b')));
});
