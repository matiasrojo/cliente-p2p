# Servidor Balanceador

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
$ git clone git@github.com:zamudio-fabian/servidor-balanceador.git
$ cd servidor-balanceador
$ npm install
```

Llenar el archivo con los datos segun corresponda

>   HOST=localhost

>   PORT=3333

>   APP_KEY=krXAwJcbYB36A1BzrPtiohF41KmK9Np4

>   NODE_ENV=development

>   CACHE_VIEWS=false

>   SESSION_DRIVER=cookie

>   DB_CONNECTION=sqlite

>   DB_HOST=127.0.0.1

>   DB_USER=root

>   DB_PASSWORD=

>   DB_DATABASE=adonis



```
$ npm run start
```


### Author
Rojo Matías Ignacio
matiasrojo@hotmail.com.ar
