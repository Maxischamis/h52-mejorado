# Editar sin complicaciones

## Con el editor

### Compartido entre celulares

El editor abre en Productos: busca por nombre, filtra categoria/disponibilidad,
elige un producto con foto y edita sus secciones. Disponible se cambia tambien
desde la lista. Para cambios por lote, selecciona productos con sus casillas,
elige el ajuste y pulsa Aplicar; Deshacer recupera el estado anterior.
Los extras se editan en Opciones y extras, sin escribir JSON. Foto permite
elegir del catalogo existente o escribir una direccion de imagen propia.
Servicio permite editar mesas, moneda, servicio y limites de cantidad.
En celular, Vista previa alterna entre la carta y los controles de edicion.
Archivos JSON conserva importacion y exportacion de copias.

Abri `editor.html` desde el servidor H52, ingresa con la clave de salon y usa
**Guardar compartido**. La carta y los editores sin cambios pendientes consultan
el servidor cada dos segundos; al volver a una pestaña del editor se actualiza tambien.
Si otro celular guardo mientras estabas editando, tu borrador no se pisa:
descarga tus JSON y usa **Recargar compartido** para revisar la version nueva.

Sin base de datos: el servidor guarda diseño y catalogo juntos en
`H52_DATA_DIR/menu.json`, mediante reemplazo atomico. Conserva la version anterior
en `menu.previous.json`. Estos archivos no se publican en Git ni contienen claves.
Para editarlos a mano, detene el servidor, edita `menu.json` y reinicialo.
Una vez que existe ese archivo, es la fuente compartida; `config/` sigue siendo
la configuracion inicial y la version estatica de GitHub Pages.

Los dos celulares deben abrir la misma direccion del servidor. En el mismo Wi-Fi,
usa `http://IP-DE-LA-COMPUTADORA:8787/editor.html` y mantenela encendida.
Para acceso desde cualquier lugar hace falta desplegar Node con HTTPS, disco
persistente, una sola instancia y las variables documentadas en `LEEME.md`.
GitHub Pages solo sirve archivos: subir el codigo a Git no instala este servidor.

### Copias locales o GitHub Pages

En GitHub Pages el editor ofrece **Publicar en GitHub**. Requiere un token
fine-grained del propietario limitado a este repositorio, con permiso
Contents: Read and write y vencimiento corto. El token queda solo en memoria,
se limpia del formulario al conectar y se elimina al desconectar o recargar.
Nunca se exporta junto al borrador. No copies tokens en chats ni en el codigo.

Los JSON de diseño/productos y la copia offline se publican juntos en un commit.
La rama no se fuerza: si otro editor publico primero, se rechaza el guardado
para que puedas revisar la version compartida. GitHub Pages tarda en desplegar;
la carta consulta cada 30 segundos y el editor consulta GitHub cada 1-2 minutos.
Los pedidos no se guardan en GitHub: necesitan el servidor JSON existente.

1. Abrí `Abrir.command` y entrá a `editor.html`.
2. En Productos, elegí el plato y su categoría.
3. En Personalización del pedido, escribí una opción por línea: Papas, Cebolla, Salsa.
4. Activá o desactivá las indicaciones escritas para ese producto.
5. En Diseño, cambiá marca, colores, portada y textos. Inicio y Carta son anclas de la misma página.
6. Exportá Diseño JSON y Productos JSON y reemplazá los archivos en `config/`.

Los borradores del editor se guardan en este navegador. No reemplazan los archivos
del proyecto. Para abrir por doble clic sin servidor, regenerá `offline-data.js`
con `node build-data.mjs` o exportá la copia offline desde la pestaña JSON.

## En products.json

Cada producto tiene estas opciones editables:

```json
"customization": {
  "removable": ["Papas", "Cebolla", "Salsa"],
  "allowNote": true
}
```

Usá nombres sin la palabra "Sin": la app agrega esa palabra automáticamente.
Para no ofrecer opciones para quitar, usá `"removable": []`.
`allowNote` habilita el campo de indicaciones del popup. El texto tiene un máximo
de 400 caracteres. Quitar ingredientes no cambia el precio.

Las categorías se declaran en `categories`. En cada producto, el campo
`classification.categoryId` debe coincidir con el `id` de su categoría.
El catálogo importado contiene 177 productos en 13 categorías, incluidos Lomos.
El editor también acepta el formato original del archivo de productos adjunto.
Los extras se editan desde la pestaña JSON con `id`, `name`, `price` y `available`.
Su precio se suma por unidad. Las fotos actuales son ilustrativas y locales.
Para usar una foto real, cambiá Imagen en el editor: el recorte se elimina solo.
En JSON, cambiá `image` y eliminá `imageCrop` e `imageIllustrative`.
`imageCrop` contiene [x, y, ancho, alto], valores entre 0 y 1 de la imagen compartida.

## En design.json

La portada y la carta completa se muestran en una sola página. `homeSections`
se conserva por compatibilidad, pero no limita ni selecciona los productos visibles.

En la carta, el botón Todos limpia búsqueda y filtros y muestra todos los productos,
incluidos los no disponibles (que se ven deshabilitados). La búsqueda y los filtros
siguen disponibles después para refinar la selección.

Las versiones de un plato se guardan por separado: normal, sin papas, sin cebolla,
etc. Las indicaciones aparecen tanto en el carrito como en el resumen. El pedido
se envia al servidor JSON cuando esta conectado. Salon lo recibe y lo envia a cocina.
