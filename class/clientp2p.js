'use strict';

var io = require('socket.io-client');
var fs = require('fs');

class ClientP2P {

    constructor(onCompleteDownloadFilePeer, onErrorConnection, onConnectFilePeer, onCompleteDownload) {
        this._file = {
            id: null,
            name: null
        };
        this._peers = [];
        this._state = {
            buffers: []
        };
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
            state: 0
        });
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
    setFile(id, name) {
        this._file.id = id;
        this._file.name = name;
    }

    /* Devuelve el nombre del archivo a solicitar */
    getFile() {
        return this._file.name;
    }

    /* Inicia la descarga del archivo */
    downloadFile() {
        this._downloadFilePeers();
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Inicia la descarga de los servidores-pares que no hayan descargado su fragmento  */
    _downloadFilePeers() {
        this._peers.forEach((peer, i) => {
            if (peer.state == 0) {
              this._downloadFilePeer(i, peer.ip, peer.port, this._file.name, peer.size, peer.offset);
            }
        });
    }

    /* Inicia la descarga de un servidor-par */
    _downloadFilePeer(id, ip, port, file_name, file_size, file_offset, callback) {

            var socket = io.connect('http://' + ip + ':' + port, { 'reconnect': false });

            // Detecta la conexión
            socket.on('connect', function() {
                this._onConnectFilePeerEvent(this.getPeer(id), this._file.name);
                console.log('Conectado a ' + ip + ':' + port);
            }.bind(this));

            // No se puede conectar
            socket.on('connect_error', function() {
              this._onErrorConnectionEvent(this._file.id, this._getPeer(id));
            }.bind(this));

            // Detecta la desconexión
            socket.on('disconnect', function() {
                this._onErrorConnectionEvent(id);
            }.bind(this));

            socket.emit('getfile', {
                file: file_name,
                size: file_size,
                offset: file_offset
            });

            console.log('Se solicitó ' + file_name);

            socket.on("sendfile", function(info) {
                console.log(info.buffer.length);
                socket.disconnect();
                this._onCompleteDownloadFilePeer(id, info.buffer);
            }.bind(this));
    }

    /* Método que se ejecuta cuando se finaliza la descarga de uno de los pares */
    _onCompleteDownloadFilePeer(id, buffer) {
        this._peers[id].state = 1;
        this._state.buffers[id] = buffer;
        this._concatFile();

        this._onCompleteDownloadFilePeerEvent(this.getPeer(id), this._file.name);
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

            fs.open('./downloads/' + this._file.name, 'w', function(err, fd) {
                if (err) throw err;

                var my_buffer = Buffer.concat(this._state.buffers);

                fs.write(fd, my_buffer, 0, my_buffer.length, null, function(err, written, buff) {
                    fs.close(fd, function() {
                        this._onCompleteDownloadEvent(this._file.id);
                        console.log(this._file.name + ' Guardado con éxito.');
                    }.bind(this));
                }.bind(this))
            }.bind(this));
        }
    }
}

module.exports = ClientP2P;
