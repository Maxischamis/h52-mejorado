# Diseño y Carta

Web independiente, sin Base44 ni cuentas. Contiene los 177 productos importados en 13 categorías, con precios y extras. Inicio y Carta están en una sola página; favoritos es un filtro. Las fotos ilustrativas actuales están guardadas localmente y funcionan sin conexión. No son fotos reales del negocio ni de sus envases comerciales. El pedido es una demostración y no se envía a una cocina.

## Abrir

- `index.html`: abre la copia local, incluso sin conexión.
- `editor.html`: editor visual de marca, colores y productos con vista previa. También permite editar, importar y descargar los dos JSON.
- `Abrir.command`: en Mac, abre la web con un servidor local. Usa Node.js y Python 3, disponibles en esta máquina. Lee los dos JSON cada vez que se recarga la página.

El navegador no puede leer otros archivos JSON automáticamente cuando se abre un HTML con `file://`. Por eso esa modalidad usa `assets/offline-data.js`, una copia generada de los dos JSON. Después de editar los JSON, ejecutar `node build-data.mjs` actualiza esa copia. `Abrir.command` también la actualiza. El editor puede exportarla con “Copia para abrir sin servidor”. No editarla a mano.

## Los Dos JSON

### config/design.json

| Campo | Qué controla |
| --- | --- |
| `brand` | Nombre, subtítulo, título de pestaña y logo opcional. |
| `theme` | Diez colores, tipografías, radio de tarjetas y ancho de contenido. Colores `#RRGGBB`. |
| `hero` | Imagen, texto alternativo, títulos por línea, línea de acento, descripción, botón y posición de foto. |
| `navigation` | Nombres de las vistas. |
| `homeSections` | Campo conservado por compatibilidad; la página muestra siempre la carta completa. |
| `labels` | Textos de botones, búsqueda, fichas, estados vacíos, carrito y confirmación. |
| `order` | Idioma, moneda, servicio, mesas, máximo de unidades y clave de almacenamiento. |
| `footer` | Frase, texto pequeño y enlace. |

### config/products.json

`categories` contiene IDs únicos, nombres, subtítulos, iconos Lucide y orden. Se puede agregar o cambiar cualquier categoría sin editar JavaScript. El ID `all` está reservado.

Cada elemento de `products` tiene:

| Campo | Uso |
| --- | --- |
| `id` | Identificador único y estable. Se usa en favoritos, pedido y secciones. |
| `name`, `description` | Nombre y descripción completa. |
| `price` | Precio numérico sin símbolo de moneda. |
| `image`, `imageAlt` | Foto y descripción accesible. Las rutas locales empiezan con `assets/`. |
| `classification.categoryId` | ID de una categoría existente. |
| `classification.subcategory` | Clasificación adicional opcional. |
| `classification.tags` | Etiquetas para búsqueda y ficha. |
| `classification.dietary` | Etiquetas alimentarias declaradas por el negocio. |
| `available` | `false` deshabilita agregar y excluye ese producto del pedido guardado. |
| `featured` | Prioridad al ordenar destacados y en secciones automáticas. |
| `badge`, `order` | Insignia y orden de presentación. |
| `ingredients`, `allergens` | Listas informativas. `allergens: null` significa información pendiente. La web nunca afirma que un plato es libre de alérgenos por tener una lista vacía. |
| `serving` | Texto de porción o `null`. |
| `preparationMinutes`, `alcoholPercent` | Número o `null`. |

La búsqueda incluye nombres, descripciones, ingredientes, subcategorías, etiquetas y clasificación alimentaria. Las fichas se abren tocando el nombre o la foto. Los datos alimentarios faltantes del original se dejaron sin completar. Las fotos ilustrativas generadas se asignan por plato, topping, combo o familia de bebida. Para marcas comerciales se muestra el tipo de bebida, no un envase de otra marca. Reemplazarlas por fotos reales antes de publicar una carta comercial.

Las imágenes están en dos archivos compartidos dentro de `assets/`; cada producto selecciona su recorte mediante `imageCrop`. El editor elimina ese recorte al cambiar la ruta Imagen por una foto propia. `originalImage` conserva la URL anterior como referencia.

## Guardar Cambios Del Editor

La vista previa cambia en vivo. Para conservar los cambios, descargar `design.json` y `products.json` y reemplazar sus correspondientes archivos dentro de `config/`. El editor no modifica archivos del disco sin tu intervención. Para apertura directa del HTML, actualizar también la copia sin servidor como se explica arriba.

Al publicar, subir la carpeta completa a un hosting estático: la web consumirá directamente los dos JSON. No requiere compilación, paquetes ni Base44.

Foto de portada creada con ImageGen: Negroni en cristal tallado, naranja y romero sobre barra oscura, vaso a la derecha y espacio libre a la izquierda, fotografía editorial sin texto.
# Refinamiento de la app

La carta completa se muestra agrupada por tipo. Todos limpia filtros y
busqueda; ninguna cantidad de destacados limita la carta. Ver `EDITAR.md`.

Cada producto admite `customization.removable` (opciones para quitar) y
`customization.allowNote` (indicaciones escritas). Las personalizaciones se conservan
en el pedido y resumen; versiones distintas de un mismo producto son lineas separadas.
Los pedidos guardados del formato anterior se migran al cargarlos. Las opciones de
quitar no cambian el precio. Los extras pagos se suman por unidad y aparecen en
el carrito y resumen. Se conservan los ingredientes, alergenos y clasificación del archivo importado.

Las fichas de producto tienen foto amplia, favoritos, datos de alergenos y selector
de cantidad con precio total antes de agregar al pedido. Se respeta el limite por
producto configurado en el JSON. En celular, la ficha se abre como panel inferior.
El resumen del pedido permanece accesible al recorrer pedidos largos.

El editor guarda un borrador valido en este navegador y ofrece recuperarlo al volver
a abrirlo. Ese borrador no reemplaza los JSON: los archivos exportados siguen siendo
la configuracion de la app. La paleta indica la relacion de contraste para texto y
botones; los carritos de vista previa se guardan separados del carrito de la web.

La navegacion inferior fue reemplazada por un menu desplegable en el encabezado.
La carta tiene categorias compactas fijas al desplazarse, titulos por categoria y
fotos sin marcos adicionales. El pedido flotante aparece solo cuando hay productos.

El editor incorpora tres paletas, colores hexadecimales, historial de deshacer y
rehacer, paneles plegables, edicion y creacion de categorias, duplicado de productos,
textos de la portada y de la carta. La vista previa permite
elegir inicio/carta y escritorio/tablet/celular. Los cambios del editor
son temporales hasta exportar y reemplazar los JSON correspondientes.

La carta incluye vistas de grilla y lista, filtros de disponibilidad y destacados,
borrado rapido de busqueda y cantidades visibles en cada producto. Las preferencias
alimentarias se muestran como filtro cuando los productos tienen valores en
`classification.dietary`; no se infieren restricciones ni alergenos.
La mesa y la vista elegida se recuerdan en este navegador. Los textos nuevos se
editan en `design.json`, dentro de `labels`.

