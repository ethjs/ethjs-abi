const rlp = require('rlp');
const BN = require('bn.js');
const sha3 = require('ethjs-sha3');

function defineProperty(object, name, value) {
  Object.defineProperty(object, name, {
    enumerable: true,
    value: value,
  });
}

function getChecksumAddress(address) {
  if (typeof(address) !== 'string' || !address.match(/^0x[0-9A-Fa-f]{40}$/)) {
    throw new Error('invalid address');
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

  if (typeof(address) !== 'string') { throw new Error('invalid address'); }

  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {

    // Missing the 0x prefix
    if (address.substring(0, 2) !== '0x') { address = '0x' + address; }

    result = getChecksumAddress(address);

    // It is a checksummed address with a bad checksum
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      throw new Error('invalid address checksum');
    }

  // Maybe ICAP? (we only support direct mode)
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {

    // It is an ICAP address with a bad checksum
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      throw new Error('invalid address icap checksum');
    }

    result = (new BN(address.substring(4), 36)).toString(16);
    while (result.length < 40) { result = '0' + result; }
    result = getChecksumAddress('0x' + result);

  } else {
    throw new Error('invalid address');
  }

  return result;
}

// See: https://en.wikipedia.org/wiki/International_Bank_Account_Number
var ibanChecksum = (function() {

  // Create lookup table
  var ibanLookup = {};
  for (var i = 0; i < 10; i++) { ibanLookup[String(i)] = String(i); }
  for (var i = 0; i < 26; i++) { ibanLookup[String.fromCharCode(65 + i)] = String(10 + i); }

  // How many decimal digits can we process? (for 64-bit float, this is 15)
  var safeDigits = Math.floor(Math.log10(Number.MAX_SAFE_INTEGER));

  return function(address) {
    address = address.toUpperCase();
    address = address.substring(4) + address.substring(0, 2) + '00';

    var expanded = address.split('');
    for (var i = 0; i < expanded.length; i++) {
      expanded[i] = ibanLookup[expanded[i]];
    }
    expanded = expanded.join('');

    // Javascript can handle integers safely up to 15 (decimal) digits
    while (expanded.length >= safeDigits){
      var block = expanded.substring(0, safeDigits);
      expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
    }

    var checksum = String(98 - (parseInt(expanded, 10) % 97));
    while (checksum.length < 2) { checksum = '0' + checksum; }

    return checksum;
  };
})();


function getIcapAddress(address) {
  address = getAddress(address).substring(2);
  var base36 = (new BN(address, 16)).toString(36).toUpperCase();
  while (base36.length < 30) { base36 = '0' + base36; }
  return 'XE' + ibanChecksum('XE00' + base36) + base36;
}

// http://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
function getContractAddress(transaction) {
  return getAddress('0x' + sha3(rlp.encode([
    hexOrBuffer(getAddress(transaction.from)),
    hexOrBuffer(hexlify(transaction.nonce, 'nonce'))
  ]), true).slice(12).toString('hex'));
}

function cloneObject(object) {
  var clone = {};
  for (var key in object) { clone[key] = object[key]; }
  return clone;
}

function stripZeros(buffer) {
  var i = 0;
  for (i = 0; i < buffer.length; i++) {
    if (buffer[i] !== 0) { break; }
  }
  return (i > 0) ? buffer.slice(i): buffer;
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
      var error = new Error(name ? ('invalid ' + name) : 'invalid hex or buffer');
      error.reason = 'invalid hex string';
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
  throw new Error('invalid value');
}


// Creates property that is immutable
function defineFrozen(object, name, value) {
  var frozen = JSON.stringify(value);
  Object.defineProperty(object, name, {
    enumerable: true,
    get: function() { return JSON.parse(frozen); }
  });
}

// getKeys([{a: 1, b: 2}, {a: 3, b: 4}], 'a') => [1, 3]
function getKeys(params, key, allowEmpty) {
  if (!Array.isArray(params)) { throw new Error('invalid params'); }

  var result = [];

  for (var i = 0; i < params.length; i++) {
    var value = params[i][key];
    if (allowEmpty && !value) {
      value = '';
    } else if (typeof(value) !== 'string') {
      throw new Error('invalid abi');
    }
    result.push(value);
  }

  return result;
}

