import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type CreateAccountBody = {
  name?: string;
  email?: string;
  role?: "Admin" | "Driver" | "Pengguna umum";
  password?: string;
  buggy_id?: string;
};

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase admin client not initialized" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as CreateAccountBody;
    const { name, email, role, password, buggy_id } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ message: "Nama, email, dan password wajib diisi." }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ message: authError?.message || "Gagal membuat akun" }, { status: 400 });
    }

    const userId = authData.user.id;

    // Tunggu sesaat agar trigger di Supabase selesai mengeksekusi insert ke tabel accounts
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update role, email dan buggy_id di public.accounts (row sudah dibuat oleh trigger)
    const updateData: {
      role?: CreateAccountBody["role"];
      email: string;
      name: string;
      buggy_id?: string;
    } = { role, email, name };
    if (role === "Driver" && buggy_id) {
      updateData.buggy_id = buggy_id;
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json(
        { message: "Akun auth dibuat, tapi gagal mengupdate profil: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Akun berhasil dibuat", user: authData.user }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      },
      { status: 500 },
    );
  }
}
