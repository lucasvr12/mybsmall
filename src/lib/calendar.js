import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

let cachedAuth = null;
function getAuthClient() {
  if (cachedAuth) return cachedAuth;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.trim();
    if (privateKey.startsWith('"')) {
      privateKey = privateKey.substring(1);
    }
    if (privateKey.endsWith('"')) {
      privateKey = privateKey.substring(0, privateKey.length - 1);
    }
    if (privateKey.startsWith("'")) {
      privateKey = privateKey.substring(1);
    }
    if (privateKey.endsWith("'")) {
      privateKey = privateKey.substring(0, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account credentials in environment variables");
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

export async function getCalendarClient() {
  const auth = getAuthClient();
  return google.calendar({ version: "v3", auth });
}

/**
 * Creates an event in the Google Calendar of the selected branch.
 * Falls back to GOOGLE_CALENDAR_ID_GENERAL if no branch calendar ID is provided.
 */
export async function createCalendarEvent(branchCalendarId, appt) {
  const calendarId = branchCalendarId || process.env.GOOGLE_CALENDAR_ID_GENERAL;

  if (!calendarId) {
    console.warn("No calendar ID configured, skipping calendar event creation.");
    return { success: false, error: "Calendar ID missing" };
  }

  try {
    const calendar = await getCalendarClient();

    // Parse start date and time
    // date format: YYYY-MM-DD
    // time format: HH:MM
    const [hours, minutes] = appt.time.split(":").map(Number);
    const year = parseInt(appt.date.split("-")[0], 10);
    const month = parseInt(appt.date.split("-")[1], 10) - 1;
    const day = parseInt(appt.date.split("-")[2], 10);

    // Build startDate in local environment
    const startDate = new Date(year, month, day, hours, minutes, 0);
    // Add duration in minutes
    const endDate = new Date(startDate.getTime() + appt.durationMins * 60 * 1000);

    // Format local date strings manually to avoid UTC offset shifting in toISOString()
    const pad = (n) => String(n).padStart(2, "0");
    
    const startStr = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
    
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    const endHours = endDate.getHours();
    const endMinutes = endDate.getMinutes();
    const endStr = `${endYear}-${pad(endMonth)}-${pad(endDay)}T${pad(endHours)}:${pad(endMinutes)}:00`;

    const summary = `${appt.service} - ${appt.clientName}`;
    const description = `Cliente: ${appt.clientName}
Teléfono: ${appt.clientPhone}
Servicio: ${appt.service}
Sucursal: ${appt.branch}
Dirección: ${appt.address}
Estilista: ${appt.staff}
Duración: ${appt.durationMins} minutos`;

    const event = {
      summary,
      description,
      start: {
        dateTime: startStr,
        timeZone: "America/Monterrey", // Monterrey / Nuevo León local time
      },
      end: {
        dateTime: endStr,
        timeZone: "America/Monterrey",
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return { success: true, eventId: response.data.id };
  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    return { success: false, error: error.message };
  }
}
