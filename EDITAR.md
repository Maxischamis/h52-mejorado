# Editar sin complicaciones

## Con el editor

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
sigue siendo de demostración: no se envía a cocina.
