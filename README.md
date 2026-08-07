# Préstamo Claro

Aplicación web instalable para administrar un pequeño negocio de préstamos.

## Ejecutar localmente

Abra `index.html` en un navegador moderno. Para usarla como aplicación instalada, publíquela en cualquier servidor HTTPS estático y use la opción **Instalar app** del navegador.

## Publicar y compartir con GitHub Pages

1. En GitHub, crea un repositorio nuevo, por ejemplo `prestamo-claro`. Déjalo vacío (sin README ni `.gitignore`).
2. Sube **el contenido de esta carpeta** al repositorio; `index.html` debe quedar en la raíz, no dentro de otra carpeta.
3. En el repositorio, abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **GitHub Actions** como fuente.
5. Haz un cambio pequeño o vuelve a subir los archivos a la rama `main`. El flujo incluido publicará la aplicación automáticamente.
6. Espera a que termine la tarea **Publicar en GitHub Pages** en la pestaña **Actions**. La dirección pública aparecerá en **Settings → Pages** y tendrá una forma similar a `https://tu-usuario.github.io/prestamo-claro/`.

Después, comparte esa dirección con quien necesite abrir la aplicación. Cada persona tendrá sus propios datos locales: GitHub Pages publica la app, pero no sincroniza préstamos entre dispositivos.

### Actualizaciones automáticas

Cada vez que subas un cambio a la rama `main`, GitHub Pages volverá a publicar la aplicación automáticamente. Quien abra el enlace verá la versión nueva; si ya la tenía abierta o instalada, debe recargarla una vez. La aplicación también conserva una copia para poder abrirse sin conexión.

## Módulos incluidos

- Clientes y sus datos de contacto.
- Préstamos/facturas, capital, interés, saldo y estado.
- Cuentas por cobrar y pagos vencidos.
- Agenda y calendario mensual de próximos pagos.
- Registro histórico de cobros.
- Recibo de pago imprimible/descargable y envío por WhatsApp.
- Copias de seguridad en JSON y restauración validada.

## Arquitectura

Es una PWA estática, sin servicios externos ni bases de datos en la nube:

`index.html` contiene la estructura, `styles.css` la interfaz y `app.js` las reglas del negocio. Los datos se guardan en `localStorage` del navegador; las funciones de respaldo permiten migrarlos a otro equipo. Para un entorno multiusuario, se puede sustituir esa capa de almacenamiento por una API autenticada, sin cambiar la interfaz.

## Consideración importante

Los datos de esta versión quedan ligados al navegador/dispositivo hasta que se descargue una copia. Realice copias de seguridad periódicas, especialmente antes de borrar datos del navegador o cambiar de equipo.
