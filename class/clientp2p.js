'use strict';

var io = require('socket.io-client');
var fs = require('fs');
var CHUNK_SIZE = 1024*1024; //1Mb
var MAX_CONS = 10; //This must be configurable

class ClientP2P {

    constructor(onCompleteDownloadFilePeer, onErrorConnection, onConnectFilePeer, onCompleteDownload) {
        this._file = {
            id: null,
            name: null,
            hash: null,
            size: null,
            downloading: false
        };
        this._peers = [];
        this._state = {
            buffers: []
        };
        this._chunks = [];
        this._connections = 0;
        this._onCompleteDownloadFilePeerEvent = onCompleteDownloadFilePeer;
        this._onErrorConnectionEvent = onErrorConnection;
        this._onConnectFilePeerEvent = onConnectFilePeer;
        this._onCompleteDownloadEvent = onCompleteDownload;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Agrega un nuevo servidor-par */
    addPeer(ip, port, size, offset) {
        this._peers.push({
            id: this._peers.length,
            ip: ip,
            port: port,
            size: size,
            offset: offset,
            state: 0,
            currentChunk: 0
        });

        this._downloadChunks();
    }

    /* Modifica un servidor-par */
    setPeer(id, ip, port, size, offset) {
        this._peers[id] = {
            ip: ip,
            port: port,
            size: size,
            offset: offset,
            state: 0
        };
    }

    /* Obtiene un servidor-par */
    getPeer(id) {
        return this._peers[id];
    }

    /* Obtiene un servidor-par diferente al id */
    getPeerDistinct(id) {
      $.each(this._peers, function(i, peer) {
        if (i != id) {
          return peer
        }
      });
    }

    /* Establece el nombre del archivo a solicitar */
    setFile(id, name, hash, size) {
        this._file.id = id;
        this._file.name = name;
        this._file.hash = hash;
        this._file.size = size;

        var i;
        for(i=0;i < Math.floor(size/CHUNK_SIZE); i++) {
            this._chunks[i] = {offset: i*CHUNK_SIZE, size: CHUNK_SIZE, state: false};
        }

        if(size%CHUNK_SIZE != 0)
            this._chunks[i] = {offset: i*CHUNK_SIZE, size: size%CHUNK_SIZE, state: false};

	//Here is possible shuffle chunks to avoid download contiguous chunks every time
    }

    /* Devuelve el nombre del archivo a solicitar */
    getFile() {
        return this._file.name;
    }

    /* Inicia la descarga del archivo */
    downloadFile() {
        this._file.downloading = true;
        this._downloadChunks();
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */
    _fileComplete() {
        this._chunks.forEach((chunk, i) => {
            if(chunk.state != 2) return false;
        });

        return true;
    }

    _getPeerFree() {
        var peerFreeId = null;
        this._peers.forEach((peer, i) => {
            if(peer.state == 0){
                peerFreeId = i;
            }
        });
        return peerFreeId
    }

    _downloadChunks() {
        if(this._file.downloading == false) return false;

        this._chunks.forEach((chunk, i) => {
            if(this._connections < MAX_CONS) {
                if(chunk.state == 0) {

                    var peer_id = this._getPeerFree();
                    var peer = this._peers[peer_id];
                    this._downloadFilePeer(i, peer_id, peer.ip, peer.port, this._file.name, chunk.size, chunk.offset);
                }
            } else {
                return true;
            }
        });
    }



    /* Inicia la descarga de los servidores-pares que no hayan descargado su fragmento  */
    _downloadFilePeers() {
        this._peers.forEach((peer, i) => {
            if (peer.state == 0) {
              this._downloadFilePeer(i, peer.ip, peer.port, this._file.name, peer.size, peer.offset);
            }
        });
    }

    /* Inicia la descarga de un servidor-par */
    _downloadFilePeer(chunk_id, id, ip, port, file_name, file_size, file_offset, callback) {

            var socket = io.connect('http://' + ip + ':' + port, { 'reconnect': false });

            this._peers[id].state = 1;
            this._peers[id].currentChunk = chunk_id;
            this._chunks[chunk_id].state = 1;
            
            // Detecta la conexión
            socket.on('connect', function() {
                this._onConnectFilePeerEvent(this.getPeer(id), this._file.hash);
                console.log('Conectado a ' + ip + ':' + port);
                this._connections++;
            }.bind(this));

            // Detecta la desconexión
            socket.on('disconnect', function() {
                this._connections--;
                this._peers[id].state = 0;
                this._chunks[this._peers[id].currentChunk].state = 0;
                this._onErrorConnectionEvent(this.getPeer(id), this._file.id);
                this._downloadChunks();
            }.bind(this));

            socket.emit('getfile', {
                file: file_name,
                size: file_size,
                offset: file_offset
            });

            console.log('Se solicitó ' + file_name);

            socket.on("sendfile", function(info) {
                socket.disconnect();
                this._connections--;
                this._onCompleteDownloadFilePeer(id, info);
            }.bind(this));
    }

    /* Método que se ejecuta cuando se finaliza la descarga de uno de los pares */
    _onCompleteDownloadFilePeer(id, info) {
        this._peers[id].state = 0;
        //this._state.buffers[id] = buffer;
        //this._concatFile();
        this._writeChunk(info);

        this._onCompleteDownloadFilePeerEvent(this.getPeer(id), this._file.hash);
        this._downloadChunks();
    }

    _chunkDownloaded(downloadedChunk) {
        this._chunks.forEach((chunk, i) => {
            if(chunk.offset == downloadedChunk.offset)
                this._chunks[i].state = 2;
        });
    }

    _writeChunk(info, chunk_id) {
        fs.open('./downloads/' + this._file.name, 'w', function(err, fd) {
            if (err) throw err;

            fs.write(fd, info.buffer, 0, info.size, info.offset, function(err, written, buff) {
                fs.close(fd, function() {
                    this._chunkDownloaded(info);
                    console.log('chunk[' + info.offset + ':' + (info.offset + info.size) + '] Guardado con éxito.');
                    if(this._fileComplete()) {
                        this._onCompleteDownloadEvent(this._file.id, this._file.name);
                        console.log(this._file.name + ' Guardado con éxito.');
                    }
                }.bind(this));
            }.bind(this))
        }.bind(this));
    }

    /* Permite concatenar los buffers y guarda el archivo */
    _concatFile() {

        var flag = true;

        // Verificamos que todos los servidores-pares hayan enviado la infomración
        for (var i in this._peers) {
            if (this._peers[i].state == 0) {
                flag = false;
            }
        }

        if (flag) {

            fs.open('./downloads/' + this._file.name, 'a', function(err, fd) {
                if (err) throw err;

                var my_buffer = Buffer.concat(this._state.buffers);

                fs.write(fd, my_buffer, 0, my_buffer.length, null, function(err, written, buff) {
                    fs.close(fd, function() {
                        this._onCompleteDownloadEvent(this._file.id, this._file.name);
                        console.log(this._file.name + ' Guardado con éxito.');
                    }.bind(this));
                }.bind(this))
            }.bind(this));
        }
    }
}

module.exports = ClientP2P;
