const ClientP2P = require('./class/clientp2p.js')
const ServerP2P = require('./class/serverp2p.js')
const ClientCatalog = require('./class/clientCatalog.js')
const ClientBalancer = require('./class/clientBalancer.js')

mi_server_p2p = new ServerP2P();
list_client_p2p = [];
mi_client_balancer = new ClientBalancer(onConnectionBalancer,
                                        onErrorConnectionBalancer,
                                        onGetServerCatalog);
mi_client_catalog = new ClientCatalog(onConnectionCatalog, onErrorConnectionCatalog, onGetFileList, onGetPeerList);



function load() {

    // Iniciamos el servidor de archivos
    mi_server_p2p.listen();

    // Iniciamos la conexión con el balanceador de cargas
    mi_client_balancer.addIPPort('192.168.1.7', 3333);
    mi_client_balancer.addIPPort('192.168.1.8', 3333);
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

    // Nos conectamos a un servidor de catálogo
    mi_client_catalog.setIPPort(info.ip, info.port);
    mi_client_catalog.connect();
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

    $.each(files, function(i, file) {
        addResultTableSearch(file.nombre, file.size, file.peers, file.id);
    });
}

/* Evento recibe lista de pares */
function onGetPeerList(peers) {

    var current_file = mi_client_catalog.getCurrentFileSelected();
    var peers_amount = peers.length;

    var client_p2p = new ClientP2P(onCompleteDownloadFilePeer,
            onErrorConnectionClientP2P,
            onConnectFilePeer,
            onCompleteDownload);

    client_p2p.setFile(current_file.id, current_file.nombre, current_file.hash);

    $.each(peers, function(i, peer) {

        var file_size = (current_file.size / peers_amount) * (i + 1);
        var file_offset = (current_file.size / peers_amount) * i;

        client_p2p.addPeer(peer.ip, 80, file_size, file_offset);

        addRowTablePeer(current_file.hash, i, peer.ip, file_offset + ' - ' + file_size , 'Conectando...');
    });

    addRowTableDownload(current_file.id, current_file.nombre, current_file.size, peers_amount, 'Descargando...');

    // Agregamos la conexión a la lista
    list_client_p2p[current_file.id] = client_p2p;
    list_client_p2p[current_file.id].downloadFile();
}



/******************* CLIENTE P2P  **************************/

/* No se puede conectar o se desconecta un par */
function onErrorConnectionClientP2P(lost_peer, file_id) {

  // Obtenemos un par diferente al caído
  var peer = list_client_p2p[file_id].getPeerDistinct(lost_peer.id);

  if (peer != null){
    // Reemplazamos al caído
    list_client_p2p[file_id].setPeer(peer.id, peer.ip, peer.port, lost_peer.size, lost_peer.offset);

    // Volvemos a descargar esa parte
    list_client_p2p[file_id].downloadFile();
  }
}

/* Se conectar a un par */
function onConnectFilePeer(peer, file_hash) {
    editRowTablePeer(file_hash, peer.id, 'Descargando...');
}

/* Se completa la descarga del par */
function onCompleteDownloadFilePeer(peer, file_hash) {
    editRowTablePeer(file_hash, peer.id, 'Completado');
}

/* Se completa la descarga */
function onCompleteDownload(file_id, file_name) {
    editRowTableDownload(file_id, 'Completado');
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

function addRowTablePeer(file_hash, id, ip, fragment, state) {

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
