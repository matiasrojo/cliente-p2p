'use strict';

var io = require('socket.io')();
var fs = require('fs');

class ServerP2P {

    constructor() {
        this._port = 80;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Establece el puerto de escucha */
    setPort(port) {
        this._port = port;
    }

    /* Inicia la escucha por nuevas conexiones */
    listen() {
        io.listen(this._port);
        this.packets();
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Evento que se dispara cuando llega una conexión entrante */
    packets() {
        io.on('connection', function(socket) {

            socket.on('getfile', function(data) {

                console.log('Solicitud de archivo');

                var buffer = new Buffer(data.size);

                fs.open('./downloads/' + data.file, 'r', function(err, fd) {

                    fs.read(fd, buffer, 0, data.size, data.offset, function(err, num) {
                        socket.emit('sendfile', {
                            buffer: buffer,
                            offset: data.offset,
                            size: data.size
                        });
                    });
                });
            });

            socket.on('disconnect', function() {
                io.emit('user disconnected');
            });
        });
    }

}

module.exports = ServerP2P;
