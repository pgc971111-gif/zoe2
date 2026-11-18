# ZOE

Aplicación Next.js para investigar oportunidades digitales, evaluar su viabilidad y organizar planes de trabajo.

## Ejecutar en Windows

Requiere Node.js 20.9 o posterior. Desde PowerShell, en la carpeta del proyecto:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Abre <http://localhost:3000>.

Completa `.env` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, más las claves de proveedor que vayas a usar. RADAR y chat leen las claves solo desde `.env`, sin Vault ni inicio de sesión.

Para comprobar la compilación de producción:

```powershell
npm.cmd run build
npm.cmd run start
```

## GitHub y despliegue

GitHub guarda el código; hace falta conectar el repositorio a un host compatible con Next.js para ejecutar la aplicación. Configura allí las mismas variables de `.env.example` en el panel de variables del host. **No subas `.env` ni claves reales a GitHub**; `.env` está excluido por `.gitignore`.

Las migraciones del proyecto están en `supabase/migrations/`. Las tablas `oportunidades`, `procesos` y `tareas` ya existían en el proyecto Supabase comprobado. La migración `20261117_001_integraciones_vault.sql` crea `public.integraciones`, sus funciones y RLS, y habilita Supabase Vault si todavía no está activo. No modifica filas de las otras tablas ni guarda claves de proveedores.

### Estado del módulo de integraciones

La migración de Vault ya se ejecutó en el SQL Editor del proyecto Supabase. `public.integraciones` guarda metadatos y el identificador del secreto; Vault cifra el valor. Las funciones `list_integraciones`, `upsert_integracion_secret` y `get_integracion_secret` requieren sesión de Supabase Auth y filtran por el usuario conectado. El listado nunca devuelve el secreto.

La pantalla `/integraciones` documenta qué variables configurar en `.env`; ya no guarda ni consulta claves de proveedores. Nunca subas `.env` ni sus valores a GitHub.

El vínculo `owner_id` elimina los metadatos de la tabla si se borra una cuenta Auth; la credencial cifrada de Vault no se elimina automáticamente. La aplicación no incluye una acción para borrar integraciones. No se debe añadir limpieza de secretos o eliminación de cuenta sin revisar y autorizar ese comportamiento.

Las rutas `/api/radar` y `/api/chat` usan claves exclusivamente desde variables de entorno server-side y no requieren sesión de Supabase Auth. Supabase se sigue usando para persistir oportunidades y procesos.

#### Cambio de claves de proveedores a `.env` (2026-11-17)

Se eliminó la consulta de Supabase Vault en RADAR y chat, porque el flujo de uso personal no debe depender de una sesión Auth. Las llamadas de Oportunidades y Procesos tampoco requieren sesión; la pantalla Integraciones solo documenta las variables esperadas. Tras modificar `.env`, reinicia el servidor Next.js. Este cambio no borra las credenciales previamente guardadas en Vault.

RADAR intenta Tavily y luego Firecrawl si la primera búsqueda falla; después analiza los resultados con Gemini y Groq como respaldo.

#### Uso personal local sin inicio de sesión (2026-11-17)

Las llamadas desde Oportunidades envían sesión de forma opcional. El servidor usa primero las variables locales `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `GEMINI_API_KEY` y `GROQ_API_KEY`; las claves ausentes no exigen Auth y Vault se consulta solo con una sesión disponible. Verificación en instancia limpia: TypeScript/build correctos; la ruta dejó de bloquearse por Auth y reportó `Tavily: no se pudo conectar`. Para terminar una búsqueda real hace falta que el entorno pueda conectar a Tavily o que se configure una clave Firecrawl válida (la variable actual es marcador de ejemplo).

#### Siguientes etapas

1. Crear e iniciar sesión con una cuenta de la aplicación en `/integraciones`; guardar las claves de búsqueda e IA que se necesiten.
2. Completar y verificar el flujo con una clave guardada en Vault. No se ejecuta una búsqueda real al guardar una clave.
3. Añadir credenciales sociales reales en la pantalla. Los flujos OAuth de publicación o lectura de cuentas de Facebook, TikTok, Instagram y YouTube aún no están implementados.
4. Antes de borrar claves antiguas de `.env`, confirmar que ya se guardaron en Vault y que las rutas funcionan con la sesión autenticada.

#### Comprobaciones de APIs (2026-11-17)

- Tavily: `GET /usage` respondió HTTP 200; plan gratuito Researcher, 12/1000 créditos usados y `paygo=0`. Esta consulta no consumió créditos de búsqueda.
- Gemini: listado de modelos HTTP 200; no se generó texto.
- Groq: listado de modelos HTTP 200; no se generó texto.
- Firecrawl: su endpoint respondió HTTP 401 al usar `fc-TU_CLAVE_AQUI`; la clave configurada es un marcador, no una credencial válida.
- Facebook, TikTok, Instagram y YouTube: sin credenciales válidas disponibles; no se llamaron.
- Límite respetado: una llamada por proveedor comprobado, sin reintentos.

La compilación de producción y `tsc --noEmit --incremental false` finalizaron correctamente después de los cambios de esta etapa. La prueba local de producción devolvió HTTP 200 en `/integraciones`; los POST vacíos de `/api/chat` y `/api/radar` devolvieron HTTP 400 antes de consultar proveedores.

Referencias operativas: [Tavily Usage API](https://docs.tavily.com/documentation/api-reference/endpoint/usage), [Gemini models](https://ai.google.dev/gemini-api/docs/models) y [Groq List Models](https://console.groq.com/docs/api-reference).

Para aplicar la migración manualmente en otro entorno, abre el SQL Editor de Supabase y ejecuta el archivo indicado. Después crea o habilita el usuario de la aplicación en Supabase Auth. Las claves de proveedor se ingresan desde la aplicación una vez que la pantalla de Integraciones esté migrada; no las pegues en el SQL Editor ni las incluyas en GitHub.

## Límites de seguridad y coste

El acceso autenticado protege las rutas, pero todavía no hay un límite de solicitudes por usuario; una cuenta conectada puede consumir sus propias cuotas al usar búsqueda o IA. Mantén el despliegue privado durante las pruebas y revisa el uso de cada proveedor.

#### Ajuste de renderizado y verificación local final (2026-11-17)

La pantalla de Integraciones ahora muestra el formulario de acceso desde el HTML inicial y restaura la sesión de Supabase después de hidratarse. Esto evita que quede bloqueada en “Comprobando sesión…” si el navegador incrustado no completa la consulta de sesión. La consulta de sesión también tiene manejo de error y tiempo límite.

Verificación después de este ajuste: `npm.cmd run build` terminó con código 0 y la aplicación de producción respondió HTTP 200 en `http://127.0.0.1:3001/integraciones`; el HTML contiene “Iniciar sesión” y no contiene “Comprobando sesión”. El servidor local se dejó activo en el puerto 3001 para revisión manual. El puerto 3000 ya estaba ocupado por procesos existentes y no se terminaron.
