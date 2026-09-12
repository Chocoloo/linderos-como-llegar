# Proveeduría Los Linderos — página de contacto

Página que se enlaza desde la bio de Instagram. Lleva al WhatsApp de la tienda y muestra
dirección, cómo llegar (Google Maps, Waze, Apple Maps) y horario.

- `index.html` — la página completa, sin dependencias externas (~9 KB, carga instantánea).
- `CNAME` — dominio propio: proveedurialoslinderos.com
- `probar.js` — la prueba de que sigue estando bien. Ver abajo.
- `piezas/` — maquetas para promocionarla en Instagram.

El indicador "Abierto ahora / Cerrado" se calcula en el navegador, siempre en hora de Chile.

Tienda: Panamericana Sur 4251, local 7, Los Linderos, Buin.
En el Centro Comercial Los Linderos, junto al Unimarc y la bencinera Shell.

## Dos horarios distintos, y no hay que confundirlos

La página muestra **el horario de la tienda** (lun-vie 10-19, sáb 10-18:30, dom 11-14, con
almuerzo de 14:00 a 14:30) y, aparte, **cuándo contesta el WhatsApp**, que es de **8:00 a
23:00** y es una franja más ancha. Un domingo a las 17:00 la tienda está cerrada y el chat
igual responde. Esa franja tiene que calzar con la del agente (Flujo D, nodo
`Extraer el mensaje`): si se mueve allá, hay que moverla acá.

## El botón verde solo va si el WhatsApp contesta

Es la regla que más veces se ha roto sola: promete un chat, y si nadie lo lee es peor que no
tenerlo. Ya se sacó dos veces —cuando Meta restringió el número en agosto y mientras el
agente no estaba conectado— y volvió el 2026-09-12, con el número ya conectado a Kapso.

Para sacarlo: borrar el enlace `#wsp` y devolverle al de llamada `class="principal telefono"`
y el texto «Llámanos». Está escrito también dentro del propio `index.html`.

## Probar antes de publicar

```sh
npm install playwright-core
node probar.js                              # el index.html de este directorio
node probar.js https://proveedurialoslinderos.com   # lo que está publicado
```

Abre la página en un Chrome de verdad, en tres teléfonos (iPhone SE, iPhone 14, Android
angosto) y a ocho horas distintas con el reloj congelado, y comprueba lo que se puede medir
en vez de mirarlo a ojo:

- que el botón de WhatsApp **entre en la primera pantalla**, incluso en el teléfono más chico
  (buena parte de las clientas son mayores y no hacen scroll);
- que cada área de toque llegue a **44 px** y ningún texto baje de **15 px**;
- el **contraste real** de cada texto contra su fondo real, con la meta puesta en 7:1;
- que a cada hora diga lo correcto: la tienda abierta o cerrada, y el chat «al tiro» o «a
  primera hora»;
- que Apple Maps aparezca solo en iPhone, que el mapa cargue y que no haya scroll lateral.

Sale con código 1 si algo incumple, y deja los pantallazos en `pantallazos/`.

Quedan dos avisos conocidos y aceptados: las iniciales **G** y **A** de los botones de Google
Maps y Apple Maps van sobre los colores de marca de cada uno (4,5:1 y 6,8:1). Cumplen el
mínimo de las pautas, no llegan a la meta de 7:1, y no se tocan porque el color **es** lo que
hace reconocible el botón — el nombre de la app va al lado, en negro sobre blanco. La W de
Waze sí se corrigió: el celeste es tan claro que la letra blanca daba 2,3:1.
