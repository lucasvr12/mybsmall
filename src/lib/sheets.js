import { pool, initDb } from "./db";

/**
 * Fetch all configuration catalogs from Postgres.
 */
export async function getAdminData() {
  // Ensure tables are initialized and seeded
  await initDb();

  try {
    const [
      branchesResult,
      servicesResult,
      staffResult,
      staffBranchesResult,
      staffServicesResult,
      schedulesResult,
      blocksResult,
    ] = await Promise.all([
      pool.sql`SELECT * FROM branches;`,
      pool.sql`SELECT * FROM services;`,
      pool.sql`SELECT * FROM staff;`,
      pool.sql`SELECT * FROM staff_branches;`,
      pool.sql`SELECT * FROM staff_services;`,
      pool.sql`SELECT * FROM schedules;`,
      pool.sql`SELECT * FROM blocks WHERE active = TRUE;`,
    ]);

    const branches = branchesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      whatsapp: row.whatsapp,
      calendarId: row.calendar_id || "",
      active: row.active,
    }));

    const services = servicesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      durationMins: row.duration_mins,
      active: row.active,
    }));

    const staff = staffResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      img: row.img,
      active: row.active,
    }));

    const staffBranches = staffBranchesResult.rows.map((row) => ({
      staffId: row.staff_id,
      branchId: row.branch_id,
      active: row.active,
    }));

    const staffServices = staffServicesResult.rows.map((row) => ({
      staffId: row.staff_id,
      serviceId: row.service_id,
      active: row.active,
    }));

    const schedules = schedulesResult.rows.map((row) => ({
      staffId: row.staff_id,
      branchId: row.branch_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      active: row.active,
    }));

    const blocks = blocksResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      staffId: row.staff_id || "",
      branchId: row.branch_id,
      date: row.date,
      startTime: row.start_time || "",
      endTime: row.end_time || "",
      reason: row.reason || "",
      active: row.active,
    }));

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
    console.error("Error reading admin data from Postgres:", error);
    throw error;
  }
}

/**
 * Fetch all reservations from Postgres.
 */
export async function getReservations() {
  await initDb();

  try {
    const result = await pool.sql`SELECT * FROM appointments ORDER BY date ASC, time ASC;`;
    
    return result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      time: row.time,
      branch: row.branch,
      address: row.address,
      staff: row.staff,
      service: row.service,
      durationMins: row.duration_mins,
      price: row.price,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    }));
  } catch (error) {
    console.error("Error getting reservations from Postgres:", error);
    return [];
  }
}

/**
 * Write a new reservation to Postgres.
 */
export async function saveReservation(res) {
  await initDb();

  try {
    const createdAt = res.createdAt || new Date().toISOString();
    
    await pool.sql`
      INSERT INTO appointments (
        id, date, time, branch, address, staff, service, duration_mins, price, client_name, client_phone, status, created_at
      ) VALUES (
        ${res.id}, 
        ${res.date}, 
        ${res.time}, 
        ${res.branch}, 
        ${res.address}, 
        ${res.staff}, 
        ${res.service}, 
        ${res.durationMins}, 
        ${res.price}, 
        ${res.clientName}, 
        ${res.clientPhone}, 
        ${res.status || "Confirmada"}, 
        ${createdAt}
      );
    `;
    return true;
  } catch (error) {
    console.error("Error saving reservation to Postgres:", error);
    throw error;
  }
}
