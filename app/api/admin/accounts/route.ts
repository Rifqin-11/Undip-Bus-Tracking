import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ message: "Supabase admin client not initialized" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, username, role, password } = body;

    if (!username || !password || !name) {
      return NextResponse.json({ message: "Nama, username, dan password wajib diisi." }, { status: 400 });
    }

    // Karena Supabase Auth butuh email, kita format username jadi email jika belum format email
    const email = username.includes("@") ? username : `${username}@simobi.local`;

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

    // Update role dan username di public.accounts (row sudah dibuat oleh trigger)
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ role, username, name })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json(
        { message: "Akun auth dibuat, tapi gagal mengupdate profil: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Akun berhasil dibuat", user: authData.user }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
