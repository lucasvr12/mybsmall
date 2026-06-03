// Convert cell value to boolean or standard format
function parseBool(val) {
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return str === "TRUE" || str === "SI" || str === "1" || str === "SÍ" || str === "YES";
}

/**
 * Fetch all configuration sheets from GOOGLE_SHEETS_WEBAPP_URL.
 */
export async function getAdminData() {
  const webappUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;

  if (!webappUrl) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL not configured");
  }

  try {
    const response = await fetch(`${webappUrl}?action=config`, {
      cache: "no-store", // Ensure we bypass Next.js cache
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config from Apps Script: ${response.statusText}`);
    }

    const data = await response.json();
    const valueRanges = data.valueRanges || [];

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
    console.error("Error reading admin sheets via WebApp:", error);
    throw error;
  }
}

/**
 * Fetch all reservations from the WebApp.
 */
export async function getReservations() {
  const webappUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;

  if (!webappUrl) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL not configured");
  }

  try {
    const response = await fetch(`${webappUrl}?action=reservations`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reservations from Apps Script: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
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
    console.error("Error getting reservations from Sheets via WebApp:", error);
    return [];
  }
}

/**
 * Write a new reservation via WebApp.
 */
export async function saveReservation(res) {
  const webappUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;

  if (!webappUrl) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL not configured");
  }

  try {
    const response = await fetch(webappUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(res),
    });

    if (!response.ok) {
      throw new Error(`Failed to save reservation via Apps Script WebApp: ${response.statusText}`);
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Error appending reservation to Sheets via WebApp:", error);
    throw error;
  }
}
