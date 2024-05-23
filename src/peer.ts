import net from 'net';
import { generateHash } from './identity';

export class Peer {
    private port: number;
    private server: net.Server;
    private peers: Map<string, net.Socket>;

    constructor(port: number) {
        this.port = port;
        this.peers = new Map();
        this.server = net.createServer(this.onConnection.bind(this));
        this.server.listen(this.port, () => {
            console.log(`Listening on port ${this.port}`);
        });
    }

    private onConnection(socket: net.Socket): void {
        const peerHash = generateHash();
        this.peers.set(peerHash, socket);

        socket.on('data', (data) => {
            const message = data.toString().trim();
            const [sender, content] = message.split(': ');
            console.log(`\n[${sender}]: ${content}`);
        });

        socket.on('close', () => {
            console.log(`\nPeer disconnected: ${peerHash}`);
            this.peers.delete(peerHash);
        });

        socket.on('error', (error) => {
            console.log(`\nError with peer: ${peerHash} - ${error.message}`);
            this.peers.delete(peerHash);
        });

        console.log(`\nNew peer connected: ${peerHash}`);
    }

    public broadcast(message: string, sender: string): void {
        this.peers.forEach((socket, peerHash) => {
            if (peerHash !== sender) {
                socket.write(`${sender}: ${message}\n`);
            }
        });
    }

    public addPeer(peerInfo: string): void {
        const [peerHash, port] = peerInfo.split(':');
        const peerPort = parseInt(port);
        if (isNaN(peerPort) || peerPort < 0 || peerPort >= 65536) {
            console.log('Invalid port number.');
            return;
        }

        const peerSocket = net.connect({ port: peerPort, host: 'localhost' });

        peerSocket.on('connect', () => {
            console.log(`Connected to peer: ${peerHash}`);
        });

        peerSocket.on('data', (data) => {
            const message = data.toString().trim();
            const [sender, content] = message.split(': ');
            console.log(`\n[${sender}]: ${content}`);
        });

        peerSocket.on('close', () => {
            console.log(`\nPeer disconnected: ${peerHash}`);
            this.peers.delete(peerHash);
        });

        peerSocket.on('error', (error) => {
            console.log(`\nError connecting to peer: ${peerHash} - ${error.message}`);
            this.peers.delete(peerHash);
        });

        this.peers.set(peerHash, peerSocket);
    }
}
