import { Command } from 'commander';
import readline from 'readline';
import { Peer } from './peer';
import { generateHash } from './identity';
import os from 'os';

const program = new Command();
program.option('-p, --port <port>', 'Specify port number');
program.parse(process.argv);

const options = program.opts();
const port = options.port ? parseInt(options.port) : 10000;

const peer = new Peer(port);

const localHash = generateHash();
const localHostname = os.hostname();
const localIP = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)[0]?.address || 'unknown';

console.log(`Self-peer identity: localhost:${port}/${localHash}`);
console.log(`Self-peer identity: ${localIP}:${port}/${localHash}`);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    if (input.startsWith('connect')) {
        const peerInfo = input.split(' ')[1];
        if (peerInfo) {
            peer.addPeer(peerInfo);
        } else {
            console.log('Invalid input. Please provide peer information in the format: connect host:port/peerHash');
        }
    } else {
        peer.broadcast(input, localHash);
    }
});
