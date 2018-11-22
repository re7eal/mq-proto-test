const crypto = require('crypto');
const zmq = require('zeromq');

const protobuf = require('protobufjs');

const mqMessageProtobufRootInstance = new protobuf.Root();
const root = mqMessageProtobufRootInstance.loadSync('./message.proto', {
  keepCase: true,
});

const MqMessage = root.lookup('MqMessage');
const EncryptedMqMessage = root.lookup('EncryptedMqMessage');
const MqProtocolMessage = root.lookup('MqProtocolMessage');

function extractRetrySpec(message) {
  const decodedMessage = MqProtocolMessage.decode(message);
  return {
    retryspec: {
      msgId: decodedMessage.msg_id.toNumber(),
      seqId: decodedMessage.seq_id,
    },
    message: decodedMessage.message,
    senderId: decodedMessage.sender_id,
  };
}

const dest = {
  ip: process.env.DEST_IP,
  port: process.env.DEST_PORT,
};

const messageInPayloadSize = process.env.MSG_SIZE
  ? parseInt(process.env.MSG_SIZE)
  : 1024;

///////////////////

const payload = {
  // message: Buffer.from('some message'),
  message: crypto.randomBytes(messageInPayloadSize),
  signature: Buffer.from('signature'),
  receiver_node_id: 'none',
  sender_node_id: 'test-mq',
};

const errMsg = MqMessage.verify(payload);
if (errMsg) {
  throw new Error(errMsg);
}

const message = MqMessage.create(payload);

const buffer = MqMessage.encode(message).finish();

console.log('to encrypt:', buffer);

const payload2 = {
  encrypted_symmetric_key: Buffer.from('asdgfdgsdgsd'),
  encrypted_mq_message: buffer,
};
const errMsg2 = EncryptedMqMessage.verify(payload2);
if (errMsg2) {
  throw new Error(errMsg2);
}
const message2 = EncryptedMqMessage.create(payload2);

const buffer2 = EncryptedMqMessage.encode(message2).finish();

console.log('encrypted:', buffer);

let id = Date.now();
let seq = 1;

const payload3 = {
  msg_id: id++,
  seq_id: seq,
  message: buffer2,
  sender_id: 'test-mq',
};

console.log('sending payload:', payload3);

const errMsg3 = MqProtocolMessage.verify(payload3);
if (errMsg3) {
  throw new Error(errMsg);
}

const message3 = MqProtocolMessage.create(payload3);

const buffer3 = MqProtocolMessage.encode(message3).finish();

///////////////////

const sendingSocket = zmq.socket('req');
// socket option
// small lingering time ( 50ms ) after socket close. we want to control send by business logic
sendingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
//not setting means unlimited number of queueing message
//sendingSocket.setsockopt(zmq.ZMQ_HWM, 0);
//ALL in MEMORY --
//sendingSocket.setsockopt(zmq.ZMQ_SWAP, 0);
//no block // wait forever until close
sendingSocket.setsockopt(zmq.ZMQ_RCVTIMEO, 0);
//no block // wait forever until close
sendingSocket.setsockopt(zmq.ZMQ_SNDTIMEO, 0);

sendingSocket.on('error', (err) => {
  console.error('error:', err);
});

sendingSocket.on('message', (messageBuffer) => {
  console.log('incoming message:', messageBuffer);
  console.log('parsed incoming message:', extractRetrySpec(messageBuffer));
});

const destUri = `tcp://${dest.ip}:${dest.port}`;
sendingSocket.connect(destUri);

sendingSocket.send(buffer3);
console.log(
  'sent size:',
  buffer3.length,
  'B',
  buffer3.length / 1024,
  'KB',
  buffer3.length / (1024 * 1024),
  'MB'
);
console.log('sent:', buffer3);
