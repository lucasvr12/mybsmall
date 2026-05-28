# Men & Boys - Reservas con Google Sheets (Versión Compacta)

Esta es la nueva versión espejo, compacta y simplificada del sistema de reservaciones de **Men & Boys**. Está diseñada para operar de forma 100% independiente, utilizando un backend sin servidor basado en **Next.js** y conectándose de manera directa a **Google Sheets** (como base de datos y panel administrativo) y **Google Calendar** (como visualizador de agenda por sucursal).

---

## 1. Qué Hace esta Versión

Esta versión elimina la complejidad del portal administrativo anterior, los portales de estilistas (staff), los accesos con usuario/contraseña, los dashboards y la base de datos PostgreSQL en la nube. 

Toda la administración del negocio (sucursales, servicios, personal, turnos laborables, bloqueos) y la visualización de las reservas entrantes se controlan directamente desde un archivo de **Google Sheets**. La aplicación web se encarga únicamente de guiar al cliente por un flujo interactivo rápido y optimizado para móviles (5 pasos) para asegurar y registrar su cita:

1.  **Elección de sucursal** (Solo activas).
2.  **Selección de barbero/estilista** (Que trabaje en la sucursal seleccionada o asignación automática).
3.  **Selección de servicio** (Que realice el barbero seleccionado, agrupado por categorías).
4.  **Selección de fecha y hora** (Slots calculados en tiempo real según el horario del barbero, reservas y bloqueos).
5.  **Registro de datos personales** (Nombre y teléfono de 10 dígitos).
6.  **Confirmación con redirección rápida a WhatsApp** (Link prellenado dirigido al número específico de la sucursal seleccionada).

---

## 2. Archivos Creados

Todos los archivos se han creado de forma aislada e independiente en la carpeta `/men-boys-reservas-sheets/`:

