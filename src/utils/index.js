/* eslint-disable */

const rlp = require('rlp');
const BN = require('bn.js');
const BigNumber = require('bignumber.js');
const sha3 = require('ethjs-sha3');
const utils = require('ethjs-util');

function getChecksumAddress(address) {
  if (typeof(address) !== 'string' || !address.match(/^0x[0-9A-Fa-f]{40}$/)) {
    throw new Error(`[ethjs-abi] invalid address value ${JSON.stringify(address)} not a valid hex string`);
  }

  address = address.substring(2).toLowerCase();
  var hashed = sha3(address, true);

  address = address.split('');
  for (var i = 0; i < 40; i += 2) {
    if ((hashed[i >> 1] >> 4) >= 8) {
      address[i] = address[i].toUpperCase();
    }
    if ((hashed[i >> 1] & 0x0f) >= 8) {
      address[i + 1] = address[i + 1].toUpperCase();
    }
  }

  return '0x' + address.join('');
}

function getAddress(address) {
  var result = null;

  if (typeof(address) !== 'string') { throw new Error(`[ethjs-abi] invalid address value ${JSON.stringify(address)} not a valid hex string`); }

  // Missing the 0x prefix
  if (address.substring(0, 2) !== '0x' &&
      address.substring(0, 2) !== 'XE') { address = '0x' + address; }

  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {

    result = getChecksumAddress(address);

    // It is a checksummed address with a bad checksum
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      throw new Error('invalid address checksum');
    }

  // Maybe ICAP? (we only support direct mode)
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {

    throw new Error('[ethjs-abi] ICAP and IBAN addresses, not supported yet..')

    /*
    // It is an ICAP address with a bad checksum
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      throw new Error('invalid address icap checksum');
    }

    result = (new BN(address.substring(4), 36)).toString(16);
    while (result.length < 40) { result = '0' + result; }
    result = getChecksumAddress('0x' + result);
    */
  } else {
    throw new Error(`[ethjs-abi] invalid address value ${JSON.stringify(address)} not a valid hex string`);
  }

  return result;
}

// from ethereumjs-util
function stripZeros(a) {
  var first = a[0];
  while (a.length > 0 && first.toString() === '0') {
    a = a.slice(1);
    first = a[0];
  }
  return a;
}

function bnToBuffer(bn) {
  var hex = bn.toString(16);
  if (hex.length % 2) { hex = '0' + hex; }
  return stripZeros(new Buffer(hex, 'hex'));
}

function isHexString(value, length) {
  if (typeof(value) !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) { return false; }
  return true;
}

function hexOrBuffer(value, name) {
  if (!Buffer.isBuffer(value)) {
    if (!isHexString(value)) {
      var error = new Error(name ? ('[ethjs-abi] invalid ' + name) : '[ethjs-abi] invalid hex or buffer, must be a prefixed alphanumeric even length hex string');
      error.reason = '[ethjs-abi] invalid hex string, hex must be prefixed and alphanumeric (e.g. 0x023..)';
      error.value = value;
      throw error;
    }

    value = value.substring(2);
    if (value.length % 2) { value = '0' + value; }
    value = new Buffer(value, 'hex');
  }

  return value;
}

function hexlify(value, name) {
  if (typeof(value) === 'number') {
    return '0x' + bnToBuffer(new BN(value)).toString('hex');
  } else if (value.mod || value.modulo) {
    return '0x' + bnToBuffer(value).toString('hex');
  } else {
    return '0x' + hexOrBuffer(value).toString('hex');
  }
}

// getKeys([{a: 1, b: 2}, {a: 3, b: 4}], 'a') => [1, 3]
function getKeys(params, key, allowEmpty) {
  if (!Array.isArray(params)) { throw new Error(`[ethjs-abi] while getting keys, invalid params value ${JSON.stringify(params)}`); }

  var result = [];

  for (var i = 0; i < params.length; i++) {
    var value = params[i][key];
    if (allowEmpty && !value) {
      value = '';
    } else if (typeof(value) !== 'string') {
      throw new Error('[ethjs-abi] while getKeys found invalid ABI data structure, type value not string');
    }
    result.push(value);
  }

  return result;
}

