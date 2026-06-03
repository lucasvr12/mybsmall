import { NextResponse } from "next/server";
import { getAdminData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminData = await getAdminData();

    // Filter active items only
    const branches = adminData.branches.filter((b) => b.active);
    const services = adminData.services.filter((s) => s.active);
    const staff = adminData.staff.filter((s) => s.active);
    const staffBranches = adminData.staffBranches.filter((sb) => sb.active);
    const staffServices = adminData.staffServices.filter((ss) => ss.active);

    return NextResponse.json({
      branches,
      services,
      staff,
      staffBranches,
      staffServices,
    });
  } catch (error) {
    console.error("Config API error:", error);
    return NextResponse.json(
      { error: "Error al cargar la configuración de Google Sheets: " + error.message },
      { status: 500 }
    );
  }
}
