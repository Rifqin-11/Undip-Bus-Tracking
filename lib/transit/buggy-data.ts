import type { Buggy, CrowdLevel, HaltePoint } from "@/types/buggy";

// ─── Campus center ────────────────────────────────────────────────────────────

export const CENTER_UNDIP: [number, number] = [-7.0505, 110.44];

// ─── Halte (stop) locations ───────────────────────────────────────────────────

export const HALTE_LOCATIONS: HaltePoint[] = [
  {
    id: "h01",
    name: "Rusunawa Undip",
    lat: -7.054518537168431,
    lng: 110.44413919120406,
  },
  {
    id: "h02",
    name: "Masjid Hijau Sigawe",
    lat: -7.056254910600861,
    lng: 110.44003763725826,
  },
  {
    id: "h03",
    name: "Pos Satpam Astina Undip",
    lat: -7.055335586528005,
    lng: 110.43929330859879,
  },
  {
    id: "h04",
    name: "Student Center",
    lat: -7.053615652182,
    lng: 110.43919618890992,
  },
  {
    id: "h05",
    name: "Teknik Arsitektur",
    lat: -7.052103865215362,
    lng: 110.43808378253539,
  },
  {
    id: "h06",
    name: "Fakultas Hukum & Fisip",
    lat: -7.050873236387066,
    lng: 110.43718416935035,
  },
  {
    id: "h07",
    name: "Sekolah Vokasi & FIB",
    lat: -7.050370746018777,
    lng: 110.43609972172088,
  },
  {
    id: "h08",
    name: "Widya Puraya",
    lat: -7.049832325888632,
    lng: 110.43849680096805,
  },
  {
    id: "h09",
    name: "Teknik Elektro",
    lat: -7.049445426133159,
    lng: 110.43980141026086,
  },
  {
    id: "h10",
    name: "SA-MWA & FSM Barat",
    lat: -7.048677336244937,
    lng: 110.44021522652281,
  },
  {
    id: "h11",
    name: "Fakultas Psikologi",
    lat: -7.04713778936035,
    lng: 110.43869200447789,
  },
  {
    id: "h12",
    name: "Halte Trans Semarang Psikologi",
    lat: -7.046914956352711,
    lng: 110.43875327893443,
  },
  {
    id: "h13",
    name: "Fakultas Ekonomika dan Bisnis",
    lat: -7.047569654368096,
    lng: 110.44101030995277,
  },
  {
    id: "h14",
    name: "Fakultas Kesehatan Masyarakat",
    lat: -7.048907407951046,
    lng: 110.44252222022146,
  },
  {
    id: "h15",
    name: "Fakultas Perikanan dan Kelautan",
    lat: -7.050684864323637,
    lng: 110.4420491664416,
  },
  {
    id: "h16",
    name: "Fakultas Peternakan dan Pertanian",
    lat: -7.053006517891536,
    lng: 110.44130798104808,
  },
  {
    id: "h17",
    name: "UPT Laboratorium Terpadu",
    lat: -7.0545419609050946,
    lng: 110.43962946087483,
  },
  {
    id: "h18",
    name: "Bundaran Undip",
    lat: -7.055973568692425,
    lng: 110.43939589722012,
  },
];

// ─── Official route path (lat/lng waypoints along the full loop) ──────────────

