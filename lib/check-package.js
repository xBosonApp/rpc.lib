var crypto = require('crypto');

var CIPHER_ALOG = 'aes192';
var HASH_ALOG   = 'sha256';
var CODING      = 'base64';
var RANDOM_LEN  = 64;

module.exports = {
  verify,
  generate,
};


//
// 验证 data 是否是用 pass 加密, 并解密后与 hash 相同
// data hash 使用 base64 编码, pass 是明文.
//
function verify(pass, encrypted, hash) {
  var decipher = crypto.createDecipher(CIPHER_ALOG, pass);
  var decrypted = Buffer.concat([
    decipher.update(encrypted, CODING),
    decipher.final()
  ]);

  var sha256 = crypto.createHash(HASH_ALOG);
  sha256.update(decrypted);

  if (sha256.digest(CODING) != hash) {
    throw new Error('bad data, hash wrong');
  }
}


//
// 生成使用 pass 加密的指纹, 结果附加到 obj 上,
// { encrypted: 加密后的数据, hash: 加密前数据的校验 }
//
function generate(pass, obj) {
  var decrypted = crypto.randomBytes(RANDOM_LEN);
  var sha256 = crypto.createHash(HASH_ALOG);
  sha256.update(decrypted);
  obj.hash = sha256.digest(CODING);

  var cipher = crypto.createCipher(CIPHER_ALOG, pass);
  obj.encrypted = cipher.update(decrypted, null, CODING) + cipher.final(CODING);
}
