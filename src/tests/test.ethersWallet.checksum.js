const assert = require('chai').assert;
const utils = require('../utils/index.js');
const ethereumUtil = require('ethereumjs-util');
const crypto = require('crypto');

function randomBuffer(length) {
  const buffer = crypto.randomBytes(length);
  return buffer;
}

function randomHexString(length) {
  return `0x${randomBuffer(length).toString('hex')}`;
}

describe('test checkSum address, and getAddress', () => {
  it('ethers getAddress should equal official toChecksumAddress', () => {
    function testAddress(address) {
      const official = ethereumUtil.toChecksumAddress(address);
      const ethers = utils.getAddress(address);
      assert.equal(ethers, official, 'wrong address');
    }

    testAddress('0x0000000000000000000000000000000000000000');
    testAddress('0xffffffffffffffffffffffffffffffffffffffff');
    for (var i = 0; i < 10000; i++) { // eslint-disable-line
      testAddress(randomHexString(20));
    }
  });

  it('should throw as invalid checksum', () => {
    assert.throw(() => {
      utils.getAddress('sdfjhs992');
    }, Error);
  });

  it('should throw as invalid checksum number', () => {
    assert.throws(() => {
      utils.getAddress(234234234);
    }, Error);
  });

  it('should throw as invalid checksum number', () => {
    assert.throws(() => {
      utils.getChecksumAddress(234234234);
    }, Error);
  });

  it('should throw as invalid checksum number', () => {
    assert.throws(() => {
      utils.getChecksumAddress('sdfk^jsfdkjs9');
    }, Error);
  });

  it('should convert non hexed address', () => {
    assert.equal(utils.getAddress('0000000000000000000000000000000000000000'), '0x0000000000000000000000000000000000000000');
  });

  it('test ICAP', () => {
    assert.equal(utils.getAddress('00c5496aee77c1ba1f0854206a26dda82a81d6d8').toLowerCase(), '0x00c5496aee77c1ba1f0854206a26dda82a81d6d8');
  });

  it('test not supported IBAN/ICAP', () => {
    assert.throws(() => utils.getAddress('XE7338O073KYGTWWZN0F2WZ0R8PX5ZPPZS'), Error);
  });
});
