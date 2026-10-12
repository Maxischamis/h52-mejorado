# Diseño y Carta

Web independiente, sin Base44 ni cuentas. Contiene los 177 productos importados en 13 categorías, con precios y extras. Inicio y Carta están en una sola página; favoritos es un filtro. Las fotos ilustrativas actuales están guardadas localmente y funcionan sin conexión. No son fotos reales del negocio ni de sus envases comerciales. Los pedidos se guardan en un archivo JSON privado mediante el servidor incluido; mozos y cocina reciben actualizaciones en vivo.

## Abrir

- `index.html`: abre la copia local, incluso sin conexión.
- `mozo.html`: pantalla responsive para que los mozos reciban pedidos, revisen mesa/productos/cantidades/observaciones y los envíen a cocina.
- `cocina.html`: pantalla responsive para que cocina reciba sólo los pedidos enviados y marque preparación/listo.
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

## Pedidos Con Archivos JSON

No se usa base de datos. Un servidor Node.js 22 o superior guarda y edita `private-data/orders.json`. Los productos siguen en `config/products.json` y el editor conserva su funcionamiento.

Inicio:
```sh
H52_WAITER_PASSWORD='clave-larga-mozo' H52_KITCHEN_PASSWORD='clave-larga-cocina' node server.mjs
```

Abrir http://localhost:8787 para carta, /mozo.html para mozos y /cocina.html para cocina. Las claves se configuran en el servidor; nunca en JSON publico.

Para usar celulares, mantener el servidor encendido y acceder por su IP en la misma red. Para acceso desde Internet, alojar en un servidor con HTTPS y disco persistente. Configurar H52_SECURE_COOKIE=true en HTTPS. Usar una unica instancia: las escrituras se serializan y reemplazan el JSON de forma atomica. No escalar a varios procesos compartiendo el archivo.

GitHub Pages no ejecuta Node ni edita JSON. Se recomienda publicar carta y equipo en el mismo dominio del servidor. Si la carta queda en Pages, configurar apiUrl en config/backend.js y H52_ALLOWED_ORIGIN=https://maxischamis.github.io en el servidor; abrir las pantallas del equipo directamente en el dominio del servidor para evitar restricciones de cookies entre sitios.

H52_DATA_DIR cambia la carpeta de datos. Realizar copias de seguridad del JSON. Para editar manualmente orders.json, detener el servidor, editar un array JSON valido y reiniciar; el archivo se carga al inicio. Los estados se editan desde las pantallas y se guardan automaticamente. Nunca publicar pedidos, claves ni private-data en GitHub.

El servidor valida productos y precios usando el catalogo, evita duplicados por clientOrderId, restringe acciones por rol y transmite cambios con Server-Sent Events. Las sesiones duran 12 horas y se cierran al reiniciar. El limite por IP reduce spam; los pedidos publicos aun pueden requerir proteccion adicional en un despliegue abierto.

