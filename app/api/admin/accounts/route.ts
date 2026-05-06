import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient as createServerClient,
} from "@/lib/supabase/server";

const ACCOUNT_ROLES = ["Admin", "Driver", "Pengguna umum"] as const;
const SUPABASE_ADMIN_CONFIG_MESSAGE =
  "Create/update/delete akun membutuhkan SUPABASE_SERVICE_ROLE_KEY yang valid. Pastikan .env.local memakai service_role key dari Supabase Project Settings, lalu restart dev server.";
const SUPABASE_BEARER_TOKEN_ERROR = "valid Bearer token";

type AccountRole = (typeof ACCOUNT_ROLES)[number];

type CreateAccountBody = {
  name?: string;
  email?: string;
  role?: AccountRole;
  password?: string;
  buggy_id?: string;
};

type UpdateAccountBody = CreateAccountBody & {
  id?: string;
};

type DeleteAccountBody = {
  id?: string;
};

type AccountRow = {
  id: string;
  name: string | null;
  role: AccountRole | null;
  buggy_id: string | null;
  created_at?: string | null;
};

function isAccountRole(value: unknown): value is AccountRole {
  return ACCOUNT_ROLES.includes(value as AccountRole);
}

function normalizeAccount(row: AccountRow, email = "") {
  const name = row.name?.trim() || email.split("@")[0] || "User";

  return {
    id: row.id,
    name,
    email,
    role: row.role ?? "Pengguna umum",
    buggy_id: row.buggy_id ?? null,
    created_at: row.created_at ?? null,
    avatar: name.charAt(0).toUpperCase(),
  };
}

function formatSupabaseAdminError(message?: string) {
  if (!message || message.includes(SUPABASE_BEARER_TOKEN_ERROR)) {
    return SUPABASE_ADMIN_CONFIG_MESSAGE;
  }

  return message;
}

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { message: SUPABASE_ADMIN_CONFIG_MESSAGE },
      { status: 500 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, role, buggy_id")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      accounts: ((data ?? []) as AccountRow[]).map((row) =>
        normalizeAccount(row),
      ),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { message: SUPABASE_ADMIN_CONFIG_MESSAGE },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as CreateAccountBody;
    const { name, email, role, password, buggy_id } = body;

    if (!email || !password || !name || !isAccountRole(role)) {
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
      return NextResponse.json(
        { message: formatSupabaseAdminError(authError?.message) },
        { status: 400 },
      );
    }

    const userId = authData.user.id;

    // Tunggu sesaat agar trigger di Supabase selesai mengeksekusi insert ke tabel accounts
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update role dan buggy_id di public.accounts (row sudah dibuat oleh trigger).
    const updateData: {
      role?: CreateAccountBody["role"];
      name: string;
      buggy_id: string | null;
    } = {
      role,
      name,
      buggy_id: role === "Driver" ? buggy_id || null : null,
    };

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

export async function PATCH(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { message: SUPABASE_ADMIN_CONFIG_MESSAGE },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as UpdateAccountBody;
    const { id, name, email, role, password, buggy_id } = body;

    if (!id || !name?.trim() || !isAccountRole(role)) {
      return NextResponse.json(
        { message: "ID, nama, dan role wajib diisi." },
        { status: 400 },
      );
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user?.id === id && role !== "Admin") {
      return NextResponse.json(
        { message: "Role akun admin yang sedang aktif tidak dapat diubah." },
        { status: 400 },
      );
    }

    const trimmedEmail = email?.trim() ?? "";
    const trimmedPassword = password?.trim() ?? "";

    const authUpdate: {
      email?: string;
      password?: string;
      user_metadata: { full_name: string };
    } = {
      user_metadata: { full_name: name.trim() },
    };

    if (trimmedEmail) {
      authUpdate.email = trimmedEmail;
    }

    if (trimmedPassword) {
      authUpdate.password = trimmedPassword;
    }

    if (trimmedEmail || trimmedPassword) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        id,
        authUpdate,
      );

      if (authError) {
        return NextResponse.json(
          {
            message: formatSupabaseAdminError(authError.message),
          },
          { status: 400 },
        );
      }
    }

    const updateData = {
      name: name.trim(),
      role,
      buggy_id: role === "Driver" ? buggy_id || null : null,
    };

    const { data, error } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", id)
      .select("id, name, role, buggy_id")
      .single();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      account: normalizeAccount(data as AccountRow, trimmedEmail),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { message: SUPABASE_ADMIN_CONFIG_MESSAGE },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as DeleteAccountBody;
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "ID akun wajib diisi." },
        { status: 400 },
      );
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user?.id === id) {
      return NextResponse.json(
        { message: "Akun admin yang sedang aktif tidak dapat dihapus." },
        { status: 400 },
      );
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) {
      return NextResponse.json(
        { message: formatSupabaseAdminError(authError.message) },
        { status: 400 },
      );
    }

    const { error: accountError } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id);

    if (accountError) {
      return NextResponse.json(
        {
          message:
            "Akun auth berhasil dihapus, tapi profil akun gagal dibersihkan: " +
            accountError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Akun berhasil dihapus." });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      },
      { status: 500 },
    );
  }
}
