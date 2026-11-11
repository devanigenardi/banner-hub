# Banner Hub

Herramienta de Assemble para revisar banners HTML5, locales o en servidor.

- **Compare**: carga dos banners y los arranca al mismo tiempo.
- **Timer**: cuenta la duración de un banner y permite marcar tiempos.
- **ISI expander**: muestra solo el ISI del banner, ampliado.

## Instalar como extensión de Chrome

1. Descarga o clona esta carpeta.
2. Abre `chrome://extensions` y activa **Modo de desarrollador**.
3. Clic en **Cargar descomprimida** y elige la carpeta.
4. En **Detalles**, activa **Permitir el acceso a las URL de archivo** (necesario para banners locales).
5. Abre Banner Hub desde el ícono de la extensión.

Después de actualizar la carpeta, recarga la extensión con la flecha circular en `chrome://extensions`.

## Publicar una versión

1. Sube el número de `version` en `manifest.json` y el de `EXPECTED_VERSION` en `js/main.js` (deben ser iguales).
2. Ejecuta `./build.sh`. Genera `dist/banner-hub-<version>.zip`.
3. Sube ese zip en el panel de desarrollador de la Chrome Web Store.

`banenrs-prueba/` contiene banners de prueba y no se incluye en el zip.