*   **Configuraciones de Entorno e Integración:**
    *   `.env.local` - Almacena las variables de entorno de Google APIs sin exponerlas al cliente.
    *   `package.json`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`, `next.config.mjs` - Habilitan el motor Next.js y los estilos oscuros premium del portal original.
    *   `public/` - Copia completa del logotipo, retratos del personal (`Staff/`) y fachadas de sucursales (`branches/`).
*   **Librerías del Servidor (`src/lib/`):**
    *   `sheets.js` - Conexión de lectura en lote (`batchGet`) del Google Sheet de Administración e inserción (`append`) en el Google Sheet de Reservas.
    *   `calendar.js` - Conexión con la API de Google Calendar utilizando cuentas de servicio para insertar eventos automáticos.
*   **API Routes (`src/app/api/`):**
    *   `api/config/route.js` - Retorna los catálogos activos cargados de Google Sheets.
    *   `api/availability/route.js` - Endpoint dinámico que calcula los horarios libres de acuerdo a las reglas de negocio en la zona horaria de Monterrey.
    *   `api/appointments/route.js` - Registra la reserva en Google Sheets y en Google Calendar, implementando prevención estricta de doble reservación.
*   **Frontend del Portal (`src/app/`):**
    *   `layout.js` y `globals.css` - Estilos corporativos con cabecera simplificada sin rutas del sistema anterior.
    *   `page.js` - Formulario reactivo paso a paso enfocado en celular con animaciones y transiciones suaves.

---

## 3. Conexión a Google Sheets y Estructura

El sistema se conecta a **dos archivos independientes de Google Sheets** a través del correo de la cuenta de servicio de Google Cloud. Debe compartir ambos archivos con el correo de la cuenta de servicio (con permisos de **Editor**).

### Estructura de Google Sheets de Administración
Este archivo almacena toda la configuración y catálogos. Debe tener las siguientes 7 hojas:

1.  **Sucursales:**
    *   *Columnas:* `id_sucursal`, `nombre_sucursal`, `direccion`, `whatsapp`, `calendar_id`, `activa`
    *   * whatsapp:* Número de WhatsApp de la sucursal en formato internacional sin símbolos (ej. `528180262245`).
    *   * calendar_id:* ID del Google Calendar de esta sucursal (ej. `sucursal1@group.calendar.google.com`).
    *   * activa:* `TRUE` / `SI` o `FALSE` / `NO`.
2.  **Servicios:**
    *   *Columnas:* `id_servicio`, `nombre_servicio`, `categoria`, `precio`, `duracion_minutos`, `activo`
3.  **Staff:**
    *   *Columnas:* `id_staff`, `nombre`, `telefono`, `foto`, `activo`
4.  **Staff_Sucursales:**
    *   *Columnas:* `id_staff`, `id_sucursal`, `activo`
5.  **Staff_Servicios:**
    *   *Columnas:* `id_staff`, `id_servicio`, `activo`
6.  **Horarios:**
    *   *Columnas:* `id_staff`, `id_sucursal`, `dia_semana`, `hora_inicio`, `hora_fin`, `activo`
    *   * dia_semana:* `lunes`, `martes`, `miércoles`, `jueves`, `viernes`, `sábado`, `domingo` (en minúsculas).
7.  **Bloqueos:**
    *   *Columnas:* `tipo_bloqueo`, `id_staff`, `id_sucursal`, `fecha`, `hora_inicio`, `hora_fin`, `motivo`, `activo`
    *   * tipo_bloqueo:* `Completo` (bloquea todo el día) o `Parcial` (bloquea rango de horas).
    *   * fecha:* En formato `YYYY-MM-DD`.

### Estructura de Google Sheets de Reservas
Este archivo contiene una única hoja encargada de almacenar las citas creadas:

1.  **Reservas:**
    *   *Columnas:* `id_reserva`, `fecha_cita`, `hora_cita`, `sucursal`, `direccion_sucursal`, `staff`, `servicio`, `duracion`, `precio`, `nombre_cliente`, `telefono_cliente`, `estado`, `fecha_creacion`
    *   * estado:* El sistema escribe `Confirmada` por defecto. Si el administrador cambia este valor a `Cancelada` desde el Sheets, ese horario se liberará automáticamente en el sitio.

---

## 4. Conexión a Google Calendar

Para cada sucursal activa, el administrador debe crear un calendario de Google y obtener su **Calendar ID** (se encuentra en los Ajustes del Calendario > Integrar Calendario > ID de Calendario). 
*   **Compartir calendario:** Comparta cada calendario de Google con el correo de la cuenta de servicio de Google Cloud asignándole el permiso **Hacer cambios en eventos** (Make changes to events).
*   Copie cada **Calendar ID** en la columna `calendar_id` de la hoja `Sucursales` del Google Sheet de Administración.
*   **Calendario de Respaldo:** Si una sucursal no tiene calendar_id configurado, se utilizará el calendario general definido en `GOOGLE_CALENDAR_ID_GENERAL`.

---

## 5. Variables de Entorno Requeridas

Configure las siguientes variables de entorno en el archivo `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=calendarbot@men-and-boys-citas.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG...-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ADMIN_ID=1TKQFGrkCJ9_-_3RWWsHgs9nWH_yVP0vCEOf2_QHN17c
GOOGLE_SHEETS_RESERVAS_ID=ID_DEL_OTRO_SHEET_DE_RESERVAS
GOOGLE_CALENDAR_ID_GENERAL=87e75f4bdbe82266d11389e6a12cb51684857de5aa8fcf3b5819a76dd827917d@group.calendar.google.com
```

---

## 6. Lógica de Bloqueo de Horarios y Doble Reserva

1.  **Cálculo de Disponibilidad:**
    *   El sistema genera slots de 30 minutos según los turnos de la hoja `Horarios` del día de la semana correspondiente.
    *   Se restan los horarios que se encuentren dentro de algún intervalo de la hoja `Bloqueos` para ese estilista o para toda la sucursal.
    *   Se consultan las reservas activas (cuyo estado no sea 'Cancelada') de la hoja `Reservas` para ese estilista y fecha.
    *   **Bloqueo por Duración:** Si un servicio dura $N$ minutos y inicia a las 12:00, se bloquea el rango completo (ej: de 12:00 a 13:00) para ese estilista, impidiendo que otro cliente reserve un corte de 30 minutos a las 12:30.
2.  **Prevención de Colisión:**
    *   Dos clientes pueden estar viendo el mismo horario libre simultáneamente.
    *   Cuando el cliente A presiona "Confirmar cita", el backend verifica la disponibilidad de ese slot exacto de forma síncrona. Si el horario sigue libre, se escribe en Google Sheets y se crea en Google Calendar.
    *   Si el cliente B presiona "Confirmar" una décima de segundo después para el mismo horario y estilista, la validación del backend detectará que el horario ya está ocupado. El sistema cancelará la operación de B y le mostrará en pantalla el mensaje: *“Este horario acaba de ser reservado. Por favor selecciona otro horario.”*, regresándolo de forma segura al calendario sin duplicar turnos.

---

## 7. Funcionamiento del Botón de WhatsApp

*   El número de WhatsApp de destino se lee directamente del Google Sheet (`whatsapp` en la hoja `Sucursales`) para la sucursal seleccionada por el cliente.
*   **Formato del Teléfono:** Debe ingresarse en formato internacional puro, sin espacios, guiones ni el signo `+` (ej. `528180262245`).
*   **Mensaje Codificado:** Al confirmarse la reserva, el portal genera un enlace tipo:
    `https://wa.me/{{whatsapp_sucursal}}?text={{mensaje_codificado}}`
    donde el mensaje se codifica usando `encodeURIComponent` e incluye el resumen detallado (Nombre, Teléfono, Sucursal, Dirección, Estilista, Servicio, Fecha, Hora y Duración).
*   **Acción del Botón:** Se abre en una nueva pestaña. El cliente solo revisa el texto prellenado en su WhatsApp y presiona "Enviar". No requiere de integraciones pagas de WhatsApp Business API ni intervención del servidor.
*   **Comportamiento Sin Configuración:** Si no hay número de WhatsApp en la sucursal, se muestra un mensaje informativo sugiriendo contactar directamente a recepción.