// from ethereumjs-util
function numberOrBN(arg) {
  var type = typeof arg;
  if (type === 'string' && arg.indexOf('.') === -1) {
    if (utils.isHexPrefixed(arg)) {
      return new BN(utils.stripHexPrefix(arg), 16);
    } else {
      return new BN(arg, 10);
    }
  } else if (type === 'number') {
    return new BN(arg);
  } else if (type === 'object'
    && !Array.isArray(arg)) {
    if (arg.toString(10).indexOf('.') === -1) {
      if (arg.toArray && arg.toTwos) {
        return arg;
      } else {
        return new BN(arg.toString(10)); // if BigNumber object
      }
    } else {
      throw new Error(`[ethjs-abi] while converting number to BN.js object, argument ${JSON.stringify(arg)} is not a valid number (hex or otherwise) while converting with numberOrBN method, value contains decimals (float value). Decimals are not supported.`);
    }
  } else {
    throw new Error(`[ethjs-abi] while converting number to BN.js object, argument ${JSON.stringify(arg)} is not a valid number (hex or otherwise) while converting with numberOrBN method`);
  }
}

function coderNumber(size, signed) {
    return {
        encode: function(value) {
          value = numberOrBN(value);
          value = value.toTwos(size * 8).maskn(size * 8);
          if (signed) {
            value = value.fromTwos(size * 8).toTwos(256);
          }
          return value.toArrayLike(Buffer, 'be', 32);
        },
        decode: function(data, offset) {
          var junkLength = 32 - size;
          var value = new BN(data.slice(offset + junkLength, offset + 32));
          if (signed) {
            value = value.fromTwos(size * 8);
          } else {
            value = value.maskn(size * 8);
          }
          return {
            consumed: 32,
            value: new BigNumber(value.toString(10)),
          }
        }
    };
}
var uint256Coder = coderNumber(32, false);

var coderBoolean = {
  encode: function(value) {
    return uint256Coder.encode(value ? 1: 0);
  },
  decode: function(data, offset) {
    var result = uint256Coder.decode(data, offset);
    return {
      consumed: result.consumed,
      value: !result.value.isZero()
    }
  }
}

function coderFixedBytes(length) {
  return {
    encode: function(value) {
      value = hexOrBuffer(value);

      if (value.length === 32) { return value; }

      var result = new Buffer(32);
      result.fill(0);
      value.copy(result);
      return result;
    },
    decode: function(data, offset) {
      if (data.length < offset + 32) { throw new Error('[ethjs-abi] while decoding fixed bytes, invalid bytes data length: ' + length); }

      return {
        consumed: 32,
        value: '0x' + data.slice(offset, offset + length).toString('hex')
      }
    }
  };
}

var coderAddress = {
  encode: function(value) {
    if (!isHexString(value, 20)) { throw new Error('[ethjs-abi] while encoding address, invalid address value, not alphanumeric 20 byte hex string'); }
    value = hexOrBuffer(value);
    var result = new Buffer(32);
    result.fill(0);
    value.copy(result, 12);
    return result;
  },
  decode: function(data, offset) {
    if (data.length < offset + 32) { throw new Error(`[ethjs-abi] while decoding address data, invalid address data, invalid byte length ${data.length}`); }
    return {
      consumed: 32,
      value: '0x' + data.slice(offset + 12, offset + 32).toString('hex')
    }
  }
}

function _encodeDynamicBytes(value) {
  var dataLength = parseInt(32 * Math.ceil(value.length / 32));
  var padding = new Buffer(dataLength - value.length);
  padding.fill(0);

  return Buffer.concat([
    uint256Coder.encode(value.length),
    value,
    padding
  ]);
}

function _decodeDynamicBytes(data, offset) {
  if (data.length < offset + 32) { throw new Error(`[ethjs-abi] while decoding dynamic bytes data, invalid bytes length: ${data.length} should be less than ${offset + 32}`); }

  var length = uint256Coder.decode(data, offset).value;
  length = length.toNumber();
  if (data.length < offset + 32 + length) { throw new Error(`[ethjs-abi] while decoding dynamic bytes data, invalid bytes length: ${data.length} should be less than ${offset + 32 + length}`); }

  return {
    consumed: parseInt(32 + 32 * Math.ceil(length / 32)),
    value: data.slice(offset + 32, offset + 32 + length),
  }
}

var coderDynamicBytes = {
  encode: function(value) {
    return _encodeDynamicBytes(hexOrBuffer(value));
  },
  decode: function(data, offset) {
    var result = _decodeDynamicBytes(data, offset);
    result.value = '0x' + result.value.toString('hex');
    return result;
  },
  dynamic: true
};