// Convert the value from a Number to a BN (if necessary)
function numberOrBN(value) {
  if (!value.eq) {
    if (typeof(value) !== 'number') {
      throw new Error('invalid number');
    }
    value = new BN(value);
  }
  return value;
}

function zpad(buffer, length) {
  var zero = new Buffer([0]);
  while (buffer.length < length) {
    buffer = Buffer.concat([zero, buffer]);
  }
  return buffer;
}

function coderNumber(size, signed) {
    return {
        encode: function(value) {
          value = numberOrBN(value)
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
            value: value,
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
      if (length === 32) { return value; }

      var result = new Buffer(32);
      result.fill(0);
      value.copy(result);
      return result;
    },
    decode: function(data, offset) {
      if (data.length < offset + 32) { throw new Error('invalid bytes' + length); }

      return {
        consumed: 32,
        value: '0x' + data.slice(offset, offset + length).toString('hex')
      }
    }
  };
}

var coderAddress = {
  encode: function(value) {
    if (!isHexString(value, 20)) { throw new Error('invalid address'); }
    value = hexOrBuffer(value);
    var result = new Buffer(32);
    result.fill(0);
    value.copy(result, 12);
    return result;
  },
  decode: function(data, offset) {
    if (data.length < offset + 32) { throw new Error('invalid address'); }
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
  if (data.length < offset + 32) { throw new Error('invalid bytes'); }

  var length = uint256Coder.decode(data, offset).value;
  length = length.toNumber();
  if (data.length < offset + 32 + length) { throw new Error('invalid bytes'); }

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
      if (!Array.isArray(value)) { throw new Error('invalid array'); }

      var result = new Buffer(0);
      if (length === -1) {
        length = value.length;
        result = uint256Coder.encode(length);
      }

      if (length !== value.length) { throw new Error('size mismatch'); }

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
  var coder = null;
  while (type) {
    var part = type.match(paramTypePart);
    if (!part) { throw new Error('invalid type: ' + type); }
    type = type.substring(part[0].length);

    var prefix = (part[2] || part[4] || part[5]);
    switch (prefix) {
      case 'int': case 'uint':
        if (coder) { throw new Error('invalid type ' + type); }
        var size = parseInt(part[3] || 256);
        if (size === 0 || size > 256 || (size % 8) !== 0) {
            throw new Error('invalid type ' + type);
        }
        coder = coderNumber(size / 8, (prefix === 'int'));
        break;

      case 'bool':
        if (coder) { throw new Error('invalid type ' + type); }
        coder = coderBoolean;
        break;

      case 'string':
        if (coder) { throw new Error('invalid type ' + type); }
        coder = coderString;
        break;

      case 'bytes':
        if (coder) { throw new Error('invalid type ' + type); }
        if (part[3]) {
          var size = parseInt(part[3]);
          if (size === 0 || size > 32) {
              throw new Error('invalid type ' + type);
          }
          coder = coderFixedBytes(size);
        } else {
          coder = coderDynamicBytes;
        }
        break;

      case 'address':
        if (coder) { throw new Error('invalid type '  + type); }
        coder = coderAddress;
        break;

      case '[]':
        if (!coder || coder.dynamic) { throw new Error('invalid type ' + type); }
        coder = coderArray(coder, -1);
        break;

      // "[0-9+]"
      default:
        if (!coder || coder.dynamic) { throw new Error('invalid type ' + type); }
        var size = parseInt(part[6]);
        coder = coderArray(coder, size);
    }
  }

  if (!coder) { throw new Error('invalid type'); }
  return coder;
}

module.exports = {
  BN,
  defineProperty,
  getAddress,
  getIcapAddress,
  getContractAddress,
  cloneObject,
  bnToBuffer,
  isHexString,
  hexOrBuffer,
  hexlify,
  stripZeros,

  sha3: sha3,

  defineFrozen,
  getKeys,
  numberOrBN,
  zpad,
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
