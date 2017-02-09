const ClientP2P = require('./class/clientp2p.js')
const ServerP2P = require('./class/serverp2p.js')
const ClientCatalog = require('./class/clientCatalog.js')
const ClientBalancer = require('./class/clientBalancer.js')

mi_server_p2p = new ServerP2P();
list_client_p2p = [];
mi_client_balancer = new ClientBalancer(onConnectionBalancer,
                                        onErrorConnectionBalancer,
                                        onGetServerCatalog);
mi_client_catalog = new ClientCatalog(onConnectionCatalog,
                                      onErrorConnectionCatalog,
                                      onGetFileList,
                                      onGetPeerList,
                                      onAddNewFileDownloadPath,
                                      onDeleteFileDownloadPath);



function load() {

    // Iniciamos el servidor de archivos
    mi_server_p2p.listen();

    // Iniciamos la conexión con el balanceador de cargas
    mi_client_balancer.addIPPort('127.0.0.1', 3333);
    //mi_client_balancer.addIPPort('192.168.0.35', 3333);
    mi_client_balancer.connect();

    // Solicitamos un servidor de catalogo al balanceador de cargas
    mi_client_balancer.getCatalogServer();
}

function searchFiles(name) {
    mi_client_catalog.getFilesList(name);
}


/*********************************************************/
/*                  EVENTOS DE LAS CLASES
/*********************************************************/


/******************* BALANCEADOR  *************************/

/* Evento conexión con el balanceador */
function onConnectionBalancer() {
    document.title = "Cliente P2P - Conectado al balanceador";
}

/* Evento recibe servidor catálogo */
function onGetServerCatalog(info) {

    if (info != null){

      // Nos conectamos a un servidor de catálogo
      mi_client_catalog.setIPPort(info.ip, info.port);
      mi_client_catalog.connect();
    }else{

      // Solicitamos un servidor de catalogo al balanceador de cargas (10 segundos)
      setTimeout(mi_client_balancer.getCatalogServer(), 60 * 60 * 10)
    }
}

/* Nos desconectamos del balanceador */
function onErrorConnectionBalancer() {
  document.title = "Cliente P2P - Desconectado del balanceador";
}


/******************* CATÁLOGO  **************************/

/* Evento conexión con el servidor de Catalogo */
function onConnectionCatalog(){
  document.title = "Cliente P2P - Conectado al Catálogo";
  $("#button-search").prop("disabled", false);
}

/* Nos desconectamos o no nos pudimos conectar al catalogo */
function onErrorConnectionCatalog() {

  document.title = "Cliente P2P - Desconexión del Catálogo";

  // Solicitamos un servidor de catalogo al balanceador de cargas
  mi_client_balancer.getCatalogServer();
}

/* Evento recibe listado de archivos */
function onGetFileList(files) {

    clearResultTableSearch();

    if (files.length > 0){
      $("#info-no-files").hidde();
      $.each(files, function(i, file) {
          addResultTableSearch(file.nombre, file.size, file.peers, file.id);
      });
    }else{
      $("#info-no-files").show()
    }
}

/* Evento recibe lista de pares */
function onGetPeerList(peers) {

    var current_file = mi_client_catalog.getCurrentFileSelected();
    var peers_amount = peers.length;

    var client_p2p = new ClientP2P(onCompleteDownloadFilePeer,
            onErrorConnectionClientP2P,
            onConnectFilePeer,
            onCompleteDownload);

    client_p2p.setFile(current_file.id, current_file.nombre, current_file.hash,current_file.size);

    $.each(peers, function(i, peer) {
      client_p2p.addPeer(peer.ip, 6532);
    });

    addRowTableDownload(current_file.id, current_file.nombre, current_file.size, peers_amount, 'Descargando...');

    // Agregamos la conexión a la lista
    list_client_p2p[current_file.id] = client_p2p;
    list_client_p2p[current_file.id].downloadFile();
}


/* Evento que está a la escucha y obtiene el nombre de un nuevo archivo creado en la carpeta de descargas */
function onAddNewFileDownloadPath(file_name, stats){
  mi_client_catalog.sendNewFile(file_name);
}

/* Evento que está a la escucha y obtiene el nombre de un archivo eliminado de la carpeta de descargas */
function onDeleteFileDownloadPath(file_name, stats){
  console.log(stats);
}


/******************* CLIENTE P2P  **************************/

/* No se puede conectar o se desconecta un par */
function onErrorConnectionClientP2P(lost_peer, file_id) {
}

/* Se conectar a un par */
function onConnectFilePeer(peer, file_hash, file_name, chunk) {
  addRowTablePeer(file_name, file_hash, chunk.offset, peer.ip, chunk.offset + ' - ' + (chunk.offset + chunk.size), 'Conectando...');
}

/* Se completa la descarga del par */
function onCompleteDownloadFilePeer(peer, file_hash, chunk) {
  editRowTablePeer(file_hash, chunk.offset, 'Completo');
}

/* Se completa la descarga */
function onCompleteDownload(file_id, file_name) {
    editRowTableDownload(file_id, 'Completo');
    mi_client_catalog.sendNewFile(file_name);
}



/*********************************************************/
/*                  EVENTOS DE LA VISTA
/*********************************************************/

// Click en el botón de buscar
$("#button-search").click(function() {
    var file_name = $("#text-search").val();
    searchFiles(file_name);
});

// Click en el bóton descargar
$('.container').on('click', 'button.download-button', function() {
    var id_file = $(this).attr('idfile');
    mi_client_catalog.getPeersList(id_file);
});


function clearResultTableSearch(){
    $('#search-table tbody tr').remove();
}

function addResultTableSearch(name, size, peers, id) {
    $('#search-table > tbody:last-child').append(`<tr>
      <td class="p-name">
          <b>` + name + `</b>
          <br>
      </td>
      <td class="p-progress">
          <span>` + size + ` b</span>
      </td>
      <td>
          <span class="label label-primary">` + peers + `</span>
      </td>
      <td>
          <button id="download-button" idfile="` + id + `" class="download-button btn btn-info btn-xs">
              <i class="fa fa-pencil"></i>
              Descargar
          </button>
      </td>
  </tr>`);
}

function addRowTableDownload(id, name, size, peers, state) {
    $('#download-table > tbody:last-child').append(`<tr id="download-` + id + `">
      <td class="p-name">
          <b>` + name + `</b>
          <br>
      </td>
      <td class="p-progress">
          <span>` + size + `</span>
      </td>
      <td>
          <span class="label label-primary">` + peers + `</span>
      </td>
      <td class="p-state">
          <span>` + state + `</span>
      </td>
  </tr>`);
}

function addRowTablePeer(file_name, file_hash, id, ip, fragment, state) {

    $('#peers-table > tbody:last-child').append(`<tr id="peer-` + file_hash + id + `">
        <td class="name">
            <b>` + file_name + `</b>
            <br>
        </td>
        <td class="ip">
            <b>` + ip + `</b>
            <br>
        </td>
        <td class="size">
            <span>` + fragment + `</span>
        </td>
        <td class="p-state">
            <span>` + state + `</span>
        </td>
    </tr>`);
}

function editRowTableDownload(peer_id, state) {
    $('#download-' + peer_id + ' > .p-state').html(state);
}

function editRowTablePeer(file_hash, peer_id, state) {
    $('#peer-' + file_hash + peer_id + ' > .p-state').html(state);
}



/*********************************************************/
/*                      INICIO
/*********************************************************/
load();
