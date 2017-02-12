'use strict';

var io = require('socket.io-client');
var fs = require('fs');
var clientp2p;

const CHUNK_SIZE = 1024*1024; //1Mb
const MAX_CONS = 10; //clientp2p must be configurable
const MAX_CONS_ATTEMPTS = 5;
const CLIENT_DISCONNECTED = 0;
const CLIENT_CONNECTED = 1;
const CLIENT_DOWNLOADING = 2;

class ClientP2P {

    constructor(onCompleteDownloadFilePeer, onErrorConnection, onConnectFilePeer, onCompleteDownload) {
        clientp2p = this;
        clientp2p._state = CLIENT_DISCONNECTED;
        clientp2p._file = {
            id: null,
            name: null,
            hash: null,
            size: null,
            downloading: false
        };
        clientp2p._peers = [];
        clientp2p._chunks = {
            pending: [],
            current: []
        };
        clientp2p._connections = 0;
        clientp2p._timer = null;
        clientp2p._onCompleteDownloadFilePeerEvent = onCompleteDownloadFilePeer;
        clientp2p._onErrorConnectionEvent = onErrorConnection;
        clientp2p._onConnectFilePeerEvent = onConnectFilePeer;
        clientp2p._onCompleteDownloadEvent = onCompleteDownload;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Agrega un nuevo servidor-par */
    addPeer(ip, port) {
        clientp2p._peers.push({
            id: clientp2p._peers.length,
            ip: ip,
            port: port,
            state: 0,
            currentChunk: 0,
            conecctionsAttempts: 0
        });
    }

    /* Obtiene un servidor-par */
    getPeer(id) {
        return clientp2p._peers[id];
    }

    /* Establece el nombre del archivo a solicitar */
    setFile(id, name, hash, size) {
        clientp2p._file.id = id;
        clientp2p._file.name = name;
        clientp2p._file.hash = hash;
        clientp2p._file.size = size;

        var i;
        for(i=0;i < Math.floor(size/CHUNK_SIZE); i++) {
            clientp2p._chunks.pending.push({offset: i*CHUNK_SIZE, size: CHUNK_SIZE, received: false});
        }

        if((size%CHUNK_SIZE) != 0)
            clientp2p._chunks.pending.push({offset: i*CHUNK_SIZE, size: size%CHUNK_SIZE, received: false});
	   //Here is possible shuffle chunks to avoid download contiguous chunks every time
    }

    /* Inicia la descarga del archivo */
    downloadFile() {
        clientp2p._file.downloading = true;
        clientp2p._downloadChunks();
    }

    /* Verifica si el cliente se encuentra haciendo una descarga */
    isClientDownloading() {
      if (clientp2p._state == CLIENT_DOWNLOADING){
        return true;
      }else{
        return false;
      }
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */
    _fileComplete() {
        return ((clientp2p._chunks.pending.length + Object.keys(clientp2p._chunks.current).length) == 0);
    }

    _rollbackChunk(chunk_id) {
        var chunk = clientp2p._chunks.current[chunk_id];
        if(chunk != undefined) {
            chunk = JSON.parse(JSON.stringify(clientp2p._chunks.current[chunk_id]));
            clientp2p._chunks.pending.push(chunk);
            delete clientp2p._chunks.current[chunk_id]
        } else {
            console.log("Error en _rollbackChunk, chunk == undefined");
        }
    }

    _downloadChunks() {
        if(clientp2p._timer)
            clearInterval(clientp2p._timer)
        
        if(clientp2p._file.downloading == false) return false;

        clientp2p._timer = setInterval(clientp2p._downloadChunks, 10000);

        for(var peer_id = 0; peer_id < clientp2p._peers.length; peer_id++) {
            var peer = clientp2p._peers[peer_id];

            if((peer.state == 0) && (clientp2p._chunks.pending.length > 0) && (clientp2p._connections < MAX_CONS)) {
                var chunk = clientp2p._chunks.pending.shift();
                var chunk_id = chunk.offset.toString();

                clientp2p._chunks.current[chunk_id] = chunk;
                clientp2p._downloadChunk(chunk_id, peer_id, peer.ip, peer.port, clientp2p._file.name, chunk.size, chunk.offset);
            }
        };
    }

    _downloadChunk(chunk_id, peer_id) {
        var peer = clientp2p._peers[peer_id];
        var socket = io.connect('http://' + peer.ip + ':' + peer.port, {
            'reconnect': true,
            'reconnection': true,
            'reconnectionDelay': 1000,
            'reconnectionDelayMax' : 5000,
            'reconnectionAttempts': MAX_CONS_ATTEMPTS
        });

        clientp2p._peers[peer_id].state = 1;

        // Detecta la conexión
        socket.on('connect', function() {
            //console.log('Conectado a ' + peer.ip + ':' + peer.port);

            clientp2p._state = CLIENT_CONNECTED;

            clientp2p._connections++;
            clientp2p._peers[peer_id].conecctionsAttempts = 0;
            clientp2p._peers[peer_id].currentChunk = chunk_id;

            if(clientp2p._chunks.current[chunk_id] != undefined)
                clientp2p._onConnectFilePeerEvent(peer, clientp2p._file.hash, clientp2p._file.name, clientp2p._chunks.current[chunk_id]);
        }.bind(clientp2p));

        //Detecta si hubo un error en la conexión
        socket.on('connect_error', function(error) {
            console.log('connect_error');

            clientp2p._peers[peer_id].conecctionsAttempts++;

            if(clientp2p._peers[peer_id].conecctionsAttempts == MAX_CONS_ATTEMPTS) {
                socket.disconnect();
                clientp2p._rollbackChunk(chunk_id);
                //clientp2p._peers.splice(peer_id, 1);

                console.log('Deshabilitando par ' + peer.ip + ":" + peer.port);
            }

            //clientp2p._onErrorConnectionEvent(peer, clientp2p._file.id);
            clientp2p._downloadChunks();
        }.bind(clientp2p));

        // Detecta la desconexión
        socket.on('disconnect', function() {
            clientp2p._connections--;
            clientp2p._peers[peer_id].state = 0;

            var chunk = clientp2p._chunks.current[chunk_id];
            if(chunk && (chunk.received == false)) {
                clientp2p._rollbackChunk(chunk_id);
                clientp2p._onErrorConnectionEvent(peer, clientp2p._file.id);
            }

            clientp2p._downloadChunks();
        }.bind(clientp2p));

        socket.emit('getfile', {
            file: clientp2p._file.name,
            size: clientp2p._chunks.current[chunk_id].size,
            offset: clientp2p._chunks.current[chunk_id].offset
        });

        //console.log('Se solicitó ' + clientp2p._file.name + "[" + clientp2p._chunks.current[chunk_id].offset + ":" + (clientp2p._chunks.current[chunk_id].offset + clientp2p._chunks.current[chunk_id].size) + "]");

        socket.on("sendfile", function(info) {
            clientp2p._onCompleteDownloadFilePeer(peer_id, info);
            socket.disconnect();
        }.bind(clientp2p));
    }

    /* Método que se ejecuta cuando se finaliza la descarga de uno de los pares */
    _onCompleteDownloadFilePeer(peer_id, info) {
        var chunk_id = info.offset.toString();

        clientp2p._state = CLIENT_DOWNLOADING;

        clientp2p._peers[peer_id].state = 0;
        if(clientp2p._chunks.current[chunk_id] != undefined) {
            clientp2p._chunks.current[chunk_id].received = true;
        } else {
            console.log("Error en _onCompleteDownloadFilePeer, clientp2p._chunks.current[chunk_id] != undefined");
        }

        clientp2p._writeChunk(info,
            function() {
                if(clientp2p._chunks.current[chunk_id]) {
                    delete clientp2p._chunks.current[info.offset.toString()];
                } else {
                    console.log("Error al llamar _writeChunk, no se encontró el chunk con id " + chunk_id);
                }

                console.log('chunk[' + info.offset + ':' + (info.offset + info.size) + '] Guardado con éxito.');

                if(clientp2p._fileComplete()) {

                    clientp2p._state = CLIENT_DISCONNECTED;

                    console.log(clientp2p._file.name + ' Guardado con éxito.');

                    clientp2p._file.downloading = false;
                    clearInterval(clientp2p._timer);
                    clientp2p._onCompleteDownloadEvent(clientp2p._file.id, clientp2p._file.name);
                }
            }.bind(clientp2p),
            function() {
                clientp2p._rollbackChunk(chunk_id);
            }.bind(clientp2p));

        clientp2p._onCompleteDownloadFilePeerEvent(clientp2p.getPeer(peer_id), clientp2p._file.hash, info);
        clientp2p._downloadChunks();
    }

    _writeChunk(info, successCallback, errorCallback) {
        var path = './downloads/' + info.fileName;
        var mode = 'r+';

        fs.access(path, mode, function(err) {
            if(err && err.code == "ENOENT")
                mode = 'w';

            fs.open('./downloads/' + info.fileName, mode, function(err, fd) {
                if(err && errorCallback)
                    errorCallback();

                fs.write(fd, info.buffer, 0, info.size, info.offset, function(err, written, buff) {
                    if(err && errorCallback)
                        errorCallback();

                    fs.close(fd, successCallback);
                }.bind(clientp2p))
            }.bind(clientp2p))
        }.bind(clientp2p));
    }
}

module.exports = ClientP2P;
