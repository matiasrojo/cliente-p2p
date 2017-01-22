# Cliente P2P

#### Propósito

Este proyecto tiene como fin desarrollar un Cliente P2P que permita la transferencia
de diferentes recursos entre nodos de una red de manera distribuida y pararela.
Para tal fin, se utilizaron las tecnologías: HTML5, NodeJs, Framework ElectronJS,
JQuery, Socket.io lo que nos permitió un desarrollo e independencia de cada componente del proceso.

#### Funciones

* Solicitar al servidor balanceador información de conexión del catálogo.
* Obtener del servidor catálogo el listado de archivos disponibles, mediante el nombre.
* Adquirir del servidor catálogo el listado de pares que disponen de un recurso en específico.
* Informar al servidor catálogo la lista de archivos disponibles.
* Transferir de manera pararela y distribuida archivos entre diferentes clientes P2P.

#### Requisitos

Como parte fundamental del proyecto es necesario tener instalado NodeJs (https://nodejs.org/es/) y npm para la instalación de librerías.

#### Instalación

```sh
$ git clone git@github.com:patotorres/cliente-p2p.git
$ cd cliente-p2p
$ npm install
```

Modificar la siguiente línea de controller.js con la IP:PUERTO del balanceador

>  mi_client_balancer.setIPPort('192.168.0.3', 3333);
   mi_client_balancer.connect();


```
$ npm run start
```


### Author
Rojo Matías Ignacio
matiasrojo@hotmail.com.ar