var coderString = {
  encode: function(value) {
    return _encodeDynamicBytes(new Buffer(value, 'utf8'));
  },
  decode: function(data, offset) {
    var result = _decodeDynamicBytes(data, offset);
    result.value = result.value.toString('utf8');
    return result;
  },
  dynamic: true
};

function coderArray(coder, length) {
  return {
    encode: function(value) {
      if (!Array.isArray(value)) { throw new Error('[ethjs-abi] while encoding array, invalid array data, not type Object (Array)'); }

      var result = new Buffer(0);
      if (length === -1) {
        length = value.length;
        result = uint256Coder.encode(length);
      }

      if (length !== value.length) { throw new Error(`[ethjs-abi] while encoding array, size mismatch array length ${length} does not equal ${value.length}`); }

      value.forEach(function(value) {
        result = Buffer.concat([
          result,
          coder.encode(value)
        ]);
      });

      return result;
    },
    decode: function(data, offset) {
      // @TODO:
      //if (data.length < offset + length * 32) { throw new Error('invalid array'); }

      var consumed = 0;

      var result;
      if (length === -1) {
         result = uint256Coder.decode(data, offset);
         length = result.value.toNumber();
         consumed += result.consumed;
         offset += result.consumed;
      }

      var value = [];

      for (var i = 0; i < length; i++) {
        var result = coder.decode(data, offset);
        consumed += result.consumed;
        offset += result.consumed;
        value.push(result.value);
      }

      return {
        consumed: consumed,
        value: value,
      }
    },
    dynamic: (length === -1)
  }
}

// Break the type up into [staticType][staticArray]*[dynamicArray]? | [dynamicType] and
// build the coder up from its parts
var paramTypePart = new RegExp(/^((u?int|bytes)([0-9]*)|(address|bool|string)|(\[([0-9]*)\]))/);

function getParamCoder(type) {
  const invalidTypeErrorMessage = `[ethjs-abi] while getting param coder (getParamCoder) type value ${JSON.stringify(type)} is either invalid or unsupported by ethjs-abi.`;
  var coder = null;
  while (type) {
    var part = type.match(paramTypePart);
    if (!part) { throw new Error(invalidTypeErrorMessage); }
    type = type.substring(part[0].length);

    var prefix = (part[2] || part[4] || part[5]);
    switch (prefix) {
      case 'int': case 'uint':
        if (coder) { throw new Error(invalidTypeErrorMessage); }
        var size = parseInt(part[3] || 256);
        if (size === 0 || size > 256 || (size % 8) !== 0) {
            throw new Error(`[ethjs-abi] while getting param coder for type ${type}, invalid ${prefix}<N> width: ${type}`);
        }

        coder = coderNumber(size / 8, (prefix === 'int'));
        break;

      case 'bool':
        if (coder) { throw new Error(invalidTypeError); }
        coder = coderBoolean;
        break;

      case 'string':
        if (coder) { throw new Error(invalidTypeErrorMessage); }
        coder = coderString;
        break;

      case 'bytes':
        if (coder) { throw new Error(invalidTypeErrorMessage); }
        if (part[3]) {
          var size = parseInt(part[3]);
          if (size === 0 || size > 32) {
              throw new Error(`[ethjs-abi] while getting param coder for prefix bytes, invalid type ${type}, size ${size} should be 0 or greater than 32`);
          }
          coder = coderFixedBytes(size);
        } else {
          coder = coderDynamicBytes;
        }
        break;

      case 'address':
        if (coder) { throw new Error(invalidTypeErrorMessage); }
        coder = coderAddress;
        break;

      case '[]':
        if (!coder || coder.dynamic) { throw new Error(invalidTypeErrorMessage); }
        coder = coderArray(coder, -1);
        break;

      // "[0-9+]"
      default:
        if (!coder || coder.dynamic) { throw new Error(invalidTypeErrorMessage); }
        var size = parseInt(part[6]);
        coder = coderArray(coder, size);
    }
  }

  if (!coder) { throw new Error(invalidTypeErrorMessage); }
  return coder;
}

module.exports = {
  BN,
  getAddress,
  getChecksumAddress,
  bnToBuffer,
  isHexString,
  hexOrBuffer,
  hexlify,
  stripZeros,

  sha3: sha3,

  getKeys,
  numberOrBN,
  coderNumber,
  uint256Coder,
  coderBoolean,
  coderFixedBytes,
  coderAddress,
  coderDynamicBytes,
  coderString,
  coderArray,
  paramTypePart,
  getParamCoder,
}
