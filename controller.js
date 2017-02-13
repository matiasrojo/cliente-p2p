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
    mi_client_balancer.addIPPort('192.168.0.9', 3333);
    //mi_client_balancer.addIPPort('192.168.0.35', 3333);
    mi_client_balancer.connect();

    // Solicitamos un servidor de catalogo al balanceador de cargas
    mi_client_balancer.getCatalogServer();
 
    setInterval(function() {
      for(var hash in list_client_p2p) { 
        client_p2p = list_client_p2p[hash];
        if(client_p2p.isClientDownloading())
          mi_client_catalog.getPeersList(hash);
      }
    }, 1000 * 10) //10 seconds
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

    console.log('Recibe catalogo: ');
    console.log(info);

    if (info != null){
      // Nos conectamos a un servidor de catálogo
      mi_client_catalog.setIPPort(info.ip, info.port);
      mi_client_catalog.connect();
    }else{

      // Solicitamos un servidor de catalogo al balanceador de cargas (5 segundos)
      setTimeout(function(){ mi_client_balancer.getCatalogServer() }, 1000 * 5)
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
      $("#info-no-files").hide();
      $.each(files, function(i, file) {
          addResultTableSearch(file.nombre, file.size, file.peers, file.hash);
      });
    }else{
      $("#info-no-files").show()
    }
}

/* Evento recibe lista de pares */
function onGetPeerList(data) {
    var current_file = data.file;
    var peers = data.peers;
    var peers_amount = peers.length;
    var client_p2p = list_client_p2p[current_file.hash];

    client_p2p.setFile(current_file.id, current_file.nombre, current_file.hash,current_file.size);

    $.each(peers, function(i, peer) {
      client_p2p.addPeer(peer.ip, 6532);
    });

    addRowTableDownload(current_file.id, current_file.nombre, current_file.size, peers_amount, 'Descargando...',current_file.hash);

    client_p2p.downloadFile();
}


/* Evento que está a la escucha y obtiene el nombre de un nuevo archivo creado en la carpeta de descargas */
function onAddNewFileDownloadPath(file_name, stats){
  if (Object.keys(list_client_p2p).length == 0 && mi_client_catalog.isCatalogConnected()){
      console.log('Se añadió un nuevo archivo: ' + file_name)
      mi_client_catalog.sendNewFile(file_name);
  }
}

/* Evento que está a la escucha y obtiene el nombre de un archivo eliminado de la carpeta de descargas */
function onDeleteFileDownloadPath(file_name, stats){
  console.log('Se eliminó el archivo: ' + file_name);
  mi_client_catalog.sendDeleteAllFiles();
  mi_client_catalog.sendAllFilesNames();
}


/******************* CLIENTE P2P  **************************/

/* No se puede conectar o se desconecta un par */
function onErrorConnectionClientP2P(lost_peer, file_id) {
  console.log('No se pudo conectar al par '+lost_peer+' descargando el archivo '+file_id);
}

/* Se conectar a un par */
function onConnectFilePeer(peer, file_hash, file_name, chunk) {
  addRowTablePeer(file_name, file_hash, chunk.offset, peer.ip, chunk.offset + ' - ' + (chunk.offset + chunk.size), 'Conectando...');
}

/* Se completa la descarga del par */
function onCompleteDownloadFilePeer(peer, file_hash, chunk,porcentaje) {
  editRowTablePeer(file_hash, chunk.offset, 'Completo',porcentaje);
}


/* Se completa la descarga */
function onCompleteDownload(file_id, file_name,file_hash) {
    editRowTableDownload(file_id, 'Completo',file_hash);
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
    var hash = $(this).attr('idfile');

    var client_p2p = new ClientP2P(onCompleteDownloadFilePeer,
            onErrorConnectionClientP2P,
            onConnectFilePeer,
            onCompleteDownload);

    list_client_p2p[hash] = client_p2p;
    mi_client_catalog.getPeersList(hash);
});


function clearResultTableSearch(){
    $('#search-table tbody tr').remove();
}

function addResultTableSearch(name, size, peers, hash) {
    $('#search-table > tbody:last-child').append(`<tr>
      <td class="p-name">
          <b>` + name + `</b>
          <br>
      </td>
      <td class="p-progress">
          <span>` + (size/ (1024*1024)).toFixed(2) + ` MB</span>
      </td>
      <td>
          <span class="label label-primary">` + peers + `</span>
      </td>
      <td>
          <button id="download-button" idfile="` + hash + `" class="download-button btn btn-info btn-xs">
              <i class="fa fa-pencil"></i>
              Descargar
          </button>
      </td>
  </tr>`);
}

function addRowTableDownload(id, name, size, peers, state,hash) {
    $('#download-table > tbody:last-child').append(`<tr id="download-` + id + `">
      <td class="p-name">
          <b>` + name + `</b>
          <br>
      </td>
      <td class="p-progress">
          <span>` + (size/ (1024*1024)).toFixed(2) + ` MB</span>
      </td>
      <td>
          <span class="label label-primary">` + peers + `</span>
      </td>
      <td class="p-state">
          <span id="state">` + state + `</span>
      </td>
      <td>
          <span id="porcentaje-`+hash+`">(0%)</span>
      </td></tr>`);
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

    var rowpos = $('#peer-' + file_hash + id).position();
    $('#container-peers').scrollTop(rowpos.top);

}

function editRowTableDownload(peer_id, state,file_hash) {
    $('#download-' + peer_id + '  #state').html(state);
    $('#porcentaje-' + file_hash).html('(100%)');
}

function editRowTablePeer(file_hash, peer_id, state,porcentaje_descargado) {
    $('#peer-' + file_hash + peer_id + '  #p-state').html(state);
    $('#porcentaje-' + file_hash).html('('+porcentaje_descargado+'%)');

}



/*********************************************************/
/*                      INICIO
/*********************************************************/
load();
