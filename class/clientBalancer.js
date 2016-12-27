'use strict';

var io = require('socket.io-client');

class ClientBalancer {

    constructor(onConnect, onErrorConnection, onGetServerCatalog) {
        this._balancers = [];
        this._socket = null;
        this._state = 0;
        this._current_balancer = 0;

        this._onErrorConnectionEvent = onErrorConnection;
        this._onConnectEvent = onConnect;
        this._onGetServerCatalogEvent = onGetServerCatalog;
    }


    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PÚBLICOS :::::
       :::::::::::::::::::::::::::::::  */

    /* Agrega una nueva IP y Puerto de la conexión */
    addIPPort(ip, port) {
        this._balancers.push({
            ip: ip,
            port: port
        })
    }

    /* Conecta con el servidor de Balance */
    connect() {
        var balancer = this._balancers[this._current_balancer];

        this._socket = io.connect('http://' + balancer.ip + ':' + balancer.port + '/par', {
            'reconnection': true,
            'reconnectionDelay': 2000,
            'reconnectionAttempts': 2
        });
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

        // Reconexión fallida
        this._socket.on('reconnect_failed', function() {

            this._current_balancer++;

            if (this._current_balancer == this._balancers.length) {
                this._current_balancer = 0;
            }

            this._connect()
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
