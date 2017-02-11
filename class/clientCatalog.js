'use strict';

var io = require('socket.io-client');
var fs = require('fs');
var md5File = require('md5-file')
var chokidar = require('chokidar');
var path = require('path');


const CATALOG_DISCONNECTED = 0;
const CATALOG_CONNECTED = 1;

class ClientCatalog {

    constructor(onConnect, onErrorConnection, onGetFileList, onGetPeerList,
                onAddNewFileDownloadPath, onDeleteFileDownloadPath) {

        this._ip = null;
        this._port = null;
        this._socket = null;
        this._state = CATALOG_DISCONNECTED;
        this._current_file_list = [];
        this._current_file_selected = null;

        this._onConnectEvent = onConnect;
        this._onErrorConnectionEvent = onErrorConnection;
        this._onGetFileListEvent = onGetFileList;
        this._onGetPeerListEvent = onGetPeerList;
        this._onAddNewFileDownloadPathEvent = onAddNewFileDownloadPath;
        this._onDeleteFileDownloadPathEvent = onDeleteFileDownloadPath;


        // Evento a la escucha de inserción, modificación y/o borrado de archivos en la carpeta de descargas
        this._watcher = chokidar.watch('./downloads/', {
            ignored: /[\/\\]\./, persistent: true
        });

        this._watcher
            .on('add', function(file_path, stats) { this._onAddNewFileDownloadPathEvent(path.basename(file_path), stats); }.bind(this))
            .on('unlink', function(file_path, stats) { this._onDeleteFileDownloadPathEvent(path.basename(file_path), stats); }.bind(this))
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
        this._socket = io.connect('http://' + this._ip + ':' + this._port + '/par', {
            'reconnection': false
        });
        this._connection();
    }

    /* Solicita listado de archivos por nombre */
    getFilesList(name) {
        this._socket.emit('buscarArchivo', name);
    }

    /* Devuelve la lista de archivos actual */
    getCurrentFileList() {
        return this._current_file_list;
    }

    /* Devuelve el último archivo selecionado para descargar */
    getCurrentFileSelected() {
        return this._current_file_selected;
    }

    /* Solicita el listado de pares mediante el ID del archivo */
    getPeersList(id_file) {

        this._current_file_selected = this._current_file_list.filter(
            function(data) {
                return data.id == id_file
            })[0];

        this._socket.emit('getParesArchivo', id_file);
    }

    /* Notifica la existencia del nuevo archivo al Catalogo */
    sendNewFile(file) {
        if (file.charAt(0) != ".") {
            md5File('./downloads/' + file, (err, hash) => {
                if (err){

                  console.log(file + " está ocupado. Se reenviará en 5 segundos...")
                  setTimeout(function(){ this.sendNewFile(file, null) }.bind(this), 1000 * 5)
                }else{

                  this._socket.emit('nuevoArchivo', {
                      hash: hash,
                      nombre: file,
                      size: this._getFilesize('./downloads/' + file)
                  });

                  console.log('Se anunció el archivo ' + file);
                }
            })
        }
    }

    sendDeleteFile(file_name){

    }

    /* Verifica si se está conectado a un servidor catálogo */
    isCatalogConnected() {
      if (this._state == CATALOG_CONNECTED){
        return true;
      }else{
        return false;
      }
    }



    /* :::::::::::::::::::::::::::::::
       :::::::  MÉTODOS PRIVADOS :::::
       :::::::::::::::::::::::::::::::  */

    _sendAllFilesNames() {
        fs.readdir('./downloads/', function(err, files) {
            $.each(files, function(i, file) {
                this.sendNewFile(file);
            }.bind(this));
        }.bind(this));
    }

    /* Envía un mensaje de bienvenida */
    _sendHello() {
        this._socket.emit('parConectado');
    }

    /* Maneja el flujo de la conexión */
    _connection() {

        // Detecta la conexión
        this._socket.on('connect', function() {
            this._state = CATALOG_CONNECTED;
            this._onConnectEvent();
            this._sendHello();
            this._sendAllFilesNames();
        }.bind(this));

        // Detecta la desconexión
        this._socket.on('disconnect', function() {
            this._state = CATALOG_DISCONNECTED;
            this._onErrorConnectionEvent();
        }.bind(this));

        // Paquetes
        this._socket.on("archivoEncontrado", function(info) {
            this._current_file_list = info;
            this._onGetFileListEvent(this._current_file_list);
        }.bind(this));

        this._socket.on("listadoPares", function(info) {
            this._onGetPeerListEvent(info);
        }.bind(this));
    }

    /* Obtiene el tamaño de un archivo en bytes */
    _getFilesize(filename) {
        var stats = fs.statSync(filename)
        var fileSizeInBytes = stats["size"]
        return fileSizeInBytes
    }
}

module.exports = ClientCatalog;
