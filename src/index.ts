import { Command } from 'commander';
import * as net from 'net';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { randomBytes } from 'crypto';

const program = new Command();

function generateIdentity(): string {
  return `nlg${randomBytes(20).toString('hex')}`;
}

const identity = generateIdentity();

program
  .option('--port <port>', 'Port to run the server on', '3000')
  .option('--datadir <datadir>', 'Directory containing data to broadcast', './data');

program.parse(process.argv);

const options = program.opts();

const PORT = parseInt(options.port);
const DATA_DIR = options.datadir;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

console.log(`Server running at localhost:${PORT}/${identity}`);

const peers = new Map<string, net.Socket>();

function sendFileList(socket: net.Socket) {
  const files = fs.readdirSync(DATA_DIR);
  const message = `FILELIST ${files.join(' ')}\n`;
  console.log(`Sending file list to peer: ${message}`);
  socket.write(message);
}

function sendFile(socket: net.Socket, fileName: string) {
  const filePath = path.join(DATA_DIR, fileName);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath).toString('base64');
    const message = `DATA ${fileName} ${fileContent}\n`;
    console.log(`Sending file ${fileName} to peer`);
    socket.write(message);
  }
}

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`Received data: ${message}`);
    if (message.startsWith('CONNECT ')) {
      const peerIdentity = message.split(' ')[1].trim();
      peers.set(peerIdentity, socket);
      console.log(`Connected with peer ${peerIdentity}`);
      socket.write(`CONNECTED ${identity}\n`);
      sendFileList(socket); // Send file list on connection
    } else if (message.startsWith('FILELIST ')) {
      const files = message.split(' ').slice(1);
      files.forEach(file => {
        requestFile(socket, file);
      });
    } else if (message.startsWith('DATA ')) {
      const parts = message.split(' ');
      const fileName = parts[1];
      const fileContent = parts.slice(2).join(' ');
      const decodedContent = Buffer.from(fileContent, 'base64');
      console.log(`Received file ${fileName} from peer`);
      fs.writeFileSync(path.join(DATA_DIR, fileName), decodedContent);
    } else if (message.startsWith('REQUESTFILE ')) {
      const fileName = message.split(' ')[1].trim();
      sendFile(socket, fileName);
    }
  });

  socket.on('end', () => {
    for (const [peerIdentity, peerSocket] of peers.entries()) {
      if (peerSocket === socket) {
        peers.delete(peerIdentity);
        console.log(`Disconnected from peer ${peerIdentity}`);
        break;
      }
    }
  });

  socket.on('error', (err) => {
    console.error(`Socket error: ${err.message}`);
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  if (input.startsWith('connect ')) {
    const address = input.split(' ')[1];
    const [host, portAndIdentity] = address.split(':');
    const [port, peerIdentity] = portAndIdentity.split('/');
    const client = net.createConnection({ host, port: parseInt(port) }, () => {
      console.log(`Connecting to ${host}:${port}`);
      client.write(`CONNECT ${identity}\n`);
    });

    client.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`Received from peer: ${message}`);
      if (message.startsWith('CONNECTED ')) {
        console.log(`Connected with peer ${peerIdentity}`);
        peers.set(peerIdentity, client);
        sendFileList(client); // Request file list on connection
      } else if (message.startsWith('FILELIST ')) {
        const files = message.split(' ').slice(1);
        files.forEach(file => {
          requestFile(client, file);
        });
      } else if (message.startsWith('DATA ')) {
        const parts = message.split(' ');
        const fileName = parts[1];
        const fileContent = parts.slice(2).join(' ');
        const decodedContent = Buffer.from(fileContent, 'base64');
        console.log(`Received file ${fileName} from peer`);
        fs.writeFileSync(path.join(DATA_DIR, fileName), decodedContent);
      } else if (message.startsWith('REQUESTFILE ')) {
        const fileName = message.split(' ')[1].trim();
        sendFile(client, fileName);
      }
    });

    client.on('end', () => {
      console.log(`Disconnected from peer ${peerIdentity}`);
      peers.delete(peerIdentity);
    });

    client.on('error', (err) => {
      console.error(`Client error: ${err.message}`);
    });
  }
});

function requestFile(socket: net.Socket, fileName: string) {
  const message = `REQUESTFILE ${fileName}\n`;
  console.log(`Requesting file: ${fileName}`);
  socket.write(message);
}

const watcher = chokidar.watch(DATA_DIR, {
  persistent: true,
  ignoreInitial: true
});

watcher.on('add', (filePath) => {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath).toString('base64');
  console.log(`File added: ${fileName}, broadcasting to peers`);
  for (const socket of peers.values()) {
    const message = `DATA ${fileName} ${fileContent}\n`;
    console.log(`Sending to peer: ${message}`);
    socket.write(message);
  }
});

watcher.on('change', (filePath) => {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath).toString('base64');
  console.log(`File changed: ${fileName}, broadcasting to peers`);
  for (const socket of peers.values()) {
    const message = `DATA ${fileName} ${fileContent}\n`;
    console.log(`Sending to peer: ${message}`);
    socket.write(message);
  }
});

watcher.on('error', (error) => {
  console.error(`Watcher error: ${error.message}`);
});