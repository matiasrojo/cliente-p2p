'use strict';

var io = require('socket.io-client');
var fs = require('fs');

const CHUNK_SIZE = 1024*1024; //1Mb
const MAX_CONS = 10; //clientp2p must be configurable
const MAX_CONS_ATTEMPTS = 5;
const CLIENT_DISCONNECTED = 0;
const CLIENT_CONNECTED = 1;
const CLIENT_DOWNLOADING = 2;

class ClientP2P {

    constructor(onCompleteDownloadFilePeer, onErrorConnection, onConnectFilePeer, onCompleteDownload) {

        this._state = CLIENT_DISCONNECTED;
        this._file = {
            id: null,
            name: null,
            hash: null,
            size: null,
            downloading: false
        };
        this._peers = [];
        this._chunks = {
            pending: [],
            current: []
        };
        this._descargadoActual = 0;
        this._connections = 0;
        this._timer = null;
        this._onCompleteDownloadFilePeerEvent = onCompleteDownloadFilePeer;
        this._onErrorConnectionEvent = onErrorConnection;
        this._onConnectFilePeerEvent = onConnectFilePeer;
        this._onCompleteDownloadEvent = onCompleteDownload;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Agrega un nuevo servidor-par */
    addPeer(ip, port) {
        this._peers.push({
            id: this._peers.length,
            ip: ip,
            port: port,
            state: 0,
            currentChunk: 0,
            conecctionsAttempts: 0
        });
    }

    /* Obtiene un servidor-par */
    getPeer(id) {
        return this._peers[id];
    }

    /* Establece el nombre del archivo a solicitar */
    setFile(id, name, hash, size) {
        this._file.id = id;
        this._file.name = name;
        this._file.hash = hash;
        this._file.size = size;

        var i;
        for(i=0;i < Math.floor(size/CHUNK_SIZE); i++) {
            this._chunks.pending.push({offset: i*CHUNK_SIZE, size: CHUNK_SIZE, received: false});
        }

        if((size%CHUNK_SIZE) != 0)
            this._chunks.pending.push({offset: i*CHUNK_SIZE, size: size%CHUNK_SIZE, received: false});
	   //Here is possible shuffle chunks to avoid download contiguous chunks every time
    }

    /* Inicia la descarga del archivo */
    downloadFile() {
        this._file.downloading = true;
        this._downloadChunks();
    }

    /* Verifica si el cliente se encuentra haciendo una descarga */
    isClientDownloading() {
      if (this._state == CLIENT_DOWNLOADING){
        return true;
      }else{
        return false;
      }
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */
    _fileComplete() {
        return ((this._chunks.pending.length + Object.keys(this._chunks.current).length) == 0);
    }

    _rollbackChunk(chunk_id) {
        var chunk = this._chunks.current[chunk_id];
        if(chunk != undefined) {
            chunk = JSON.parse(JSON.stringify(this._chunks.current[chunk_id]));
            this._chunks.pending.push(chunk);
            delete this._chunks.current[chunk_id]
        } else {
            console.log("Error en _rollbackChunk, chunk == undefined");
        }
    }

    _downloadChunks() {
        if(this._timer)
            clearInterval(this._timer)

        if(this._file.downloading == false) return false;
        this._timer = setInterval(this._downloadChunks.bind(this), 2000);

        for(var peer_id = 0; peer_id < this._peers.length; peer_id++) {
            var peer = this._peers[peer_id];

            if((peer.state == 0) && (this._chunks.pending.length > 0) && (this._connections < MAX_CONS)) {
                var chunk = this._chunks.pending.shift();
                var chunk_id = chunk.offset.toString();

                this._chunks.current[chunk_id] = chunk;
                this._downloadChunk(chunk_id, peer_id, peer.ip, peer.port, this._file.name, chunk.size, chunk.offset);
            }
        };
    }

    _downloadChunk(chunk_id, peer_id) {
        var peer = this._peers[peer_id];
        var socket = io.connect('http://' + peer.ip + ':' + peer.port, {
            'reconnect': true,
            'reconnection': true,
            'reconnectionDelay': 1000,
            'reconnectionDelayMax' : 5000,
            'reconnectionAttempts': MAX_CONS_ATTEMPTS
        });

        this._peers[peer_id].state = 1;

        // Detecta la conexión
        socket.on('connect', function() {
            //console.log('Conectado a ' + peer.ip + ':' + peer.port);

            this._state = CLIENT_CONNECTED;

            this._connections++;
            this._peers[peer_id].conecctionsAttempts = 0;
            this._peers[peer_id].currentChunk = chunk_id;

            if(this._chunks.current[chunk_id] != undefined)
                this._onConnectFilePeerEvent(peer, this._file.hash, this._file.name, this._chunks.current[chunk_id]);
        }.bind(this));

        //Detecta si hubo un error en la conexión
        socket.on('connect_error', function(error) {
            console.log('connect_error');

            this._peers[peer_id].conecctionsAttempts++;

            if(this._peers[peer_id].conecctionsAttempts == MAX_CONS_ATTEMPTS) {
                socket.disconnect();
                this._rollbackChunk(chunk_id);
                //this._peers.splice(peer_id, 1);

                console.log('Deshabilitando par ' + peer.ip + ":" + peer.port);
            }

            //this._onErrorConnectionEvent(peer, this._file.id);
            this._downloadChunks();
        }.bind(this));

        // Detecta la desconexión
        socket.on('disconnect', function() {
            this._connections--;
            this._peers[peer_id].state = 0;

            var chunk = this._chunks.current[chunk_id];
            if(chunk && (chunk.received == false)) {
                this._rollbackChunk(chunk_id);
                this._onErrorConnectionEvent(peer, this._file.id);
            }

            this._downloadChunks();
        }.bind(this));

        socket.emit('getfile', {
            file: this._file.name,
            size: this._chunks.current[chunk_id].size,
            offset: this._chunks.current[chunk_id].offset
        });

        //console.log('Se solicitó ' + this._file.name + "[" + this._chunks.current[chunk_id].offset + ":" + (this._chunks.current[chunk_id].offset + this._chunks.current[chunk_id].size) + "]");

        socket.on("sendfile", function(info) {
            this._onCompleteDownloadFilePeer(peer_id, info);
            socket.disconnect();
        }.bind(this));
    }

    /* Método que se ejecuta cuando se finaliza la descarga de uno de los pares */
    _onCompleteDownloadFilePeer(peer_id, info) {
        var chunk_id = info.offset.toString();

        this._state = CLIENT_DOWNLOADING;

        this._peers[peer_id].state = 0;
        if(this._chunks.current[chunk_id] != undefined) {
            this._chunks.current[chunk_id].received = true;
        } else {
            console.log("Error en _onCompleteDownloadFilePeer, this._chunks.current[chunk_id] != undefined");
        }

        this._writeChunk(info,
            function() {
                if(this._chunks.current[chunk_id]) {
                    delete this._chunks.current[info.offset.toString()];
                } else {
                    console.log("Error al llamar _writeChunk, no se encontró el chunk con id " + chunk_id);
                }

                console.log('chunk[' + info.offset + ':' + (info.offset + info.size) + '] Guardado con éxito.');

                if(this._fileComplete()) {

                    this._state = CLIENT_DISCONNECTED;

                    console.log(this._file.name + ' Guardado con éxito.');

                    this._file.downloading = false;
                    clearInterval(this._timer);
                    this._onCompleteDownloadEvent(this._file.id, this._file.name,this._file.hash);
                }
            }.bind(this),
            function() {
                this._rollbackChunk(chunk_id);
            }.bind(this));
            this._descargadoActual = (this._descargadoActual+CHUNK_SIZE);
            let porcentajeActual = parseInt((this._descargadoActual * 100) / this._file.size);
        this._onCompleteDownloadFilePeerEvent(this.getPeer(peer_id), this._file.hash, info,porcentajeActual);
        this._downloadChunks();
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
                }.bind(this))
            }.bind(this))
        }.bind(this));
    }
}

module.exports = ClientP2P;
