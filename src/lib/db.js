import { createPool } from "@vercel/postgres";

// Initialize Postgres connection pool supporting custom Vercel prefix "STORAGE_URL"
export const pool = createPool({
  connectionString: process.env.STORAGE_URL || process.env.POSTGRES_URL
});

// Helper to check if tables exist and initialize them if not
export async function initDb() {
  try {
    // 1. Create tables if they do not exist
    await pool.sql`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        calendar_id TEXT,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price TEXT NOT NULL,
        duration_mins INTEGER NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        img TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS staff_branches (
        staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
        branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
        active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (staff_id, branch_id)
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS staff_services (
        staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
        service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
        active BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (staff_id, service_id)
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
        branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS blocks (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
        branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        reason TEXT,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await pool.sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        branch TEXT NOT NULL,
        address TEXT NOT NULL,
        staff TEXT NOT NULL,
        service TEXT NOT NULL,
        duration_mins INTEGER NOT NULL,
        price TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Seed default data if branches table is empty
    const branchesCount = await pool.sql`SELECT COUNT(*) FROM branches;`;
    if (parseInt(branchesCount.rows[0].count, 10) === 0) {
      console.log("Seeding database with default values...");

      // Seed branches
      await pool.sql`
        INSERT INTO branches (id, name, address, whatsapp, calendar_id, active) VALUES
        ('carrizalejo', 'Carrizalejo', 'Avenida Manuel Gómez Morín 100, San Pedro Garza García, México, 66290', '528180262245', '', TRUE),
        ('mision', 'Misión del Valle', 'Alfonso Reyes 400 Local 30, San Pedro Garza García, México, 66230', '528180262245', '', TRUE),
        ('nacional', 'Carretera Nacional', 'Carretera Nacional 900 Plaza Palmares Sur Local 12, Monterrey, México, 64987', '528180262245', '', TRUE);
      `;

      // Seed staff
      await pool.sql`
        INSERT INTO staff (id, name, phone, img, active) VALUES
        ('edith', 'Edith', '8110000001', '/Staff/edith.jpg', TRUE),
        ('alicia', 'Alicia', '8110000002', '/Staff/aly.jpg', TRUE),
        ('laura_mision', 'Laura (Misión)', '8110000003', '/Staff/laura.jpg', TRUE),
        ('vera', 'Severa (Vera)', '8110000004', '/Staff/Vera.jpg', TRUE),
        ('elizabeth', 'Elizabeth', '8110000005', '/Staff/Eli.jpg', TRUE),
        ('sandy', 'Sandy', '8110000006', '/Staff/sandy.jpg', TRUE),
        ('carmen', 'Carmen', '8110000007', '/Staff/carmen.jpg', TRUE),
        ('cristina', 'Cristina', '8110000008', '/Staff/cristy.jpg', TRUE),
        ('monse', 'Monse', '8110000009', '/Staff/monse.jpg', TRUE),
        ('laura_nacional', 'Laura (Nacional)', '8110000010', '/Staff/laura.jpg', TRUE);
      `;

      // Seed staff_branches relations
      await pool.sql`
        INSERT INTO staff_branches (staff_id, branch_id, active) VALUES
        ('edith', 'mision', TRUE),
        ('alicia', 'mision', TRUE),
        ('laura_mision', 'mision', TRUE),
        ('vera', 'carrizalejo', TRUE),
        ('elizabeth', 'carrizalejo', TRUE),
        ('sandy', 'carrizalejo', TRUE),
        ('carmen', 'carrizalejo', TRUE),
        ('cristina', 'nacional', TRUE),
        ('monse', 'nacional', TRUE),
        ('laura_nacional', 'nacional', TRUE);
      `;

      // Seed services
      await pool.sql`
        INSERT INTO services (id, name, category, price, duration_mins, active) VALUES
        ('ninos', 'Corte Niños', 'HAIRSTUDIO', '$220', 30, TRUE),
        ('joven', 'Corte Joven', 'HAIRSTUDIO', '$260', 30, TRUE),
        ('adulto', 'Corte Adulto', 'HAIRSTUDIO', '$280', 30, TRUE),
        ('corte_maquina', 'Corte Máquina', 'HAIRSTUDIO', '$220', 20, TRUE),
        ('corte_express', 'Corte Express', 'HAIRSTUDIO', '$220', 20, TRUE),
        ('corte_mb', 'Corte MB Experience', 'HAIRSTUDIO', '$450', 60, TRUE),
        ('camuflaje_canas', 'Camuflaje de Canas', 'HAIRSTUDIO', '$390', 30, TRUE),
        ('camuflaje_barba', 'Camuflaje Barba', 'HAIRSTUDIO', '$240', 30, TRUE),
        ('medio_camuflaje_barba', 'Medio Camuflaje de Barba', 'HAIRSTUDIO', '$240', 30, TRUE),
        ('combo_camuflaje', 'Combo Camuflaje Barba y Cabellera', 'HAIRSTUDIO', '$530', 30, TRUE),
        ('limpieza_entre_cortes', 'Limpieza entre cortes', 'GROOMING', '$130', 15, TRUE),
        ('depilacion_espalda', 'Depilación de Espalda', 'GROOMING', 'Cotizar', 30, TRUE),
        ('depilacion_rostro', 'Depilación por área de rostro', 'GROOMING', '$130', 30, TRUE),
        ('recorte_vellos_espalda', 'Recorte vellos espalda', 'GROOMING', 'Cotizar', 45, TRUE),
        ('peinado', 'Peinado', 'GROOMING', '$130', 15, TRUE),
        ('traditional_shave', 'Traditional Shave', 'AFEITADO', '$260', 30, TRUE),
        ('rasurado_candado', 'Rasurado Candado', 'AFEITADO', '$260', 30, TRUE),
        ('rasurado_royal', 'Rasurado Royal', 'AFEITADO', '$440', 60, TRUE),
        ('limpieza_barba', 'Limpieza de Barba', 'AFEITADO', '$130', 10, TRUE),
        ('mascarilla_facial', 'Mascarilla Facial', 'SPA', '$240', 30, TRUE),
        ('facial_anti_fatiga', 'Facial Anti Fatiga', 'SPA', '$400', 60, TRUE),
        ('facial_royal', 'Facial Royal', 'SPA', '$560', 60, TRUE),
        ('facial_juvenil', 'Facial Juvenil', 'SPA', '$320', 60, TRUE),
        ('shampoo_vigorizante', 'Shampoo Vigorizante', 'SPA', '$280', 30, TRUE),
        ('manicure', 'Manicure', 'SPA', '$290', 30, TRUE),
        ('pedicure', 'Pedicure', 'SPA', '$420', 60, TRUE),
        ('pedicure_royal', 'Pedicure Royal', 'SPA', '$570', 60, TRUE),
        ('masaje_pies', 'Masaje de Pies', 'SPA', '$320', 30, TRUE),
        ('masaje_cabeza', 'Masaje Cabeza, Cuello y Hombros', 'SPA', '$420', 30, TRUE),
        ('masaje_relajante', 'Masaje Relajante', 'SPA', '$950', 50, TRUE),
        ('medio_masaje', 'Medio Masaje', 'SPA', '$480', 30, TRUE);
      `;

      // Seed staff_services (link all 10 staff to all 31 services)
      const staffList = ['edith', 'alicia', 'laura_mision', 'vera', 'elizabeth', 'sandy', 'carmen', 'cristina', 'monse', 'laura_nacional'];
      const serviceList = ['ninos', 'joven', 'adulto', 'corte_maquina', 'corte_express', 'corte_mb', 'camuflaje_canas', 'camuflaje_barba', 'medio_camuflaje_barba', 'combo_camuflaje', 'limpieza_entre_cortes', 'depilacion_espalda', 'depilacion_rostro', 'recorte_vellos_espalda', 'peinado', 'traditional_shave', 'rasurado_candado', 'rasurado_royal', 'limpieza_barba', 'mascarilla_facial', 'facial_anti_fatiga', 'facial_royal', 'facial_juvenil', 'shampoo_vigorizante', 'manicure', 'pedicure', 'pedicure_royal', 'masaje_pies', 'masaje_cabeza', 'masaje_relajante', 'medio_masaje'];
      
      for (const sId of staffList) {
        for (const svId of serviceList) {
          await pool.sql`INSERT INTO staff_services (staff_id, service_id, active) VALUES (${sId}, ${svId}, TRUE) ON CONFLICT DO NOTHING;`;
        }
      }

      // Seed schedules (09:00 - 19:00, Monday to Sunday for all staff branches relations)
      const relations = [
        { staffId: 'edith', branchId: 'mision' },
        { staffId: 'alicia', branchId: 'mision' },
        { staffId: 'laura_mision', branchId: 'mision' },
        { staffId: 'vera', branchId: 'carrizalejo' },
        { staffId: 'elizabeth', branchId: 'carrizalejo' },
        { staffId: 'sandy', branchId: 'carrizalejo' },
        { staffId: 'carmen', branchId: 'carrizalejo' },
        { staffId: 'cristina', branchId: 'nacional' },
        { staffId: 'monse', branchId: 'nacional' },
        { staffId: 'laura_nacional', branchId: 'nacional' }
      ];

      const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

      for (const rel of relations) {
        for (const day of days) {
          await pool.sql`
            INSERT INTO schedules (staff_id, branch_id, day_of_week, start_time, end_time, active)
            VALUES (${rel.staffId}, ${rel.branchId}, ${day}, '09:00', '19:00', TRUE);
          `;
        }
      }
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}
