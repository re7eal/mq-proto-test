const zmq = require('zeromq');

const protobuf = require('protobufjs');

const mqMessageProtobufRootInstance = new protobuf.Root();
const root = mqMessageProtobufRootInstance.loadSync(
  './message.proto',
  { keepCase: true }
);

const dest = {
  ip: process.env.DEST_IP,
  port: process.env.DEST_PORT,
};

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

const destUri = `tcp://${dest.ip}:${dest.port}`;
sendingSocket.connect(destUri);

///////////////////

const EncryptedMqMessage = root.lookup('EncryptedMqMessage');
const payload2 = {
  encrypted_symmetric_key: Buffer.from('asdgfdgsdgsd'),
  encrypted_mq_message: Buffer.from('1242asfasfasfasfwqrqwr'),
};
const errMsg2 = EncryptedMqMessage.verify(payload2);
if (errMsg2) {
  throw new Error(errMsg2);
}
const message2 = EncryptedMqMessage.create(payload2);

const buffer2 = EncryptedMqMessage.encode(message2).finish();

///////////////////

sendingSocket.send(buffer2);