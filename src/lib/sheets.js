import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// Cache the auth client to avoid re-creating it
let cachedAuth = null;
function getAuthClient() {
  if (cachedAuth) return cachedAuth;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account credentials in environment variables");
  }

  // Temporary debug check for Vercel formatting
  if (privateKey) {
    const cleaned = privateKey.replace(/\r/g, "");
    const hasHeader = cleaned.includes("-----BEGIN PRIVATE KEY-----");
    const hasFooter = cleaned.includes("-----END PRIVATE KEY-----");
    if (!hasHeader || !hasFooter) {
      throw new Error(`Key format check: length=${privateKey.length}, hasHeader=${hasHeader}, hasFooter=${hasFooter}, startsWith=${privateKey.substring(0, 20)}...`);
    }
  }

  cachedAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });

  return cachedAuth;
}

export async function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

// Convert cell value to boolean or standard format
function parseBool(val) {
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return str === "TRUE" || str === "SI" || str === "1" || str === "SÍ" || str === "YES";
}

/**
 * Fetch all configuration sheets from GOOGLE_SHEETS_ADMIN_ID in a single batch call.
 * This is highly optimized for performance and quota saving.
 */
export async function getAdminData() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ADMIN_ID;

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ADMIN_ID not configured");
  }

  const ranges = [
    "Sucursales!A:F",
    "Servicios!A:F",
    "Staff!A:E",
    "Staff_Sucursales!A:C",
    "Staff_Servicios!A:C",
    "Horarios!A:F",
    "Bloqueos!A:H",
  ];

  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });

    const valueRanges = response.data.valueRanges || [];

    // Parse Sucursales
    // id_sucursal, nombre_sucursal, direccion, whatsapp, calendar_id, activa
    const branchRows = valueRanges[0]?.values || [];
    const branches = branchRows.slice(1).map((row) => ({
      id: row[0] || "",
      name: row[1] || "",
      address: row[2] || "",
      whatsapp: row[3] || "",
      calendarId: row[4] || "",
      active: parseBool(row[5]),
    })).filter(b => b.id);

    // Parse Servicios
    // id_servicio, nombre_servicio, categoria, precio, duracion_minutos, activo
    const serviceRows = valueRanges[1]?.values || [];
    const services = serviceRows.slice(1).map((row) => ({
      id: row[0] || "",
      name: row[1] || "",
      category: row[2] || "",
      price: row[3] || "",
      durationMins: parseInt(row[4], 10) || 30,
      active: parseBool(row[5]),
    })).filter(s => s.id);

    // Parse Staff
    // id_staff, nombre, telefono, foto, activo
    const staffRows = valueRanges[2]?.values || [];
    const staff = staffRows.slice(1).map((row) => ({
      id: row[0] || "",
      name: row[1] || "",
      phone: row[2] || "",
      img: row[3] || "",
      active: parseBool(row[4]),
    })).filter(s => s.id);

    // Parse Staff_Sucursales
    // id_staff, id_sucursal, activo
    const staffBranchRows = valueRanges[3]?.values || [];
    const staffBranches = staffBranchRows.slice(1).map((row) => ({
      staffId: row[0] || "",
      branchId: row[1] || "",
      active: parseBool(row[2]),
    })).filter(sb => sb.staffId && sb.branchId);

    // Parse Staff_Servicios
    // id_staff, id_servicio, activo
    const staffServiceRows = valueRanges[4]?.values || [];
    const staffServices = staffServiceRows.slice(1).map((row) => ({
      staffId: row[0] || "",
      serviceId: row[1] || "",
      active: parseBool(row[2]),
    })).filter(ss => ss.staffId && ss.serviceId);

    // Parse Horarios
    // id_staff, id_sucursal, dia_semana, hora_inicio, hora_fin, activo
    const workingHoursRows = valueRanges[5]?.values || [];
    const schedules = workingHoursRows.slice(1).map((row) => ({
      staffId: row[0] || "",
      branchId: row[1] || "",
      dayOfWeek: String(row[2] || "").trim().toLowerCase(),
      startTime: row[3] || "",
      endTime: row[4] || "",
      active: parseBool(row[5]),
    })).filter(sh => sh.staffId && sh.branchId && sh.dayOfWeek);

    // Parse Bloqueos
    // tipo_bloqueo, id_staff, id_sucursal, fecha, hora_inicio, hora_fin, motivo, activo
    const blockRows = valueRanges[6]?.values || [];
    const blocks = blockRows.slice(1).map((row) => ({
      type: row[0] || "", // e.g. 'Completo', 'Parcial'
      staffId: row[1] || "", // can be empty if it blocks entire branch
      branchId: row[2] || "",
      date: row[3] || "", // e.g. YYYY-MM-DD
      startTime: row[4] || "",
      endTime: row[5] || "",
      reason: row[6] || "",
      active: parseBool(row[7]),
    })).filter(b => b.active);

    return {
      branches,
      services,
      staff,
      staffBranches,
      staffServices,
      schedules,
      blocks,
    };
  } catch (error) {
    console.error("Error reading admin sheets:", error);
    throw error;
  }
}

/**
 * Fetch all reservations from the dedicated GOOGLE_SHEETS_RESERVAS_ID sheet.
 */
export async function getReservations() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_RESERVAS_ID;

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_RESERVAS_ID not configured");
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Reservas!A:M",
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    // Parse columns:
    // id_reserva, fecha_cita, hora_cita, sucursal, direccion_sucursal, staff, servicio, duracion, precio, nombre_cliente, telefono_cliente, estado, fecha_creacion
    return rows.slice(1).map((row) => ({
      id: row[0] || "",
      date: row[1] || "",
      time: row[2] || "",
      branch: row[3] || "",
      address: row[4] || "",
      staff: row[5] || "",
      service: row[6] || "",
      durationMins: parseInt(row[7], 10) || 30,
      price: row[8] || "",
      clientName: row[9] || "",
      clientPhone: row[10] || "",
      status: row[11] || "Pendiente", // Confirmada, Pendiente, Cancelada
      createdAt: row[12] || "",
    }));
  } catch (error) {
    console.error("Error getting reservations from Sheets:", error);
    return [];
  }
}

/**
 * Write a new reservation to GOOGLE_SHEETS_RESERVAS_ID.
 */
export async function saveReservation(res) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_RESERVAS_ID;

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_RESERVAS_ID not configured");
  }

  // Row columns:
  // id_reserva, fecha_cita, hora_cita, sucursal, direccion_sucursal, staff, servicio, duracion, precio, nombre_cliente, telefono_cliente, estado, fecha_creacion
  const values = [
    [
      res.id,
      res.date,
      res.time,
      res.branch,
      res.address,
      res.staff,
      res.service,
      res.durationMins,
      res.price,
      res.clientName,
      res.clientPhone,
      res.status || "Confirmada",
      res.createdAt || new Date().toISOString(),
    ],
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Reservas!A:M",
      valueInputOption: "RAW",
      requestBody: { values },
    });
    return true;
  } catch (error) {
    console.error("Error appending reservation to Sheets:", error);
    throw error;
  }
}