export const OFFICIAL_ROUTE_PATH: [number, number][] = [
  [-7.05449, 110.4441325],
  [-7.0549159, 110.4431535],
  [-7.0549664, 110.4431079],
  [-7.0549931, 110.4430462],
  [-7.0549691, 110.4429925],
  [-7.0553679, 110.4423227],
  [-7.0561287, 110.4406712],
  [-7.0562112, 110.4404808],
  [-7.0562351, 110.4403816],
  [-7.0562538, 110.4402059],
  [-7.0562138, 110.439939],
  [-7.05613, 110.4394643],
  [-7.0560834, 110.4393248],
  [-7.0560901, 110.4392819],
  [-7.0560714, 110.4392322],
  [-7.0560195, 110.4392296],
  [-7.0559703, 110.4392671],
  [-7.0558372, 110.4392778],
  [-7.0556189, 110.4393167],
  [-7.0536664, 110.4396346],
  [-7.0536025, 110.4394146],
  [-7.053544, 110.439074],
  [-7.0534907, 110.4388594],
  [-7.0533257, 110.4386153],
  [-7.0532032, 110.4385027],
  [-7.0528279, 110.4383793],
  [-7.0524925, 110.438272],
  [-7.0520746, 110.4380923],
  [-7.0514251, 110.4378241],
  [-7.0511509, 110.4377222],
  [-7.0509433, 110.4376095],
  [-7.0509379, 110.4375156],
  [-7.0508714, 110.437175],
  [-7.0508341, 110.436955],
  [-7.0508102, 110.4368317],
  [-7.0505173, 110.4358339],
  [-7.0504268, 110.435858],
  [-7.0505173, 110.4362818],
  [-7.0506398, 110.4367297],
  [-7.0506877, 110.4369819],
  [-7.0507649, 110.4372233],
  [-7.0508102, 110.4373493],
  [-7.0508128, 110.4374969],
  [-7.0507782, 110.4377007],
  [-7.0506398, 110.4378724],
  [-7.0504535, 110.4379662],
  [-7.0502139, 110.4380548],
  [-7.0501314, 110.4381245],
  [-7.0496096, 110.4390445],
  [-7.0495484, 110.439133],
  [-7.0494233, 110.4392564],
  [-7.0495484, 110.4397848],
  [-7.0494845, 110.4399457],
  [-7.0494153, 110.4400342],
  [-7.0479672, 110.440509],
  [-7.0476388, 110.4406277],
  [-7.0476089, 110.4405176],
  [-7.0474845, 110.4400307],
  [-7.0473448, 110.439478],
  [-7.0472438, 110.4392631],
  [-7.0472659, 110.439179],
  [-7.0472481, 110.4390948],
  [-7.0469602, 110.4381899],
  [-7.0469637, 110.4380011],
  [-7.0468896, 110.4380092],
  [-7.0468509, 110.4380198],
  [-7.0468572, 110.4381433],
  [-7.0468803, 110.4382931],
  [-7.0470476, 110.4388495],
  [-7.0470951, 110.4390545],
  [-7.0471254, 110.4392014],
  [-7.0472179, 110.4392778],
  [-7.0473177, 110.4394897],
  [-7.0475706, 110.4404888],
  [-7.0481136, 110.4423704],
  [-7.0482121, 110.4426467],
  [-7.0482547, 110.4426896],
  [-7.0492077, 110.442416],
  [-7.0495431, 110.442349],
  [-7.0501101, 110.4421746],
  [-7.0507969, 110.4419681],
  [-7.0514597, 110.4417616],
  [-7.0517711, 110.441657],
  [-7.0523594, 110.4414907],
  [-7.0530994, 110.4412359],
  [-7.0534827, 110.4411152],
  [-7.0535945, 110.4410427],
  [-7.053701, 110.4409381],
  [-7.0537809, 110.4408255],
  [-7.0538155, 110.4406297],
  [-7.0537942, 110.4403936],
  [-7.0536744, 110.4397097],
  [-7.0552369, 110.4394576],
  [-7.055937, 110.4393342],
  [-7.0559796, 110.4393395],
  [-7.0560328, 110.4393959],
  [-7.0560887, 110.4398143],
  [-7.0561526, 110.4401898],
  [-7.0561366, 110.4403615],
  [-7.0561127, 110.4404795],
  [-7.0560648, 110.4406055],
  [-7.0557187, 110.4412814],
  [-7.0553993, 110.4419949],
  [-7.0552316, 110.442349],
  [-7.0549068, 110.4429578],
  [-7.0548456, 110.4429847],
  [-7.054811, 110.4430383],
  [-7.054819, 110.4430946],
  [-7.0548483, 110.4431241],
  [-7.0540444, 110.4448622],
  [-7.0541775, 110.4448595],
];

// ─── Source data ───────────────────────────────────────────────────────────────

type SourceBuggy = {
  id: number;
  name: string;
  eta: number;
  passengers: number;
  capacity: number;
  tag: string;
  currentStopIndex: number;
};

const STOP_NAMES = HALTE_LOCATIONS.map((h) => h.name);

const SOURCE_BUGGIES: SourceBuggy[] = [
  {
    id: 1,
    name: "Buggy 01",
    eta: 2,
    passengers: 2,
    capacity: 8,
    tag: "Cepat",
    currentStopIndex: 0,
  },
  {
    id: 2,
    name: "Buggy 02",
    eta: 5,
    passengers: 7,
    capacity: 8,
    tag: "Ramai",
    currentStopIndex: 2,
  },
  {
    id: 3,
    name: "Buggy 03",
    eta: 9,
    passengers: 0,
    capacity: 8,
    tag: "Kosong",
    currentStopIndex: 4,
  },
  {
    id: 4,
    name: "Buggy 04",
    eta: 3,
    passengers: 4,
    capacity: 8,
    tag: "Normal",
    currentStopIndex: 6,
  },
  {
    id: 5,
    name: "Buggy 05",
    eta: 6,
    passengers: 8,
    capacity: 8,
    tag: "Penuh",
    currentStopIndex: 8,
  },
  {
    id: 6,
    name: "Buggy 06",
    eta: 1,
    passengers: 1,
    capacity: 8,
    tag: "Cepat",
    currentStopIndex: 10,
  },
];

// ─── Factory ──────────────────────────────────────────────────────────────────

function resolveCrowdLevel(passengers: number, capacity: number): CrowdLevel {
  const ratio = passengers / capacity;
  if (ratio >= 0.875) return "PENUH";
  if (ratio >= 0.375) return "HAMPIR_PENUH";
  return "LONGGAR";
}

export function createInitialBuggies(): Buggy[] {
  const total = OFFICIAL_ROUTE_PATH.length;
  const count = SOURCE_BUGGIES.length;

  return SOURCE_BUGGIES.map((src, index) => {
    const pathCursor = Math.floor((index / count) * total);
    const [lat, lng] = OFFICIAL_ROUTE_PATH[pathCursor];
    const crowdLevel = resolveCrowdLevel(src.passengers, src.capacity);

    return {
      id: `buggy-${src.id}`,
      code: `B${String(src.id).padStart(2, "0")}`,
      name: src.name,
      routeLabel: "Rute Kampus Undip",
      tripId: `TRIP-2026-${String(src.id).padStart(3, "0")}`,
      etaMinutes: src.eta,
      // Keep initial values deterministic to avoid SSR/CSR hydration mismatch.
      speedKmh: 6 + ((src.id * 3) % 12),
      crowdLevel,
      passengers: src.passengers,
      capacity: src.capacity,
      tag: src.tag,
      updatedAt: "--:--",
      currentStopIndex: src.currentStopIndex,
      stops: STOP_NAMES,
      pathCursor,
      position: { lat, lng },
    };
  });
}
