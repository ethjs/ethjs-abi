const test = require('tape');
const abi = require('../index.js');
const contracts = require('./contracts.json');

test('test basic encoding and decoding functionality', function (t) {
  t.plan(2);

  const BalanceClaimInterface = JSON.parse(contracts.BalanceClaim.interface);
  const encodeBalanceClaimMethod1 = abi.encodeMethod(BalanceClaimInterface[0], []);
  t.equal(encodeBalanceClaimMethod1, '0x30509bca');
  const interface = [{"constant":false,"inputs":[{"name":"_value","type":"uint256"}],"name":"set","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"get","outputs":[{"name":"storeValue","type":"uint256"}],"payable":false,"type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_newValue","type":"uint256"},{"indexed":false,"name":"_sender","type":"address"}],"name":"SetComplete","type":"event"}];

  const setMethodInputBytecode = abi.encodeMethod(interface[0], [24000]);
  const setMethodOutputBytecode = abi.decodeMethod(interface[0], "0x0000000000000000000000000000000000000000000000000000000000000001");

  const getMethodInputBytecode = abi.encodeMethod(interface[1], []);
  const getMethodOutputBytecode = abi.decodeMethod(interface[1], "0x000000000000000000000000000000000000000000000000000000000000b26e");

  const setCompleteEventInputBytecode = abi.encodeEvent(interface[2], [24000, "0xca35b7d915458ef540ade6068dfe2f44e8fa733c"]);
  const setCompleteEventOutputBytecode = abi.decodeEvent(interface[2], "0x0000000000000000000000000000000000000000000000000000000000000d7d000000000000000000000000ca35b7d915458ef540ade6068dfe2f44e8fa733c");

  console.log(setMethodInputBytecode,
    setMethodOutputBytecode,
    getMethodInputBytecode,
    getMethodOutputBytecode,
    setCompleteEventInputBytecode,
    setCompleteEventOutputBytecode);
});
