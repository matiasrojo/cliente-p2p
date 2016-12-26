'use strict';

var io = require('socket.io-client');

class ClientBalancer {

    constructor(onConnect, onErrorConnection, onGetServerCatalog) {
        this._ip = null;
        this._port = null;
        this._socket = null;
        this._state = 0;

        this._onErrorConnectionEvent = onErrorConnection;
        this._onConnectEvent = onConnect;
        this._onGetServerCatalogEvent = onGetServerCatalog;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Establece la IP y Puerto de la conexión */
    setIPPort(ip, port) {
        this._ip = ip;
        this._port = port;
    }

    /* Conecta con el servidor de Catálogo */
    connect() {
        this._socket = io.connect('http://' + this._ip + ':' + this._port + '/par');
        this._connection();
    }

    /* Solicita el servidor de catalogo */
    getCatalogServer() {
        this._socket.emit('getCatalogoLessBusy');
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Maneja el flujo de la conexión */
    _connection() {

        // Detecta la conexión
        this._socket.on('connect', function() {
            this._state = 1;
            this._onConnectEvent();
        }.bind(this));

        // Detecta la desconexión
        this._socket.on('disconnect', function() {
            this._onErrorConnectionEvent();
        }.bind(this));

        // Paquetes
        this._socket.on("getCatalogoLessBusy", function(info) {
            this._onGetServerCatalogEvent(info);
        }.bind(this));
    }
}

module.exports = ClientBalancer;
